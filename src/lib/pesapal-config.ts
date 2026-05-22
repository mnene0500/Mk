/**
 * @fileOverview Minimal PesaPal Configuration for QIVO.
 * Logic and keys have been moved to Supabase Edge Functions for production security.
 */

export const PESAPAL_CONFIG = {
  // These are now public identifiers used only for routing/display
  IPN_URL: 'https://qivo-gamma.vercel.app/api/pesapal/callback',
  CALLBACK_URL: 'https://qivo-gamma.vercel.app/recharge',
};
