'use server';

import { getSupabaseAdmin } from '@/lib/supabase';

const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://qivo-five.vercel.app";

async function getAuthToken() {
  const res = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
    })
  });
  const data = await res.json();
  if (!data.token) throw new Error("PesaPal Auth Failed. Check your Consumer Key/Secret.");
  return data.token;
}

/**
 * Initiates a PesaPal Payment
 */
export async function initiatePesaPalPayment(userId: string, amount: number, coins: number) {
  const supabase = getSupabaseAdmin();
  try {
    const token = await getAuthToken();
    const orderId = crypto.randomUUID();

    // 1. Create a tracking record
    await supabase.from('pending_payments').insert({
      order_id: orderId,
      user_id: userId,
      amount: amount,
      status: 'pending'
    });

    const payload = {
      id: orderId,
      currency: "KES",
      amount: amount,
      description: `Purchase of ${coins} Coins`,
      callback_url: `${APP_URL}/payment-success`,
      notification_id: process.env.PESAPAL_IPN_ID,
      billing_address: {
        email_address: "user@qivo.com"
      }
    };

    const res = await fetch(`${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.redirect_url) {
      return { success: true, redirect_url: data.redirect_url };
    }
    throw new Error(data.error?.message || "Gateway response invalid.");
  } catch (err: any) {
    console.error("[PesaPal Initiation Error]:", err.message);
    return { success: false, error: err.message };
  }
}

export async function verifyPaymentAction(orderTrackingId: string, merchantReference: string) {
  try {
    const token = await getAuthToken();
    const res = await fetch(`${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await res.json();
    
    if (data.status_code === 1 || data.payment_status_description === "Completed") {
      const supabase = getSupabaseAdmin();
      
      const { data: existing } = await supabase.from('processed_payments').select('*').eq('order_tracking_id', orderTrackingId).maybeSingle();
      if (existing) return { success: true, coins: existing.coins, message: "Already processed." };

      const { data: pending } = await supabase.from('pending_payments').select('*').eq('order_id', merchantReference).single();
      if (!pending) throw new Error("Payment record matching this reference not found.");

      let coins = 0;
      const amt = Number(pending.amount);
      
      // Tiered Coin Logic
      if (amt === 80) coins = 500;
      else if (amt === 120) coins = 1000;
      else if (amt === 600) coins = 5000;
      else if (amt === 800) coins = 7000;
      else if (amt === 1000) coins = 10000;
      else if (amt === 1500) coins = 15000;
      else if (amt === 2000) coins = 20000;
      else coins = Math.floor(amt * 8.33);

      const { error: rpcErr } = await supabase.rpc("increment_coins", { p_user_id: pending.user_id, p_amount: coins });
      if (rpcErr) throw rpcErr;

      await Promise.all([
        supabase.from('processed_payments').insert({
          order_tracking_id: orderTrackingId,
          user_id: pending.user_id,
          amount: pending.amount,
          coins: coins,
          payment_method: data.payment_method || 'PesaPal'
        }),
        supabase.from('coin_history').insert({
          user_id: pending.user_id,
          amount: coins,
          type: 'purchase',
          description: `PesaPal Top-up: ${pending.amount} KES`,
          timestamp: Date.now()
        }),
        supabase.from('pending_payments').update({ status: 'completed' }).eq('order_id', merchantReference)
      ]);

      return { success: true, coins };
    }
    
    return { success: false, error: "Payment is still processing at PesaPal." };
  } catch (err: any) {
    console.error("[Verification Error]:", err.message);
    return { success: false, error: err.message };
  }
}
