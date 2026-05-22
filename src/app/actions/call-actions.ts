'use server';

import { supabase } from '@/lib/supabase';

/**
 * @fileOverview Secure Call Actions via Supabase Edge Functions.
 * Fetches ZegoCloud configuration and handles per-minute billing.
 */

export async function getZegoConfigAction() {
  try {
    const { data, error } = await supabase.functions.invoke('calling-ops', {
      body: { action: 'get-config' }
    });

    if (error || !data.success) {
      return { success: false, error: data?.error || "Calling service unavailable." };
    }

    return {
      success: true,
      appId: data.appId,
      serverSecret: data.serverSecret
    };
  } catch (err: any) {
    return { success: false, error: "Connection to calling service failed." };
  }
}

/**
 * Invokes Supabase Edge Function to deduct coins and award diamonds.
 * This ensures the Zego secret and billing logic remain in the Supabase environment.
 */
export async function deductCallCoinsAction(uid: string, type: 'video' | 'voice', partnerId: string, partnerName: string) {
  try {
    const { data, error } = await supabase.functions.invoke('calling-ops', {
      body: { 
        action: 'deduct-coins',
        uid,
        type,
        partnerId,
        partnerName
      }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Billing Invocation Error:", error.message);
    return { success: false, error: error.message };
  }
}

export async function checkCallBalanceAction(uid: string, type: 'video' | 'voice') {
  try {
    const { data, error } = await supabase.functions.invoke('calling-ops', {
      body: { action: 'check-balance', uid, type }
    });

    if (error) throw error;
    return data;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
