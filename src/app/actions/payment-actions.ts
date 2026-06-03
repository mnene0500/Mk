
'use server';

import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * @fileOverview Production PesaPal V3 Integration.
 * Strictly uses Vercel environment variables for gateway credentials.
 */

const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3";

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
  if (!data.token) {
    console.error("[PesaPal Auth Error]:", data);
    throw new Error("PesaPal Authentication Failed. Check credentials in Vercel.");
  }
  return data.token;
}

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
      description: `Purchase of ${coins} Coins on QIVO`,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success`,
      notification_id: process.env.PESAPAL_IPN_ID,
      billing_address: {
        email_address: "payment@qivo.com"
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
    
    // Status Code 1 is "Completed" in PesaPal v3
    if (data.status_code === 1 || data.payment_status_description === "Completed") {
      const supabase = getSupabaseAdmin();
      
      // Check if already processed
      const { data: existing } = await supabase.from('processed_payments').select('*').eq('order_tracking_id', orderTrackingId).maybeSingle();
      if (existing) return { success: true, coins: existing.coins, message: "Already processed." };

      // Get the original tracking record
      const { data: pending } = await supabase.from('pending_payments').select('*').eq('order_id', merchantReference).single();
      if (!pending) throw new Error("Payment record matching this reference not found.");

      let coins = 0;
      const amt = Number(pending.amount);
      
      // Tiered Coin Logic (Synced with Recharge Packages)
      if (amt === 1) coins = 5;
      else if (amt === 80) coins = 500;
      else if (amt === 120) coins = 1000;
      else if (amt === 600) coins = 5000;
      else if (amt === 800) coins = 7000;
      else if (amt === 1000) coins = 10000;
      else if (amt === 1500) coins = 15000;
      else if (amt === 2000) coins = 20000;
      else coins = Math.floor(amt * 8.33);

      // Atomic Update
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
