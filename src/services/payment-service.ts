
import { supabase } from '@/lib/supabase';

export async function processFulfillment(orderTrackingId: string, user_id: string) {
  try {
    const { data, error } = await supabase.functions.invoke('payment-ops', {
      body: { 
        action: 'fulfill',
        orderTrackingId,
        user_id
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
