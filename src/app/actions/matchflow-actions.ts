'use server';

import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * @fileOverview Native Economy Actions on Vercel.
 * Hardened to use standardized p_user_id and p_amount parameters.
 */

export async function dailyCheckInAction(uid: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: user, error: userErr } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
    if (userErr || !user) throw new Error("Profile not found.");

    const now = new Date();
    const todayStr = now.toDateString();
    
    if (user.last_check_in_date) {
      const lastCheckIn = new Date(user.last_check_in_date);
      if (lastCheckIn.toDateString() === todayStr) {
        return { success: false, error: "Already collected for today." };
      }
    }

    let streak = 1;
    if (user.last_check_in_date) {
      const last = new Date(user.last_check_in_date);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (last.toDateString() === yesterday.toDateString()) {
        streak = (user.check_in_streak || 0) + 1;
      }
    }

    const rewards = [2, 2, 5, 2, 2, 2, 10];
    const amount = rewards[(streak - 1) % 7];
    const ts = Date.now();

    const { error: updateErr } = await supabase.from('users').update({
      last_check_in_date: now.toISOString(),
      check_in_streak: streak
    }).eq('uid', uid);

    if (updateErr) throw updateErr;

    const { error: rpcErr } = await supabase.rpc("increment_coins", { p_user_id: uid, p_amount: amount });
    if (rpcErr) throw rpcErr;

    await supabase.from('coin_history').insert({
      user_id: uid,
      amount,
      type: 'checkin',
      description: `Daily Check-in Day ${streak}`,
      timestamp: ts
    });

    return { success: true, amount, day: streak };
  } catch (err: any) {
    console.error("[Checkin Error]:", err.message);
    return { success: false, error: "System check failed. Please try again." };
  }
}

export async function awardCoinsAction(merchantUid: string, targetMatchFlowId: string, amount: number) {
  const supabase = getSupabaseAdmin();
  try {
    // 1. Authorize the sender
    const { data: merchant, error: authErr } = await supabase
      .from('users')
      .select('uid, name, is_admin, is_coin_seller')
      .eq('uid', merchantUid)
      .maybeSingle();

    if (authErr || !merchant) throw new Error("Authorization failed.");
    if (!merchant.is_admin && !merchant.is_coin_seller) throw new Error("Unauthorized.");

    // 2. Resolve target by MatchFlow ID
    const { data: target, error: targetErr } = await supabase
      .from('users')
      .select('uid, name')
      .eq('match_flow_id', targetMatchFlowId.trim())
      .maybeSingle();
    
    if (targetErr || !target) throw new Error("Recipient ID not found.");

    const ts = Date.now();

    // 3. Admin logic (Unlimited) vs Merchant logic (Deducted)
    if (!merchant.is_admin && merchant.is_coin_seller) {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', merchantUid).single();
      const currentBal = Number(bal?.coins) || 0;
      if (currentBal < amount) throw new Error(`Insufficient coins (Balance: ${currentBal})`);

      // Deduct Merchant
      const { error: deductErr } = await supabase.rpc("increment_coins", { p_user_id: merchant.uid, p_amount: -amount });
      if (deductErr) throw deductErr;

      await supabase.from("coin_history").insert({
        user_id: merchant.uid,
        amount: -amount,
        type: "merchant_sale",
        description: `Transferred to ${target.name}`,
        timestamp: ts
      });
    }

    // 4. Award target
    const { error: awardErr } = await supabase.rpc("increment_coins", { p_user_id: target.uid, p_amount: amount });
    if (awardErr) throw awardErr;

    await supabase.from("coin_history").insert({
      user_id: target.uid,
      amount,
      type: "merchant_award",
      description: merchant.is_admin ? "System Award" : `Purchased from ${merchant.name}`,
      timestamp: ts
    });

    return { success: true, message: `Sent ${amount} coins to ${target.name}.` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendGiftAction(senderUid: string, recipientUid: string, coinAmount: number, giftName: string) {
  const supabase = getSupabaseAdmin();
  try {
    const ts = Date.now();
    const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', senderUid).single();
    if ((Number(bal?.coins) || 0) < coinAmount) throw new Error("Insufficient coins.");

    const { data: rec } = await supabase.from('users').select('gender, name, uid').eq('uid', recipientUid).single();
    const { data: sender } = await supabase.from('users').select('name, uid').eq('uid', senderUid).single();
    if(!rec || !sender) throw new Error("User not found");

    const rate = rec?.gender === 'female' ? 0.5 : 0.4;
    const reward = Math.floor(coinAmount * rate);

    const { error: deductErr } = await supabase.rpc("increment_coins", { p_user_id: sender.uid, p_amount: -coinAmount });
    if (deductErr) throw deductErr;

    await supabase.rpc("increment_diamonds", { p_user_id: rec.uid, p_amount: reward });
    
    await Promise.all([
      supabase.from("coin_history").insert({ user_id: senderUid, amount: -coinAmount, type: "gift_sent", description: `Sent ${giftName}`, timestamp: ts }),
      supabase.from("diamond_history").insert({ user_id: recipientUid, amount: reward, type: "gift_received", description: `Gift from ${sender?.name || 'User'}`, timestamp: ts }),
      supabase.from('messages').insert({ chat_id: `direct_${[senderUid, recipientUid].sort()[0]}_${[senderUid, recipientUid].sort()[1]}`, sender_id: senderUid, text: `[Gift: ${giftName}]`, is_gift: true, timestamp: ts }),
      supabase.from('chats').upsert({ id: `direct_${[senderUid, recipientUid].sort()[0]}_${[senderUid, recipientUid].sort()[1]}`, last_message: `[Gift: ${giftName}]`, last_message_at: ts, participant_ids: [senderUid, recipientUid] })
    ]);
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function convertDiamondsToCoinsAction(user_id: string, diamonds: number, coins: number) {
  const supabase = getSupabaseAdmin();
  try {
    const ts = Date.now();
    const { error: deductErr } = await supabase.rpc("increment_diamonds", { p_user_id: user_id, p_amount: -diamonds });
    if (deductErr) throw new Error(`Insufficient diamonds.`);
    
    const { error: awardErr } = await supabase.rpc("increment_coins", { p_user_id: user_id, p_amount: coins });
    if (awardErr) throw new Error(`Failed to credit coins.`);

    await Promise.all([
      supabase.from('diamond_history').insert({ user_id, amount: -diamonds, type: 'conversion', description: `Exchanged for ${coins} coins`, timestamp: ts }),
      supabase.from('coin_history').insert({ user_id, amount: coins, type: 'conversion', description: `Exchanged from ${diamonds} diamonds`, timestamp: ts })
    ]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function requestWithdrawalAction(userUid: string, diamonds: number, amount_kes: number, agencyId: string) {
  const supabase = getSupabaseAdmin();
  try {
    const ts = Date.now();
    const { error: rpcError } = await supabase.rpc("increment_diamonds", { p_user_id: userUid, p_amount: -diamonds });
    if (rpcError) throw rpcError;
    await Promise.all([
      supabase.from('withdrawals').insert({ user_id: userUid, agency_id: agencyId, diamonds, amount_kes, status: 'pending', timestamp: ts }),
      supabase.from('diamond_history').insert({ user_id: userUid, amount: -diamonds, type: 'withdrawal', description: `Payout Request KES ${amount_kes}`, timestamp: ts })
    ]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleUserRoleAction(adminUid: string, targetMatchFlowId: string, role: 'is_coin_seller' | 'is_agent' | 'is_admin', value: boolean) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: admin } = await supabase.from('users').select('is_admin').eq('uid', adminUid).maybeSingle();
    if (!admin?.is_admin) throw new Error("Unauthorized.");
    const { error } = await supabase.from('users').update({ [role]: value }).eq('match_flow_id', targetMatchFlowId.trim());
    if (error) throw error;
    return { success: true, message: "Authority status updated." };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function clearChatAction(uid: string, chatId: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data } = await supabase.from('chats').select('cleared_at').eq('id', chatId).maybeSingle();
    const newClearedAt = { ...(data?.cleared_at || {}), [uid]: Date.now() };
    const { error } = await supabase.from('chats').update({ cleared_at: newClearedAt }).eq('id', chatId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitReportAction(reporterId: string, reportedId: string, reason: string, description: string, proofUrl: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_id: reportedId,
      reason,
      description,
      proof_photo_url: proofUrl,
      timestamp: Date.now()
    });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resolveReportAction(adminUid: string, reportId: string, reporterId: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: admin } = await supabase.from('users').select('is_admin').eq('uid', adminUid).maybeSingle();
    if (!admin?.is_admin) throw new Error("Unauthorized.");
    const { error } = await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendMysteryNoteAction(user_id: string, message: string, recipientCount: number) {
  const supabase = getSupabaseAdmin();
  try {
    const count = Number(recipientCount);
    const cost = count * 10;
    const ts = Date.now();
    
    const { data: balance } = await supabase.from('balances').select('coins').eq('user_id', user_id).maybeSingle();
    if ((Number(balance?.coins) || 0) < cost) {
      throw new Error("Insufficient coins.");
    }

    const { error: deductErr } = await supabase.rpc("increment_coins", { p_user_id: user_id, p_amount: -cost });
    if (deductErr) throw deductErr;

    await supabase.from('coin_history').insert({ 
      user_id, 
      amount: -cost, 
      type: 'mystery_note', 
      description: `Mystery Note Blast (${count} people)`,
      timestamp: ts 
    });
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createAgencyAction(agentUid: string, name: string) {
  const supabase = getSupabaseAdmin();
  try {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const { error: agencyErr } = await supabase.from('agencies').insert({ code, agent_uid: agentUid, name });
    if (agencyErr) throw agencyErr;
    await supabase.from('users').update({ agency_id: code, agency_status: 'approved', is_agent: true }).eq('uid', agentUid);
    return { success: true, code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function joinAgencyAction(userUid: string, code: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: agency } = await supabase.from('agencies').select('code').eq('code', code).maybeSingle();
    if (!agency) throw new Error("Invalid Agency Code.");
    const { error } = await supabase.from('users').update({ agency_id: code, agency_status: 'pending' }).eq('uid', userUid);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function reviewRecruitmentAction(agentUid: string, applicantUid: string, status: 'approved' | 'rejected') {
  const supabase = getSupabaseAdmin();
  try {
    const { error } = await supabase.from('users').update({ agency_status: status }).eq('uid', applicantUid);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateWithdrawalStatusAction(agentUid: string, agencyId: string, requestId: string, status: 'paid' | 'rejected') {
  const supabase = getSupabaseAdmin();
  try {
    const { error } = await supabase.from('withdrawals').update({ status }).eq('id', requestId).eq('agency_id', agencyId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
