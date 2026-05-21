
'use server';

import { PESAPAL_CONFIG } from '@/lib/pesapal-config';
import { supabase } from '@/lib/supabase';

/**
 * @fileOverview PesaPal integration actions for API v3 using Supabase.
 * Optimized for reliable fulfillment and transaction logging.
 */

export interface TransactionStatusResponse {
  amount: number;
  currency: string;
  status_code: number;
  payment_method: string;
}

export async function getAccessToken(): Promise<string> {
  const consumerKey = PESAPAL_CONFIG.CONSUMER_KEY;
  const consumerSecret = PESAPAL_CONFIG.CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('PesaPal Configuration Error: Missing Keys');
  }

  try {
    const response = await fetch(`${PESAPAL_CONFIG.API_BASE_URL}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get PesaPal token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
  } catch (err: any) {
    console.error("[PesaPal Auth] Exception:", err.message);
    throw err;
  }
}

export async function registerIPN() {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${PESAPAL_CONFIG.API_BASE_URL}/api/Services/RegisterIPN`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        url: PESAPAL_CONFIG.IPN_URL,
        ipn_notification_type: 'GET',
      }),
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getIpnList() {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${PESAPAL_CONFIG.API_BASE_URL}/api/Services/GetIPNList`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function initiatePesaPalPayment(amount: number, user: { uid: string, email: string, name: string }) {
  try {
    const ipnId = PESAPAL_CONFIG.IPN_ID;
    if (!ipnId) {
      return { success: false, error: "Configuration Error: IPN ID missing." };
    }

    const token = await getAccessToken();
    const merchantReference = `QV_${user.uid}_${Date.now()}`;
    
    const payload = {
      id: merchantReference,
      currency: "KES",
      amount: amount,
      description: `QIVO Recharge for ${user.name}`,
      callback_url: PESAPAL_CONFIG.CALLBACK_URL,
      notification_id: ipnId,
      billing_address: {
        email_address: user.email,
        phone_number: "",
        country_code: "KE",
        first_name: user.name.split(' ')[0] || "User",
        last_name: user.name.split(' ')[1] || "QIVO",
        line_1: "Nairobi",
        city: "Nairobi",
        state: "Nairobi",
        postal_code: "00100",
        zip_code: "00100"
      }
    };

    const response = await fetch(`${PESAPAL_CONFIG.API_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'PesaPal rejected the order.' };

    return { success: true, redirect_url: data.redirect_url, order_tracking_id: data.order_tracking_id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fulfills a payment by awarding coins to the user.
 * Uses UPSERT to ensure the balance record exists.
 */
export async function fulfillPaymentAction(orderTrackingId: string, merchantReference: string) {
  try {
    const token = await getAccessToken();
    const statusRes = await fetch(`${PESAPAL_CONFIG.API_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    
    if (!statusRes.ok) return { success: false, error: "Status check failed" };
    const status = await statusRes.json();
    
    // status_code 1 = Success
    if (status && status.status_code === 1) {
      const uid = merchantReference.split('_')[1];
      if (!uid) return { success: false, error: "Invalid Ref" };

      // 1. Check if already processed to prevent double crediting
      const { data: existing } = await supabase
        .from('processed_payments')
        .select('*')
        .eq('order_tracking_id', orderTrackingId)
        .maybeSingle();

      if (existing) {
        console.log(`[Payment] Order ${orderTrackingId} already processed.`);
        return { success: true, coins: existing.coins };
      }

      const amount = Number(status.amount);
      // Award Logic: KES 1 = 10 Coins
      let coinsToAward = Math.floor(amount * 10);
      const timestamp = Date.now();

      // 2. Fetch current balance
      const { data: balData, error: fetchErr } = await supabase
        .from('balances')
        .select('coins')
        .eq('user_id', uid)
        .maybeSingle();

      const currentCoins = balData?.coins || 0;
      
      // 3. Update or Create Balance (UPSERT is more reliable)
      const { error: upsertErr } = await supabase
        .from('balances')
        .upsert({ 
          user_id: uid, 
          coins: currentCoins + coinsToAward,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (upsertErr) {
        console.error("[Payment] Balance Update Error:", upsertErr.message);
        throw upsertErr;
      }
      
      // 4. Log Recharge History
      await supabase.from('coin_history').insert({ 
        user_id: uid, 
        amount: coinsToAward, 
        type: 'recharge', 
        description: `PesaPal: KES ${amount} Recharge`, 
        timestamp 
      });
      
      // 5. Mark payment as processed
      await supabase.from('processed_payments').insert({ 
        order_tracking_id: orderTrackingId, 
        user_id: uid, 
        amount, 
        coins: coinsToAward, 
        payment_method: status.payment_method || 'pesapal', 
        timestamp 
      });

      console.log(`[Payment] Successfully awarded ${coinsToAward} coins to ${uid}`);
      return { success: true, coins: coinsToAward };
    }
    
    return { success: false, error: `Payment not completed (Status: ${status.status_code})` };
  } catch (err: any) {
    console.error("[Payment] Fulfillment Critical Error:", err.message);
    return { success: false, error: err.message };
  }
}
