'use server';

import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * @fileOverview Hardened Server Actions for QIVO.
 * Includes Special User logic for free texting and unlimited coin authority.
 */

export async function completeOnboardingAction(payload: {
  uid: string; email: string; name: string; gender: string; dob: string; country: string; looking_for: string; photo_url?: string;
}) {
  const supabase = getSupabaseAdmin();
  
  try {
    const qId = Math.floor(1000000 + Math.random() * 900000000).toString();
    const timestamp = Date.now();

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
      photo_url: payload.photo_url, 
      updated_at: new Date().toISOString()
    });

    if (profileErr) throw profileErr;

    const initialCoins = (payload.gender === 'male') ? 500 : 0;
    const initialDiamonds = (payload.gender === 'female') ? 150 : 0;

    if (initialCoins > 0) {
      const { error: coinErr } = await supabase.rpc("increment_coins", { p_user_id: payload.uid, p_amount: initialCoins });
      if (coinErr) throw coinErr;
      await supabase.from('coin_history').insert({ 
        user_id: payload.uid, amount: initialCoins, type: 'bonus', description: 'Welcome Bonus', timestamp 
      });
    }

    if (initialDiamonds > 0) {
      const { error: diaErr } = await supabase.rpc("increment_diamonds", { p_user_id: payload.uid, p_amount: initialDiamonds });
      if (diaErr) throw diaErr;
      await supabase.from('diamond_history').insert({ 
        user_id: payload.uid, amount: initialDiamonds, type: 'bonus', description: 'Welcome Bonus', timestamp 
      });
    }

    return { success: true, bonus: initialCoins || initialDiamonds };
  } catch (err: any) {
    console.error("[Onboarding Error]:", err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteUserCompletelyAction(uid: string) {
  const supabase = getSupabaseAdmin();
  try {
    // 1. Manual Deep Purge to avoid FK errors
    await Promise.all([
      supabase.from('calls').delete().or(`caller_id.eq.${uid},receiver_id.eq.${uid}`),
      supabase.from('reports').delete().or(`reporter_id.eq.${uid},reported_id.eq.${uid}`),
      supabase.from('withdrawals').delete().eq('user_id', uid),
      supabase.from('messages').delete().eq('sender_id', uid),
      supabase.from('diamond_history').delete().eq('user_id', uid),
      supabase.from('coin_history').delete().eq('user_id', uid),
      supabase.from('balances').delete().eq('user_id', uid)
    ]);

    // 2. Delete Profile
    const { error: profileErr } = await supabase.from('users').delete().eq('uid', uid);
    if (profileErr) throw profileErr;
    
    // 3. Auth Record
    await supabase.auth.admin.deleteUser(uid);
    
    return { success: true };
  } catch (err: any) {
    console.error("[Delete User Error]:", err.message);
    return { success: false, error: err.message || "Deep purge failed." };
  }
}

export async function awardCoinsAction(ownerUid: string, targetUid: string, amount: number) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: owner } = await supabase.from('users').select('is_owner, is_coin_seller, is_special_user').eq('uid', ownerUid).single();
    if (!owner?.is_owner && !owner?.is_coin_seller && !owner?.is_special_user) throw new Error("Unauthorized");

    // Owners and Special Users have unlimited balance
    const isUnlimited = owner.is_owner || owner.is_special_user;

    if (!isUnlimited) {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', ownerUid).single();
      if ((Number(bal?.coins) || 0) < amount) throw new Error("Insufficient merchant balance");
      await supabase.rpc("increment_coins", { p_user_id: ownerUid, p_amount: -amount });
    }

    const { error: awardErr } = await supabase.rpc("increment_coins", { p_user_id: targetUid, p_amount: amount });
    if (awardErr) throw awardErr;

    await supabase.from('coin_history').insert({
      user_id: targetUid,
      amount: amount,
      type: 'purchase',
      description: isUnlimited ? 'Transfer from Official' : 'Transfer from Merchant',
      timestamp: Date.now()
    });

    return { success: true, message: `Successfully sent ${amount} coins.` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleUserRoleAction(ownerUid: string, targetMatchFlowId: string, role: 'is_coin_seller' | 'is_agent' | 'is_owner' | 'is_special_user', value: boolean) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: owner } = await supabase.from('users').select('is_owner, is_special_user').eq('uid', ownerUid).single();
    if (!owner?.is_owner && !owner?.is_special_user) throw new Error("Unauthorized");
    
    const { error: updateErr } = await supabase.from('users').update({ [role]: value }).eq('match_flow_id', targetMatchFlowId);
    if (updateErr) throw updateErr;
    return { success: true, message: "Authority updated successfully." };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function clearChatAction(uid: string, chatId: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data } = await supabase.from('chats').select('cleared_at').eq('id', chatId).single();
    const currentCleared = data?.cleared_at || {};
    const updatedCleared = { ...currentCleared, [uid]: Date.now() };
    await supabase.from('chats').update({ cleared_at: updatedCleared }).eq('id', chatId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function dailyCheckInAction(uid: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: user } = await supabase.from('users').select('last_check_in_date, check_in_streak').eq('uid', uid).single();
    if (!user) throw new Error("Profile not found.");
    const now = new Date();
    if (user.last_check_in_date && new Date(user.last_check_in_date).toDateString() === now.toDateString()) {
      return { success: false, error: "Already collected." };
    }
    let streak = 1;
    if (user.last_check_in_date) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      if (new Date(user.last_check_in_date).toDateString() === yesterday.toDateString()) {
        streak = (user.check_in_streak || 0) + 1;
      }
    }
    const rewards = [2, 2, 5, 2, 2, 2, 10];
    const amount = rewards[(streak - 1) % 7];
    const ts = Date.now();
    await supabase.from('users').update({ last_check_in_date: now.toISOString(), check_in_streak: streak }).eq('uid', uid);
    await supabase.rpc("increment_coins", { p_user_id: uid, p_amount: amount });
    await supabase.from('coin_history').insert({ user_id: uid, amount, type: 'checkin', description: `Check-in Day ${streak}`, timestamp: ts });
    return { success: true, amount, day: streak };
  } catch (err: any) {
    return { success: false, error: "Task failed." };
  }
}

export async function sendMessageAction(payload: { chatId: string; senderId: string; recipientId: string; text: string; }) {
  const supabase = getSupabaseAdmin();
  const timestamp = Date.now();
  try {
    const { data: sender } = await supabase.from('users').select('gender, is_owner, is_coin_seller, is_special_user').eq('uid', payload.senderId).single();
    const { data: recipient } = await supabase.from('users').select('is_special_user').eq('uid', payload.recipientId).single();

    const cost = 15;
    
    // Free if sender is Special/Owner or Recipient is Special
    const isFree = sender?.is_owner || sender?.is_special_user || recipient?.is_special_user;

    if (sender?.gender === 'male' && !isFree && !sender.is_coin_seller) {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', payload.senderId).single();
      if ((Number(bal?.coins) || 0) < cost) return { success: false, error: "insufficient_funds" };
      await supabase.rpc("increment_coins", { p_user_id: payload.senderId, p_amount: -cost });
      await supabase.from("coin_history").insert({ user_id: payload.senderId, amount: -cost, type: "chat_cost", description: `Message`, timestamp });
    }
    
    await supabase.from('chats').upsert({ 
      id: payload.chatId, 
      last_message: payload.text.slice(0, 100), 
      last_message_at: timestamp, 
      participant_ids: [payload.senderId, payload.recipientId],
      last_sender_id: payload.senderId 
    }, { onConflict: 'id' });

    const { error: msgError } = await supabase.from('messages').insert({ chat_id: payload.chatId, text: payload.text, sender_id: payload.senderId, timestamp });
    if (msgError) throw msgError;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: "system_error" };
  }
}

export async function sendMysteryNoteAction(userId: string, message: string, recipients: number) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: sender } = await supabase.from('users').select('gender, name, is_special_user, is_owner').eq('uid', userId).single();
    const cost = (sender?.is_special_user || sender?.is_owner) ? 0 : recipients * 10;
    
    if (cost > 0) {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', userId).single();
      if ((Number(bal?.coins) || 0) < cost) throw new Error("Insufficient coins.");
      await supabase.rpc("increment_coins", { p_user_id: userId, p_amount: -cost });
      await supabase.from("coin_history").insert({ user_id: userId, amount: -cost, type: "mystery_note", description: `Blast to ${recipients} users`, timestamp: Date.now() });
    }

    const oppositeGender = sender?.gender === 'male' ? 'female' : 'male';
    const { data: targets } = await supabase.from('users').select('uid').eq('gender', oppositeGender).eq('onboarding_complete', true).neq('uid', userId).limit(recipients);

    if (!targets || targets.length === 0) throw new Error("No recipients found.");

    const ts = Date.now();
    for (const target of targets) {
      const ids = [userId, target.uid].sort();
      const chatId = `direct_${ids[0]}_${ids[1]}`;
      await supabase.from('chats').upsert({ 
        id: chatId, 
        participant_ids: [userId, target.uid], 
        last_message: message, 
        last_message_at: ts,
        last_sender_id: userId
      }, { onConflict: 'id' });
      await supabase.from('messages').insert({ chat_id: chatId, sender_id: userId, text: message, timestamp: ts });
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function reviewRecruitmentAction(applicantUid: string, status: 'approved' | 'rejected') {
  const supabase = getSupabaseAdmin();
  try {
    if (status === 'rejected') {
      await supabase.from('users').update({ agency_id: null, agency_status: null }).eq('uid', applicantUid);
    } else {
      await supabase.from('users').update({ agency_status: status }).eq('uid', applicantUid);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function requestWithdrawalAction(userUid: string, diamonds: number, amount_kes: number, agencyId: string) {
  const supabase = getSupabaseAdmin();
  try {
    const ts = Date.now();
    await supabase.rpc("increment_diamonds", { p_user_id: userUid, p_amount: -diamonds });
    await Promise.all([
      supabase.from('withdrawals').insert({ user_id: userUid, agency_id: agencyId, diamonds, amount_kes, status: 'pending', timestamp: ts }),
      supabase.from('diamond_history').insert({ user_id: userUid, amount: -diamonds, type: 'withdrawal', description: `Payout KES ${amount_kes}`, timestamp: ts })
    ]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function leaveAgencyAction(userUid: string) {
  const supabase = getSupabaseAdmin();
  try {
    await supabase.from('users').update({ agency_id: null, agency_status: null }).eq('uid', userUid);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createAgencyAction(agentUid: string, name: string) {
  const supabase = getSupabaseAdmin();
  try {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    await supabase.from('agencies').insert({ code, agent_uid: agentUid, name });
    await supabase.from('users').update({ agency_id: code, agency_status: 'approved', is_agent: true }).eq('uid', agentUid);
    return { success: true, code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function joinAgencyAction(userUid: string, code: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: user } = await supabase.from('users').select('gender').eq('uid', userUid).single();
    if (user?.gender !== 'female') throw new Error("Restricted.");
    const { data: agency } = await supabase.from('agencies').select('code').eq('code', code).maybeSingle();
    if (!agency) throw new Error("Invalid Code.");
    await supabase.from('users').update({ agency_id: code, agency_status: 'pending' }).eq('uid', userUid);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateWithdrawalStatusAction(requestId: string, status: 'paid' | 'rejected') {
  const supabase = getSupabaseAdmin();
  try {
    await supabase.from('withdrawals').update({ status }).eq('id', requestId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function convertDiamondsToCoinsAction(user_id: string, diamonds: number, coins: number) {
  const supabase = getSupabaseAdmin();
  try {
    const ts = Date.now();
    await supabase.rpc("increment_diamonds", { p_user_id: user_id, p_amount: -diamonds });
    await supabase.rpc("increment_coins", { p_user_id: user_id, p_amount: coins });
    await Promise.all([
      supabase.from('diamond_history').insert({ user_id, amount: -diamonds, type: 'conversion', description: `Exchanged`, timestamp: ts }),
      supabase.from('coin_history').insert({ user_id, amount: coins, type: 'conversion', description: `Exchanged`, timestamp: ts })
    ]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendGiftAction(senderUid: string, recipientUid: string, coinAmount: number, giftName: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: senderProfile } = await supabase.from('users').select('is_owner, is_special_user').eq('uid', senderUid).single();
    const isFree = senderProfile?.is_owner || senderProfile?.is_special_user;

    if (!isFree) {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', senderUid).single();
      if ((Number(bal?.coins) || 0) < coinAmount) throw new Error("Insufficient coins.");
      await supabase.rpc("increment_coins", { p_user_id: senderUid, p_amount: -coinAmount });
    }

    const { data: rec } = await supabase.from('users').select('gender, name').eq('uid', recipientUid).single();
    const { data: sender } = await supabase.from('users').select('name').eq('uid', senderUid).single();
    if(!rec || !sender) throw new Error("User not found");
    const ts = Date.now();
    const reward = Math.floor(coinAmount * (rec.gender === 'female' ? 0.5 : 0.4));
    
    await supabase.rpc("increment_diamonds", { p_user_id: recipientUid, p_amount: reward });
    const chatId = `direct_${[senderUid, recipientUid].sort()[0]}_${[senderUid, recipientUid].sort()[1]}`;
    
    await Promise.all([
      !isFree && supabase.from("coin_history").insert({ user_id: senderUid, amount: -coinAmount, type: "gift", description: `Sent ${giftName}`, timestamp: ts }),
      supabase.from("diamond_history").insert({ user_id: recipientUid, amount: reward, type: "gift", description: `Gift from ${sender.name}`, timestamp: ts }),
      supabase.from('messages').insert({ chat_id: chatId, sender_id: senderUid, text: `[Gift: ${giftName}]`, is_gift: true, timestamp: ts }),
      supabase.from('chats').upsert({ id: chatId, last_message: `[Gift: ${giftName}]`, last_message_at: ts, participant_ids: [senderUid, recipientUid], last_sender_id: senderUid })
    ].filter(Boolean));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
