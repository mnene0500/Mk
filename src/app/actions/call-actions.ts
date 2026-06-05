
'use server';

import { getSupabaseAdmin } from '@/lib/supabase';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

/**
 * @fileOverview Hardened Agora Token Generation and Billing Engine.
 * Rates: Audio 70/min, Video 150/min. 
 * Logic: 10s free preview, deduct at 11s, then at the start of every minute.
 * Added: Strict Real-time Busy Check with 2-minute expiry and stale ringing cleanup.
 */

export async function generateAgoraTokenAction(channelName: string, uid: string) {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    throw new Error("Agora Credentials missing in Vercel Settings.");
  }

  // Create a stable numeric UID from the string UID (32-bit unsigned int)
  const numericUid = Math.abs(uid.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)) >>> 0;
  const role = RtcRole.PUBLISHER;
  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    numericUid,
    role,
    privilegeExpiredTs,
    privilegeExpiredTs
  );

  return {
    appId,
    token,
    channelName,
    uid: numericUid
  };
}

export async function startCallAction(chatId: string, callerId: string, receiverId: string, type: 'video' | 'voice') {
  const supabase = getSupabaseAdmin();
  try {
    // 1. Check if receiver is in DND mode
    const { data: receiver } = await supabase.from('users').select('is_dnd, name').eq('uid', receiverId).single();
    if (receiver?.is_dnd) {
      return { success: false, error: `${receiver.name} has activated Do Not Disturb.` };
    }

    // 2. Real-time Stale Cleanup
    // Mark any call older than 2 minutes as ended if it's still 'active'
    // Mark any call older than 60 seconds as ended if it's still 'calling'
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const sixtySecsAgo = new Date(Date.now() - 60 * 1000).toISOString();

    await supabase.from('calls').update({ status: 'ended' })
      .or(`caller_id.eq.${receiverId},receiver_id.eq.${receiverId},caller_id.eq.${callerId}`)
      .in('status', ['calling', 'active'])
      .lt('created_at', sixtySecsAgo);

    // 3. Busy Check (Strict 2-minute window)
    const { data: activeCalls } = await supabase
      .from('calls')
      .select('id, status, created_at')
      .or(`caller_id.eq.${receiverId},receiver_id.eq.${receiverId}`)
      .in('status', ['calling', 'active'])
      .gt('created_at', twoMinsAgo);
    
    // Check if there is a TRULY active call or a VERY RECENT calling attempt
    const validBusyCall = activeCalls?.find(c => {
      if (c.status === 'active') return true;
      // Only consider 'calling' status as busy if it's newer than 60 seconds
      const createdAt = new Date(c.created_at).getTime();
      return (Date.now() - createdAt) < 60000;
    });

    if (validBusyCall) {
      return { success: false, error: `${receiver?.name || 'User'} is currently on another call.` };
    }

    const cost = type === 'video' ? 150 : 70;
    
    // 4. Check caller balance
    const { data: user } = await supabase.from('users').select('is_admin, is_coin_seller').eq('uid', callerId).single();
    if (!user?.is_admin && !user?.is_coin_seller) {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', callerId).single();
      if ((Number(bal?.coins) || 0) < cost) {
        return { success: false, error: "Insufficient coins." };
      }
    }

    // Clean up all previous calls for this caller to ensure fresh session
    await supabase.from('calls').update({ status: 'ended' })
      .eq('caller_id', callerId)
      .neq('status', 'ended');

    const { data, error } = await supabase.from('calls').insert({
      chat_id: chatId,
      caller_id: callerId,
      receiver_id: receiverId,
      type,
      status: 'calling'
    }).select().single();

    if (error) throw error;
    return { success: true, callId: data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function endCallAction(callId: string) {
  const supabase = getSupabaseAdmin();
  try {
    await supabase.from('calls').update({ status: 'ended' }).eq('id', callId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deductCallCoinsAction(uid: string, type: 'video' | 'voice', partnerId: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { data: user } = await supabase.from('users').select('is_admin, is_coin_seller, gender, name').eq('uid', uid).single();
    if (user?.is_admin || user?.is_coin_seller) return { success: true };

    const cost = type === 'video' ? 150 : 70;
    
    const { error: deductError } = await supabase.rpc("increment_coins", { p_user_id: uid, p_amount: -cost });
    if (deductError) throw new Error("Insufficient funds for next minute.");

    await supabase.from("coin_history").insert({
      user_id: uid,
      amount: -cost,
      type: "call_cost",
      description: `${type.toUpperCase()} Call Minute`,
      timestamp: Date.now()
    });

    // Reward the female recipient if the caller is male
    const { data: recipient } = await supabase.from('users').select('gender').eq('uid', partnerId).single();
    if (user?.gender === 'male' && recipient?.gender === 'female') {
      const reward = Math.floor(cost * 0.4); 
      await supabase.rpc("increment_diamonds", { p_user_id: partnerId, p_amount: reward });
      await supabase.from("diamond_history").insert({
        user_id: partnerId,
        amount: reward,
        type: "call_earning",
        description: `Call from ${user?.name || 'User'}`,
        timestamp: Date.now()
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
