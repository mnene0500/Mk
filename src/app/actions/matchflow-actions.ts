'use server';

import { supabase } from '@/lib/supabase';

/**
 * @fileOverview Secure Supabase Server Actions for QIVO.
 * Optimized for prototype reliability by using client-provided UID verification.
 */

export async function awardCoinsAction(callerUid: string, targetMatchFlowId: string, amount: number) {
  if (amount < 500) return { success: false, error: "Minimum award amount is 500 coins." };

  try {
    const { data: caller } = await supabase.from('users').select('*').eq('uid', callerUid).single();
    
    if (!caller?.is_admin && !caller?.is_coin_seller) {
      return { success: false, error: "Unauthorized role required." };
    }

    if (caller.is_coin_seller && !caller.is_admin) {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', callerUid).single();
      if ((bal?.coins || 0) < amount) return { success: false, error: "Insufficient business balance." };
      
      await supabase.from('balances').update({ coins: (bal?.coins || 0) - amount }).eq('user_id', callerUid);
      await supabase.from('coin_history').insert({
        user_id: callerUid,
        amount: -amount,
        type: 'transfer',
        description: `Sold coins to user ID: ${targetMatchFlowId}`,
        timestamp: Date.now()
      });
    }

    const { data: target } = await supabase.from('users').select('uid, name').eq('match_flow_id', targetMatchFlowId.trim()).single();
    if (!target) return { success: false, error: "Target User ID not found." };

    const { data: targetBal } = await supabase.from('balances').select('coins').eq('user_id', target.uid).maybeSingle();
    
    await supabase.from('balances').upsert({ 
      user_id: target.uid, 
      coins: (targetBal?.coins || 0) + amount,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    await supabase.from('coin_history').insert({
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

export async function sendGiftAction(senderUid: string, recipientUid: string, coinAmount: number, giftName: string) {
  try {
    const { data: senderBal } = await supabase.from('balances').select('coins').eq('user_id', senderUid).single();
    if ((senderBal?.coins || 0) < coinAmount) return { success: false, error: "Insufficient coins." };

    const timestamp = Date.now();
    const diamondGain = Math.floor(coinAmount * 0.7); 

    // 1. Deduct from Sender
    await supabase.from('balances').update({ coins: (senderBal?.coins || 0) - coinAmount }).eq('user_id', senderUid);
    await supabase.from('coin_history').insert({
      user_id: senderUid,
      amount: -coinAmount,
      type: 'gift_sent',
      description: `Sent ${giftName} gift`,
      timestamp
    });

    // 2. Award to Recipient
    const { data: recBal } = await supabase.from('balances').select('diamonds').eq('user_id', recipientUid).maybeSingle();
    await supabase.from('balances').upsert({ 
      user_id: recipientUid, 
      diamonds: (Number(recBal?.diamonds) || 0) + diamondGain,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    await supabase.from('diamond_history').insert({
      user_id: recipientUid,
      amount: diamondGain,
      type: 'gift_received',
      description: `Received ${giftName} (70% share)`,
      timestamp
    });

    // 3. System message
    const ids = [senderUid, recipientUid].sort();
    const chatId = `direct_${ids[0]}_${ids[1]}`;
    await supabase.from('messages').insert({ chat_id: chatId, sender_id: senderUid, text: `🎁 Sent a ${giftName}!`, timestamp, is_gift: true });
    await supabase.from('chats').upsert({ id: chatId, last_message: `🎁 ${giftName}`, last_message_at: timestamp, participant_ids: [senderUid, recipientUid] }, { onConflict: 'id' });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendMysteryNoteAction(senderUid: string, message: string, recipientCount: number) {
  const COST_PER_PERSON = 10;
  const totalCost = recipientCount * COST_PER_PERSON;

  try {
    const { data: profile } = await supabase.from('users').select('gender').eq('uid', senderUid).single();
    if (!profile) return { success: false, error: "Profile not found." };

    const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', senderUid).single();
    if ((bal?.coins || 0) < totalCost) return { success: false, error: "Insufficient coins." };

    const targetGender = profile.gender === 'male' ? 'female' : 'male';
    const { data: targets } = await supabase
      .from('users')
      .select('uid')
      .eq('gender', targetGender)
      .eq('onboarding_complete', true)
      .neq('uid', senderUid)
      .limit(60);

    if (!targets || targets.length < recipientCount) {
      return { success: false, error: "Not enough matching users online." };
    }

    const shuffled = targets.sort(() => Math.random() - 0.5).slice(0, recipientCount);
    const timestamp = Date.now();

    await supabase.from('balances').update({ coins: (bal?.coins || 0) - totalCost }).eq('user_id', senderUid);
    await supabase.from('coin_history').insert({
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
        supabase.from('messages').insert({ chat_id: chatId, text: message.trim(), sender_id: senderUid, timestamp }),
        supabase.from('chats').upsert({
          id: chatId,
          last_message: message.trim(),
          last_message_at: timestamp,
          participant_ids: [senderUid, target.uid]
        }, { onConflict: 'id' })
      ]);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleUserRoleAction(callerUid: string, targetMatchFlowId: string, role: string, value: boolean) {
  try {
    const { data: caller } = await supabase.from('users').select('is_admin').eq('uid', callerUid).single();
    if (!caller?.is_admin) return { success: false, error: "Admin privileges required." };

    const dbRole = role === 'is_coin_seller' ? 'is_coin_seller' : role === 'is_agent' ? 'is_agent' : role;
    const { error } = await supabase.from('users').update({ [dbRole]: value }).eq('match_flow_id', targetMatchFlowId.trim());
    if (error) throw error;

    return { success: true, message: `Authority updated successfully.` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createAgencyAction(creatorUid: string, agencyName: string) {
  try {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const { error: agencyErr } = await supabase.from('agencies').insert({ code, agent_uid: creatorUid, name: agencyName });
    if (agencyErr) throw agencyErr;

    await supabase.from('users').update({ agency_id: code, agency_status: 'approved', is_agent: true }).eq('uid', creatorUid);
    return { success: true, code };
  } catch (error: any) { 
    return { success: false, error: error.message }; 
  }
}

export async function requestWithdrawalAction(userUid: string, diamonds: number, amountKes: number, agencyId: string) {
  try {
    const { data: bal } = await supabase.from('balances').select('diamonds').eq('user_id', userUid).single();
    if ((Number(bal?.diamonds) || 0) < diamonds) return { success: false, error: "Insufficient diamonds." };

    await supabase.from('balances').update({ diamonds: (Number(bal?.diamonds) || 0) - diamonds }).eq('user_id', userUid);

    const { error } = await supabase.from('withdrawals').insert({ 
      user_id: userUid, 
      agency_id: agencyId, 
      diamonds, 
      amount_kes: amountKes, 
      status: 'pending',
      timestamp: Date.now()
    });
    
    if (error) throw error;
    
    await supabase.from('diamond_history').insert({
      user_id: userUid,
      amount: -diamonds,
      type: 'withdrawal',
      description: `Withdrawal for Ksh ${amountKes}`,
      timestamp: Date.now()
    });

    return { success: true };
  } catch (error: any) { 
    return { success: false, error: error.message }; 
  }
}

export async function joinAgencyAction(userUid: string, agencyCode: string) {
  try {
    const { data: agency } = await supabase.from('agencies').select('code').eq('code', agencyCode.trim()).single();
    if (!agency) return { success: false, error: "Invalid Agency Code." };
    
    const { error } = await supabase.from('users').update({ agency_id: agencyCode.trim(), agency_status: 'pending' }).eq('uid', userUid);
    if (error) throw error;

    return { success: true };
  } catch (error: any) { 
    return { success: false, error: error.message }; 
  }
}

export async function reviewRecruitmentAction(agentUid: string, applicantUid: string, status: 'approved' | 'rejected') {
  try {
    const { error } = await supabase.from('users').update({ agency_status: status }).eq('uid', applicantUid);
    if (error) throw error;
    return { success: true };
  } catch (error: any) { return { success: false, error: error.message }; }
}

export async function updateWithdrawalStatusAction(agentUid: string, agencyId: string, requestId: string, status: 'paid' | 'rejected') {
  try {
    const { error } = await supabase.from('withdrawals').update({ status }).eq('id', requestId).eq('agency_id', agencyId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) { return { success: false, error: error.message }; }
}
