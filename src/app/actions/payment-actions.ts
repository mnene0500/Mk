'use server';

import { PESAPAL_CONFIG } from '@/lib/pesapal-config';
import { initializeFirebase } from '@/firebase';
import { ref, update, increment, push, set, get } from 'firebase/database';

/**
 * @fileOverview PesaPal integration actions for API v3.
 */

export interface TransactionStatusResponse {
  amount: number;
  currency: string;
  status_code: number;
  payment_method: string;
}

/**
 * Authenticates with PesaPal and returns an access token.
 */
export async function getAccessToken(): Promise<string> {
  const response = await fetch(`${PESAPAL_CONFIG.API_BASE_URL}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      consumer_key: PESAPAL_CONFIG.CONSUMER_KEY,
      consumer_secret: PESAPAL_CONFIG.CONSUMER_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch PesaPal access token. Check your Consumer Key/Secret.');
  }

  const data = await response.json();
  return data.token;
}

/**
 * Initiates a payment request with PesaPal.
 */
export async function initiatePesaPalPayment(amount: number, user: { uid: string, email: string, name: string }) {
  try {
    if (!PESAPAL_CONFIG.IPN_ID) {
      return { 
        success: false, 
        error: "System Configuration Error: PESAPAL_IPN_ID is missing. Please contact an Administrator to run diagnostics at /pesapal-admin." 
      };
    }

    const token = await getAccessToken();
    const merchantReference = `QV_${user.uid}_${Date.now()}`;
    
    const payload = {
      id: merchantReference,
      currency: "KES",
      amount: amount,
      description: `QIVO Coin Recharge for ${user.name}`,
      callback_url: PESAPAL_CONFIG.CALLBACK_URL,
      notification_id: PESAPAL_CONFIG.IPN_ID,
      billing_address: {
        email_address: user.email,
        phone_number: "",
        country_code: "KE",
        first_name: user.name.split(' ')[0] || "User",
        last_name: user.name.split(' ')[1] || "QIVO",
        line_1: "Nairobi",
        line_2: "",
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

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || 'PesaPal rejected the order request.' };
    }

    const data = await response.json();
    return { success: true, redirect_url: data.redirect_url, order_tracking_id: data.order_tracking_id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetches the status of a transaction from PesaPal.
 */
export async function getTransactionStatus(orderTrackingId: string): Promise<TransactionStatusResponse | null> {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${PESAPAL_CONFIG.API_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      amount: Number(data.amount || 0),
      currency: data.currency || 'KES',
      status_code: Number(data.status_code),
      payment_method: data.payment_method || 'Unknown'
    };
  } catch (error) {
    console.error("[PesaPal] Status Fetch Error:", error);
    return null;
  }
}

/**
 * Securely fulfills a payment by checking status and updating RTDB.
 * This is the CORE logic that awards coins.
 */
export async function fulfillPaymentAction(orderTrackingId: string, merchantReference: string) {
  console.log(`[Fulfillment Start] Tracking: ${orderTrackingId}, Ref: ${merchantReference}`);
  
  try {
    const status = await getTransactionStatus(orderTrackingId);
    console.log(`[PesaPal Response] Status Code: ${status?.status_code}, Amount: ${status?.amount}`);
    
    // Status Code 1 = Completed/Success in PesaPal v3
    if (status && (Number(status.status_code) === 1)) {
      const { database: rtdb } = initializeFirebase();
      
      // 1. Extract UID from Reference Format: QV_{uid}_{timestamp}
      const parts = merchantReference.split('_');
      const uid = parts[1];
      const amount = Number(status.amount);

      if (!uid) {
        console.error("[Fulfillment Error] Invalid Reference (No UID):", merchantReference);
        return { success: false, error: "Invalid Reference Format" };
      }

      // 2. Idempotency Check: Prevent duplicate coin awards
      const processedRef = ref(rtdb, `processed_payments/${orderTrackingId}`);
      const snap = await get(processedRef);
      if (snap.exists()) {
        console.log("[Fulfillment] Order already processed. Skipping award.");
        return { success: true, message: "Already fulfilled", coins: snap.val().coins };
      }

      // 3. Map Amount to Coins
      let coinsToAward = 0;
      if (amount >= 1800) coinsToAward = 20000;
      else if (amount >= 1000) coinsToAward = 10000;
      else if (amount >= 550) coinsToAward = 5000;
      else if (amount >= 230) coinsToAward = 2000;
      else if (amount >= 120) coinsToAward = 1000;
      else if (amount >= 80) coinsToAward = 500;
      else if (amount >= 0.5) coinsToAward = 200; // Test package mapping

      if (coinsToAward > 0) {
        const timestamp = Date.now();
        const updates: any = {};
        
        // 4. ATOMIC REALTIME UPDATE
        // Give Coins
        updates[`balances/${uid}/coins`] = increment(coinsToAward);
        updates[`balances/${uid}/updatedAt`] = timestamp;
        
        // Record as processed
        updates[`processed_payments/${orderTrackingId}`] = {
          uid,
          amount,
          coins: coinsToAward,
          timestamp,
          payment_method: status.payment_method || 'pesapal'
        };

        await update(ref(rtdb), updates);

        // 5. Update History Ledger
        const historyRef = push(ref(rtdb, `coin_history/${uid}`));
        await set(historyRef, {
          amount: coinsToAward,
          type: 'recharge',
          description: `PesaPal Recharge: KES ${amount}`,
          timestamp
        });

        console.log(`[Fulfillment SUCCESS] Awarded ${coinsToAward} coins to user ${uid}`);
        return { success: true, coins: coinsToAward };
      } else {
        console.error("[Fulfillment Error] No coin package found for amount:", amount);
        return { success: false, error: "No matching package found" };
      }
    }
    
    console.warn(`[Fulfillment Pending] Transaction ${orderTrackingId} is not in success state (Status: ${status?.status_code})`);
    return { success: false, error: "Payment not completed" };
  } catch (err: any) {
    console.error("[Fulfillment Critical Error]:", err.message);
    return { success: false, error: err.message };
  }
}

export async function registerIPN() {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${PESAPAL_CONFIG.API_BASE_URL}/api/URLSetup/RegisterIPN`, {
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
    return await response.json();
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getIpnList() {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${PESAPAL_CONFIG.API_BASE_URL}/api/URLSetup/GetIpnList`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return await response.json();
  } catch (error: any) {
    return { error: error.message };
  }
}
