'use server';

import { supabase, supabaseAdmin } from '@/lib/supabase';

/**
 * @fileOverview Secure Supabase Server Actions for QIVO.
 * Uses supabaseAdmin (Service Role) for balance and role updates to ensure RLS doesn't block critical tasks.
 */

export async function awardCoinsAction(callerUid: string, targetMatchFlowId: string, amount: number) {
  if (amount < 500) return { success: false, error: "Minimum award amount is 500 coins." };

  try {
    // 1. Verify Caller Authority
    const { data: caller } = await supabaseAdmin.from('users').select('*').eq('uid', callerUid).single();
    
    if (!caller?.is_admin && !caller?.is_coin_seller) {
      return { success: false, error: "Unauthorized role required." };
    }

    // 2. Handle Merchant Balance (if not Admin)
    if (caller.is_coin_seller && !caller.is_admin) {
      const { data: bal } = await supabaseAdmin.from('balances').select('coins').eq('user_id', callerUid).single();
      if ((bal?.coins || 0) < amount) return { success: false, error: "Insufficient business balance." };
      
      await supabaseAdmin.from('balances').update({ coins: (Number(bal?.coins) || 0) - amount }).eq('user_id', callerUid);
      await supabaseAdmin.from('coin_history').insert({
        user_id: callerUid,
        amount: -amount,
        type: 'transfer',
        description: `Sold coins to user ID: ${targetMatchFlowId}`,
        timestamp: Date.now()
      });
    }

    // 3. Award Target
    const { data: target } = await supabaseAdmin.from('users').select('uid, name').eq('match_flow_id', targetMatchFlowId.trim()).single();
    if (!target) return { success: false, error: "Target User ID not found." };

    const { data: targetBal } = await supabaseAdmin.from('balances').select('coins').eq('user_id', target.uid).maybeSingle();
    
    await supabaseAdmin.from('balances').upsert({ 
      user_id: target.uid, 
      coins: (Number(targetBal?.coins) || 0) + amount,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    await supabaseAdmin.from('coin_history').insert({
      user_id: target.uid,
      amount,
      type: 'award',
      description: `Awarded by ${caller.is_admin ? 'Admin' : 'Certified Merchant'}`,
      timestamp: Date.now()
    });

    return { success: true, message: `Successfully awarded ${amount} coins to ${target.name}.` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function dailyCheckInAction(uid: string) {
  try {
    const { data: profile } = await supabaseAdmin.from('users').select('last_check_in_date, check_in_streak').eq('uid', uid).single();
    if (!profile) return { success: false, error: "Profile not found." };

    const today = new Date().toISOString().split('T')[0];
    const lastCheckIn = profile.last_check_in_date ? new Date(profile.last_check_in_date).toISOString().split('T')[0] : null;

    if (lastCheckIn === today) return { success: false, error: "Already collected today." };

    const days = [2, 2, 5, 2, 2, 2, 10];
    const currentStreak = profile.check_in_streak || 0;
    const streakIndex = currentStreak % 7;
    const rewardAmount = days[streakIndex];
    const timestamp = Date.now();

    const { data: balData } = await supabaseAdmin.from('balances').select('coins').eq('user_id', uid).maybeSingle();
    const currentCoins = Number(balData?.coins) || 0;

    await Promise.all([
      supabaseAdmin.from('users').update({
        last_check_in_date: new Date().toISOString(),
        check_in_streak: currentStreak + 1
      }).eq('uid', uid),
      supabaseAdmin.from('balances').upsert({ 
        user_id: uid, 
        coins: currentCoins + rewardAmount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' }),
      supabaseAdmin.from('coin_history').insert({
        user_id: uid,
        amount: rewardAmount,
        type: 'task',
        description: `Daily Check-in Day ${streakIndex + 1}`,
        timestamp: timestamp
      })
    ]);

    return { success: true, amount: rewardAmount, day: streakIndex + 1 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendGiftAction(senderUid: string, recipientUid: string, coinAmount: number, giftName: string) {
  try {
    const { data: senderBal } = await supabaseAdmin.from('balances').select('coins').eq('user_id', senderUid).single();
    if (!senderBal || (Number(senderBal.coins) || 0) < coinAmount) {
      return { success: false, error: "Insufficient coins." };
    }

    const timestamp = Date.now();
    await supabaseAdmin.from('balances').update({ 
      coins: (Number(senderBal.coins) || 0) - coinAmount 
    }).eq('user_id', senderUid);

    await supabaseAdmin.from('coin_history').insert({
      user_id: senderUid,
      amount: -coinAmount,
      type: 'gift_sent',
      description: `Sent ${giftName} gift`,
      timestamp
    });

    const ids = [senderUid, recipientUid].sort();
    const chatId = `direct_${ids[0]}_${ids[1]}`;
    await Promise.all([
      supabaseAdmin.from('messages').insert({ chat_id: chatId, sender_id: senderUid, text: `🎁 Sent a ${giftName}!`, timestamp, is_gift: true }),
      supabaseAdmin.from('chats').upsert({ 
        id: chatId, 
        last_message: `🎁 ${giftName}`, 
        last_message_at: timestamp, 
        participant_ids: [senderUid, recipientUid] 
      }, { onConflict: 'id' })
    ]);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Transaction failed." };
  }
}

export async function submitReportAction(reporterUid: string, reportedUid: string, reason: string, description: string, proofUrl: string) {
  try {
    const { error } = await supabaseAdmin.from('reports').insert({
      reporter_id: reporterUid,
      reported_id: reportedUid,
      reason,
      description,
      proof_photo_url: proofUrl,
      timestamp: Date.now()
    });
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendMysteryNoteAction(senderUid: string, message: string, recipientCount: number) {
  const COST_PER_PERSON = 10;
  const totalCost = recipientCount * COST_PER_PERSON;

  try {
    const { data: profile } = await supabaseAdmin.from('users').select('gender').eq('uid', senderUid).single();
    const { data: bal } = await supabaseAdmin.from('balances').select('coins').eq('user_id', senderUid).single();
    
    if (!profile || (Number(bal?.coins) || 0) < totalCost) {
      return { success: false, error: "Insufficient coins." };
    }

    const targetGender = profile.gender === 'male' ? 'female' : 'male';
    const { data: targets } = await supabaseAdmin
      .from('users')
      .select('uid')
      .eq('gender', targetGender)
      .eq('onboarding_complete', true)
      .neq('uid', senderUid)
      .limit(60);

    if (!targets || targets.length < recipientCount) return { success: false, error: "Not enough matching users." };

    const shuffled = targets.sort(() => Math.random() - 0.5).slice(0, recipientCount);
    const timestamp = Date.now();

    await supabaseAdmin.from('balances').update({ coins: Number(bal?.coins) - totalCost }).eq('user_id', senderUid);
    await supabaseAdmin.from('coin_history').insert({
      user_id: senderUid,
      amount: -totalCost,
      type: 'mystery_note',
      description: `Mystery Note to ${recipientCount} people`,
      timestamp
    });

    for (const target of shuffled) {
      const ids = [senderUid, target.uid].sort();
      const chatId = `direct_${ids[0]}_${ids[1]}`;
      await Promise.all([
        supabaseAdmin.from('messages').insert({ chat_id: chatId, text: message.trim(), sender_id: senderUid, timestamp }),
        supabaseAdmin.from('chats').upsert({ id: chatId, last_message: message.trim(), last_message_at: timestamp, participant_ids: [senderUid, target.uid] }, { onConflict: 'id' })
      ]);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleUserRoleAction(callerUid: string, targetMatchFlowId: string, role: string, value: boolean) {
  try {
    const { data: caller } = await supabaseAdmin.from('users').select('is_admin').eq('uid', callerUid).single();
    if (!caller?.is_admin) return { success: false, error: "Admin privileges required." };

    const dbRole = role === 'is_coin_seller' ? 'is_coin_seller' : role === 'is_agent' ? 'is_agent' : role;
    const { error } = await supabaseAdmin.from('users').update({ [dbRole]: value }).eq('match_flow_id', targetMatchFlowId.trim());
    if (error) throw error;

    return { success: true, message: `Authority updated successfully.` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createAgencyAction(creatorUid: string, agencyName: string) {
  try {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    await supabaseAdmin.from('agencies').insert({ code, agent_uid: creatorUid, name: agencyName });
    await supabaseAdmin.from('users').update({ agency_id: code, agency_status: 'approved', is_agent: true }).eq('uid', creatorUid);
    return { success: true, code };
  } catch (error: any) { 
    return { success: false, error: error.message }; 
  }
}

export async function requestWithdrawalAction(userUid: string, diamonds: number, amountKes: number, agencyId: string) {
  try {
    const { data: bal } = await supabaseAdmin.from('balances').select('diamonds').eq('user_id', userUid).single();
    if ((Number(bal?.diamonds) || 0) < diamonds) return { success: false, error: "Insufficient diamonds." };

    await supabaseAdmin.from('balances').update({ diamonds: (Number(bal?.diamonds) || 0) - diamonds }).eq('user_id', userUid);
    await supabaseAdmin.from('withdrawals').insert({ user_id: userUid, agency_id: agencyId, diamonds, amount_kes: amountKes, status: 'pending', timestamp: Date.now() });
    await supabaseAdmin.from('diamond_history').insert({ user_id: userUid, amount: -diamonds, type: 'withdrawal', description: `Withdrawal for Ksh ${amountKes}`, timestamp: Date.now() });

    return { success: true };
  } catch (error: any) { 
    return { success: false, error: error.message }; 
  }
}

export async function joinAgencyAction(userUid: string, agencyCode: string) {
  try {
    const { data: agency } = await supabaseAdmin.from('agencies').select('code').eq('code', agencyCode.trim()).single();
    if (!agency) return { success: false, error: "Invalid Agency Code." };
    await supabaseAdmin.from('users').update({ agency_id: agencyCode.trim(), agency_status: 'pending' }).eq('uid', userUid);
    return { success: true };
  } catch (error: any) { 
    return { success: false, error: error.message }; 
  }
}

export async function reviewRecruitmentAction(agentUid: string, applicantUid: string, status: 'approved' | 'rejected') {
  try {
    await supabaseAdmin.from('users').update({ agency_status: status }).eq('uid', applicantUid);
    return { success: true };
  } catch (error: any) { return { success: false, error: error.message }; }
}

export async function updateWithdrawalStatusAction(agentUid: string, agencyId: string, requestId: string, status: 'paid' | 'rejected') {
  try {
    await supabaseAdmin.from('withdrawals').update({ status }).eq('id', requestId).eq('agency_id', agencyId);
    return { success: true };
  } catch (error: any) { return { success: false, error: error.message }; }
}
