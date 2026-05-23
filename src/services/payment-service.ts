
import { supabase } from '@/lib/supabase';

/**
 * @fileOverview Fulfillment logic standardized to call 'fulfill' on payment-ops.
 * This is used by the IPN callback route.
 */

export async function processFulfillment(orderTrackingId: string, user_uid: string) {
  try {
    // Standardized to 'fulfill' to match Edge Function logic
    const { data, error } = await supabase.functions.invoke('payment-ops', {
      body: { 
        action: 'fulfill',
        orderTrackingId,
        user_uid
      }
    });

    if (error) {
      console.error("[Fulfillment Service Error]:", error.message);
      return { success: false, error: error.message };
    }
    
    return data || { success: false, error: "Verification failed." };
  } catch (err: any) { 
    console.error("[Fulfillment Service Crash]:", err.message);
    return { success: false, error: err.message }; 
  }
}
