
import { verifyPaymentAction } from '@/app/actions/payment-actions';

/**
 * @fileOverview Standardized Payment Service.
 * Now purely uses Vercel Server Actions instead of Supabase Functions.
 */
export async function processFulfillment(orderTrackingId: string, user_id: string) {
  try {
    return await verifyPaymentAction(orderTrackingId, user_id);
  } catch (err: any) { 
    console.error("[Fulfillment Service Crash]:", err.message);
    return { success: false, error: err.message }; 
  }
}
