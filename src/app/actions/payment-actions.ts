
'use server';

import { supabase } from '@/lib/supabase';

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
      return { success: false, error: `Gateway connection failed: ${error.message}` };
    }

    return data;
  } catch (err: any) { 
    return { success: false, error: "Critical payment system failure." }; 
  }
}

export async function verifyPaymentAction(orderTrackingId: string, user_id: string) {
  try {
    const { data, error } = await supabase.functions.invoke('payment-ops', {
      body: { 
        action: 'fulfill',
        orderTrackingId,
        user_id
      }
    });

    if (error) {
      console.error("[Verify Action Error]:", error.message);
      return { success: false, error: error.message };
    }
    
    return data || { success: false, error: "Verification failed." };
  } catch (err: any) { 
    return { success: false, error: "Internal verification service offline." }; 
  }
}
