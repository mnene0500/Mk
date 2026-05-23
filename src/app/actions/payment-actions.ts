
'use server';

import { supabase } from '@/lib/supabase';

/**
 * @fileOverview Production Payment Actions.
 * Matches the Edge Function logic (initiate / fulfill).
 */

export async function initiatePesaPalPayment(amount: number, user: { uid: string, email: string, name: string }) {
  try {
    const { data, error } = await supabase.functions.invoke('payment-ops', {
      body: { 
        action: 'initiate',
        amount,
        user
      }
    });

    if (error) {
      console.error("[Payment Error] Edge Function Invocation:", error);
      return { success: false, error: `Backend Error: ${error.message}` };
    }

    if (!data.success) {
      return { success: false, error: data.error || "Gateway rejected the request." };
    }

    return data;
  } catch (err: any) { 
    console.error("[Payment Crash] Exception:", err);
    return { success: false, error: "Critical payment system failure." }; 
  }
}

export async function verifyPaymentAction(orderTrackingId: string, user_uid: string) {
  try {
    // Calling 'fulfill' as per the latest production implementation
    const { data, error } = await supabase.functions.invoke('payment-ops', {
      body: { 
        action: 'fulfill',
        orderTrackingId,
        user_uid
      }
    });

    if (error) {
      console.error("[Verify Action Error]:", error.message);
      return { success: false, error: error.message };
    }
    
    return data || { success: false, error: "Empty verification response." };
  } catch (err: any) { 
    console.error("[Verify Action Crash]:", err.message);
    return { success: false, error: "Internal verification service offline." }; 
  }
}
