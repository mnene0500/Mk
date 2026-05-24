
'use server';

import { getSupabaseAdmin } from '@/lib/supabase';
import { headers } from 'next/headers';

/**
 * @fileOverview Native Economy Actions on Vercel.
 * Hardened for strict bidirectional blocking and correct targeting.
 */

const OFFENSIVE_WORDS = [
  // English
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'nigger', 'bastard',
  // Kiswahili
  'kuma', 'mboro', 'malaya', 'mjinga', 'msenge', 'shenzi', 'kundu', 'fala'
];

function moderateText(text: string): boolean {
  const lowerText = text.toLowerCase();
  return OFFENSIVE_WORDS.some(word => lowerText.includes(word));
}

export async function sendMessageAction(payload: {
  chatId: string;
  senderId: string;
  recipientId: string;
  text: string;
}) {
  const supabase = getSupabaseAdmin();
  const timestamp = Date.now();

  try {
    // 1. Moderation Check
    if (moderateText(payload.text)) {
      return { success: false, error: "offensive_content" };
    }

    // 2. Fetch Sender Profile for Billing
    const { data: sender } = await supabase
      .from('users')
      .select('gender, is_admin, is_coin_seller, name')
      .eq('uid', payload.senderId)
      .single();

    if (!sender) throw new Error("Sender not found.");

    // 3. Billing Logic
    const isSpecialRole = sender.is_admin || sender.is_coin_seller;
    const isMale = sender.gender === 'male';
    const cost = 15; // Cost per message

    if (isMale && !isSpecialRole) {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', payload.senderId).single();
      const currentCoins = Number(bal?.coins) || 0;

      if (currentCoins < cost) {
        return { success: false, error: "insufficient_funds" };
      }

      // Deduct coins atomically
      const { error: deductErr } = await supabase.rpc("increment_coins", { 
        p_user_id: payload.senderId, 
        p_amount: -cost 
      });
      if (deductErr) throw deductErr;

      // Log to history
      await supabase.from("coin_history").insert({
        user_id: payload.senderId,
        amount: -cost,
        type: "chat_cost",
        description: `Message to ${payload.recipientId.slice(0, 5)}...`,
        timestamp
      });
    }

    // 4. Upsert Chat & Insert Message
    await supabase.from('chats').upsert({ 
      id: payload.chatId, 
      last_message: payload.text, 
      last_message_at: timestamp, 
      participant_ids: [payload.senderId, payload.recipientId] 
    });

    const { error: msgError } = await supabase.from('messages').insert({ 
      chat_id: payload.chatId, 
      text: payload.text, 
      sender_id: payload.senderId, 
      timestamp 
    });

    if (msgError) throw msgError;

    return { success: true };
  } catch (err: any) {
    console.error("[Send Message Error]:", err.message);
    return { success: false, error: "system_error" };
  }
}

export async function completeOnboardingAction(payload: {
  uid: string;
  email: string;
  name: string;
  gender: string;
  dob: string;
  country: string;
  looking_for: string;
  photo_url?: string;
}) {
  const supabase = getSupabaseAdmin();
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

  try {
    // 1. Check IP Account Limit (Max 3)
    const { count, error: countErr } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('last_ip', ip);

    if (countErr) throw countErr;
    if (count !== null && count >= 3) {
      return { success: false, error: "Account limit reached for this device (Max 3)." };
    }

    // 2. Determine Welcome Bonus
    let initialCoins = 0;
    if (payload.gender === 'male') {
      initialCoins = (count !== null && count < 2) ? 500 : 0;
    }
    
    const initialDiamonds = payload.gender === 'female' ? 150 : 0;
    const qId = Math.floor(1000000 + Math.random() * 900000000).toString();
    const timestamp = Date.now();

    // 3. Atomic Profile Creation
    const { error: profileErr } = await supabase.from('users').upsert({
      uid: payload.uid,
      email: payload.email,
      name: payload.name,
      gender: payload.gender,
      dob: payload.dob,
      country: payload.country,
      looking_for: payload.looking_for,
      onboarding_complete: true,
      match_flow_id: qId,
      photo_url: payload.photo_url || `https://picsum.photos/seed/${payload.uid}/400/400`,
      last_ip: ip,
      updated_at: new Date().toISOString()
    }, { onConflict: 'uid' });

    if (profileErr) throw profileErr;

    // 4. Setup Initial Balance
    await supabase.from('balances').upsert({
      user_id: payload.uid,
      coins: initialCoins,
      diamonds: initialDiamonds
    }, { onConflict: 'user_id' });

    if (initialCoins > 0) {
      await supabase.from('coin_history').insert({
        user_id: payload.uid,
        amount: initialCoins,
        type: 'bonus',
        description: 'Welcome Bonus (New Device)',
        timestamp: timestamp
      });
    }

    return { success: true, bonus: initialCoins };
  } catch (err: any) {
    console.error("[Onboarding Server Error]:", err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteUserCompletelyAction(uid: string) {
  const supabase = getSupabaseAdmin();
  try {
    await supabase
      .from('chats')
      .delete()
      .contains('participant_ids', [uid]);

    const { error } = await supabase.auth.admin.deleteUser(uid);
    
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("[Delete Account Nuclear Error]:", err.message);
    return { success: false, error: err.message };
  }
}

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

export async function awardCoinsAction(merchantUid: string, targetUid: string, amount: number) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: merchant, error: authErr } = await supabase
      .from('users')
      .select('uid, name, is_admin, is_coin_seller')
      .eq('uid', merchantUid)
      .maybeSingle();

    if (authErr || !merchant) throw new Error("Authorization failed.");
    if (!merchant.is_admin && !merchant.is_coin_seller) throw new Error("Unauthorized.");

    const { data: target, error: targetErr } = await supabase
      .from('users')
      .select('uid, name')
      .eq('uid', targetUid.trim())
      .maybeSingle();
    
    if (targetErr || !target) throw new Error("Recipient UID not found.");

    const ts = Date.now();

    if (!merchant.is_admin && merchant.is_coin_seller) {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', merchantUid).single();
      const currentBal = Number(bal?.coins) || 0;
      if (currentBal < amount) throw new Error(`Insufficient coins (Balance: ${currentBal})`);

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
    
    const chatId = `direct_${[senderUid, recipientUid].sort()[0]}_${[senderUid, recipientUid].sort()[1]}`;
    
    await Promise.all([
      supabase.from("coin_history").insert({ user_id: senderUid, amount: -coinAmount, type: "gift_sent", description: `Sent ${giftName}`, timestamp: ts }),
      supabase.from("diamond_history").insert({ user_id: recipientUid, amount: reward, type: "gift_received", description: `Gift from ${sender?.name || 'User'}`, timestamp: ts }),
      supabase.from('messages').insert({ chat_id: chatId, sender_id: senderUid, text: `[Gift: ${giftName}]`, is_gift: true, timestamp: ts }),
      supabase.from('chats').upsert({ id: chatId, last_message: `[Gift: ${giftName}]`, last_message_at: ts, participant_ids: [senderUid, recipientUid] })
    ]);
    
    return { success: true };
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

export async function sendMysteryNoteAction(user_id: string, message: string, recipientCount: number) {
  const supabase = getSupabaseAdmin();
  try {
    const count = Number(recipientCount);
    const cost = count * 10;
    const ts = Date.now();
    
    const { data: user } = await supabase.from('users').select('gender, blocking, blocked_by').eq('uid', user_id).single();
    const { data: balance } = await supabase.from('balances').select('coins').eq('user_id', user_id).maybeSingle();
    
    if ((Number(balance?.coins) || 0) < cost) {
      throw new Error("Insufficient coins.");
    }

    const targetGender = user?.gender === 'male' ? 'female' : 'male';
    const blockedList = [...(user?.blocking || []), ...(user?.blocked_by || [])];

    const { data: targets } = await supabase
      .from('users')
      .select('uid')
      .eq('gender', targetGender)
      .eq('onboarding_complete', true)
      .neq('uid', user_id)
      .not('uid', 'in', `(${blockedList.join(',')})`)
      .limit(count);
    
    if (targets && targets.length > 0) {
      const { error: deductErr } = await supabase.rpc("increment_coins", { p_user_id: user_id, p_amount: -cost });
      if (deductErr) throw deductErr;

      for (const target of targets) {
        const chatId = `direct_${[user_id, target.uid].sort()[0]}_${[user_id, target.uid].sort()[1]}`;
        await supabase.from('chats').upsert({ 
          id: chatId, 
          last_message: message, 
          last_message_at: ts, 
          participant_ids: [user_id, target.uid] 
        });
        await supabase.from('messages').insert({ 
          chat_id: chatId, 
          sender_id: user_id, 
          text: message, 
          timestamp: ts 
        });
      }
      
      await supabase.from('coin_history').insert({ 
        user_id, 
        amount: -cost, 
        type: 'mystery_note', 
        description: `Mystery Note Blast (${targets.length} people)`,
        timestamp: ts 
      });
      
      return { success: true };
    }
    
    throw new Error("No active users matching your blast criteria.");
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
    const { error: updateErr } = await supabase.from('users').update({ agency_id: code, agency_status: 'pending' }).eq('uid', userUid);
    if (updateErr) throw updateErr;
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
