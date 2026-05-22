'use server';

import { supabase } from '@/lib/supabase';
import { PESAPAL_CONFIG } from '@/lib/pesapal-config';

/**
 * @fileOverview PesaPal Proxy Actions.
 * These actions now invoke Supabase Edge Functions to perform the actual 
 * API calls with PesaPal, keeping your Consumer Keys secure in Supabase.
 */

export async function initiatePesaPalPayment(amount: number, user: { uid: string, email: string, name: string }) {
  try {
    const { data, error } = await supabase.functions.invoke('payment-ops', {
      body: { 
        action: 'initiate',
        amount,
        user,
        callback_url: PESAPAL_CONFIG.CALLBACK_URL
      }
    });

    if (error) throw error;
    return data;
  } catch (error: any) { return { success: false, error: error.message }; }
}

export async function fulfillPaymentAction(orderTrackingId: string, merchantReference: string) {
  try {
    const { data, error } = await supabase.functions.invoke('payment-ops', {
      body: { 
        action: 'fulfill',
        orderTrackingId,
        merchantReference
      }
    });

    if (error) throw error;
    return data;
  } catch (err: any) { 
    console.error("[Payment Fulfillment Proxy Error]", err);
    return { success: false, error: err.message }; 
  }
}

export async function registerIPN() {
  try {
    const { data, error } = await supabase.functions.invoke('payment-ops', {
      body: { action: 'register-ipn', ipn_url: PESAPAL_CONFIG.IPN_URL }
    });
    if (error) throw error;
    return data;
  } catch (error: any) { return { error: error.message }; }
}

export async function getIpnList() {
  try {
    const { data, error } = await supabase.functions.invoke('payment-ops', {
      body: { action: 'get-ipn-list' }
    });
    if (error) throw error;
    return data;
  } catch (error: any) { return { error: error.message }; }
}
