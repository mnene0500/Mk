'use server';

import { supabase } from '@/lib/supabase';

/**
 * Deducts coins from a user for an active call using Supabase.
 */
export async function deductCallCoinsAction(uid: string, type: 'video' | 'voice', partnerName: string) {
  const cost = type === 'video' ? 150 : 70;

  try {
    const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', uid).maybeSingle();
    const currentCoins = Number(bal?.coins) || 0;

    if (currentCoins < cost) return { success: false, error: "Insufficient balance." };

    await supabase.from('balances').update({ coins: currentCoins - cost }).eq('user_id', uid);
    await supabase.from('coin_history').insert({
      user_id: uid,
      amount: -cost,
      type: 'call',
      description: `${type} call with ${partnerName}`,
      timestamp: Date.now()
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function checkCallBalanceAction(uid: string, type: 'video' | 'voice') {
  const minRequired = type === 'video' ? 150 : 70;
  try {
    const { data } = await supabase.from('balances').select('coins').eq('user_id', uid).maybeSingle();
    const coins = Number(data?.coins) || 0;
    if (coins < minRequired) return { success: false, error: "Low balance." };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
