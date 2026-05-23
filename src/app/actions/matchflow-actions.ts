
'use server';

import { supabase } from '@/lib/supabase';

/**
 * @fileOverview Native Economy Actions.
 * Hardened to prevent race conditions and ensure transactional integrity.
 */

export async function dailyCheckInAction(uid: string) {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();

    if (userError || !user) throw new Error("Profile synchronization failed.");

    const now = new Date();
    const today = now.toDateString();
    
    // 1. Strict Day Check
    if (user.last_check_in_date) {
      const lastDate = new Date(user.last_check_in_date).toDateString();
      if (lastDate === today) {
        return { success: false, error: "Reward already collected for today." };
      }
    }

    // 2. Streak Calculation
    let streak = 1;
    if (user.last_check_in_date) {
      const lastCheckIn = new Date(user.last_check_in_date);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastCheckIn.toDateString() === yesterday.toDateString()) {
        streak = (user.check_in_streak || 0) + 1;
      }
    }

    // 3. Rewards Cycle: 2, 2, 5, 2, 2, 2, 10
    const rewards = [2, 2, 5, 2, 2, 2, 10];
    const amount = rewards[(streak - 1) % 7];
    const ts = Date.now();

    // 4. Atomic Database Update
    const { error: updateError } = await supabase.from('users').update({
      last_check_in_date: now.toISOString(),
      check_in_streak: streak
    }).eq('uid', uid);
    
    if (updateError) throw updateError;

    // 5. Award Coins via RPC
    await supabase.rpc("increment_coins", { user_uid: uid, amount });

    // 6. Record History
    await supabase.from('coin_history').insert({
      user_id: uid,
      amount: amount,
      type: 'checkin',
      description: `Daily Check-in Day ${streak}`,
      timestamp: ts
    });

    return { success: true, amount, day: streak };
  } catch (error: any) {
    console.error("[Check-in Engine Crash]", error.message);
    return { success: false, error: "System busy. Please try again." };
  }
}

export async function sendGiftAction(senderUid: string, recipientUid: string, coinAmount: number, giftName: string) {
  try {
    const ts = Date.now();
    const ids = [senderUid, recipientUid].sort();
    const chatId = `direct_${ids[0]}_${ids[1]}`;

    // 1. Deduct Sender Atomic
    const { error: deductErr } = await supabase.rpc("increment_coins", { user_uid: senderUid, amount: -coinAmount });
    if (deductErr) throw new Error("Insufficient coins in vault.");

    await supabase.from("coin_history").insert({
      user_id: senderUid,
      amount: -coinAmount,
      type: "gift_sent",
      description: `Sent ${giftName}`,
      timestamp: ts
    });

    // 2. Award Recipient (50% Female / 40% Male)
    const { data: rec } = await supabase.from('users').select('gender, name').eq('uid', recipientUid).single();
    const { data: sender } = await supabase.from('users').select('name').eq('uid', senderUid).single();
    
    const rate = rec?.gender === 'female' ? 0.5 : 0.4;
    const diamondReward = Math.floor(coinAmount * rate);

    await supabase.rpc("increment_diamonds", { user_id: recipientUid, amount: diamondReward });
    await supabase.from("diamond_history").insert({ 
      user_id: recipientUid, 
      amount: diamondReward, 
      type: "gift_received", 
      description: `Gift from ${sender?.name || 'User'}`, 
      timestamp: ts 
    });

    // 3. Insert Social Message Bubble
    const giftMsg = `[Gift: ${giftName}]`;
    await supabase.from('messages').insert({ 
      chat_id: chatId, 
      sender_id: senderUid, 
      text: giftMsg, 
      is_gift: true, 
      timestamp: ts 
    });

    // 4. Update Chat Index
    await supabase.from('chats').upsert({ 
      id: chatId, 
      last_message: giftMsg, 
      last_message_at: ts, 
      participant_ids: [senderUid, recipientUid] 
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendMysteryNoteAction(senderUid: string, message: string, recipientCount: number) {
  try {
    const cost = Number(recipientCount) * 10;
    const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', senderUid).maybeSingle();
    
    const currentBal = Number(bal?.coins || 0);

    if (currentBal < cost) {
      throw new Error(`Insufficient coins. Needed ${cost} but found ${currentBal}.`);
    }

    const { error: rpcErr } = await supabase.rpc("increment_coins", { user_uid: senderUid, amount: -cost });
    if (rpcErr) throw rpcErr;

    await supabase.from('coin_history').insert({
      user_id: senderUid,
      amount: -cost,
      type: 'mystery_note',
      description: `Sent Mystery Note to ${recipientCount} people`,
      timestamp: Date.now()
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Mystery Note Logic Error]", error.message);
    return { success: false, error: error.message };
  }
}

export async function convertDiamondsToCoinsAction(uid: string, diamonds: number, coins: number) {
  try {
    const ts = Date.now();
    await supabase.rpc("increment_diamonds", { user_id: uid, amount: -diamonds });
    await supabase.from("diamond_history").insert({
      user_id: uid,
      amount: -diamonds,
      type: "conversion",
      description: `Converted to ${coins} coins`,
      timestamp: ts
    });

    await supabase.rpc("increment_coins", { user_uid: uid, amount: coins });
    await supabase.from("coin_history").insert({
      user_id: uid,
      amount: coins,
      type: "conversion",
      description: `Diamond Conversion`,
      timestamp: ts
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function requestWithdrawalAction(userUid: string, diamonds: number, amount_kes: number, agencyId: string) {
  try {
    const ts = Date.now();
    await supabase.rpc("increment_diamonds", { user_id: userUid, amount: -diamonds });
    
    await supabase.from('diamond_history').insert({
      user_id: userUid,
      amount: -diamonds,
      type: 'withdrawal',
      description: `Payout Request KES ${amount_kes}`,
      timestamp: ts
    });

    const { error } = await supabase.from('withdrawals').insert({
      user_id: userUid,
      agency_id: agencyId,
      diamonds,
      amount_kes,
      status: 'pending',
      timestamp: ts
    });
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createAgencyAction(creatorUid: string, agencyName: string) {
  try {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const { error } = await supabase.from('agencies').insert({ code, agent_uid: creatorUid, name: agencyName });
    if (error) throw error;
    await supabase.from('users').update({ is_agent: true, agency_id: code, agency_status: 'approved' }).eq('uid', creatorUid);
    return { success: true, code };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function joinAgencyAction(userUid: string, agencyCode: string) {
  try {
    const { error } = await supabase.from('users').update({ agency_id: agencyCode, agency_status: 'pending' }).eq('uid', userUid);
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
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateWithdrawalStatusAction(agentUid: string, agencyId: string, requestId: string, status: 'paid' | 'rejected') {
  try {
    const { error } = await supabase.from('withdrawals').update({ status }).eq('id', requestId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleUserRoleAction(callerUid: string, targetMatchFlowId: string, role: string, value: boolean) {
  try {
    const { data: admin } = await supabase.from('users').select('is_admin').eq('uid', callerUid).single();
    if (!admin?.is_admin) throw new Error("Unauthorized access.");

    const { error } = await supabase.from('users').update({ [role]: value }).eq('match_flow_id', targetMatchFlowId);
    if (error) throw error;
    return { success: true, message: "Authority updated successfully." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitReportAction(reporterUid: string, reportedUid: string, reason: string, description: string, proofUrl: string) {
  try {
    const { error } = await supabase.from('reports').insert({
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

export async function resolveReportAction(adminUid: string, reportId: string, reporterUid: string) {
  try {
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
    const ids = [adminUid, reporterUid].sort();
    const chatId = `direct_${ids[0]}_${ids[1]}`;
    const msg = "The QIVO team is resolving your complaint. Thank you for your patience.";
    const ts = Date.now();
    await supabase.from('messages').insert({ chat_id: chatId, sender_id: adminUid, text: msg, timestamp: ts });
    await supabase.from('chats').upsert({ id: chatId, last_message: msg, last_message_at: ts, participant_ids: [adminUid, reporterUid] });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
