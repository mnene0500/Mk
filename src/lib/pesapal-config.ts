/**
 * @fileOverview Configuration for PesaPal v3 API.
 * Defaults are now set for the Production environment.
 */

export const PESAPAL_CONFIG = {
  CONSUMER_KEY: process.env.PESAPAL_CONSUMER_KEY || '',
  CONSUMER_SECRET: process.env.PESAPAL_CONSUMER_SECRET || '',
  // Defaulting to Live Production URL
  API_BASE_URL: process.env.PESAPAL_API_BASE_URL || 'https://pay.pesapal.com/v3',
  IPN_URL: process.env.PESAPAL_IPN_URL || 'https://qivo-gamma.vercel.app/api/pesapal/callback',
  CALLBACK_URL: process.env.PESAPAL_CALLBACK_URL || 'https://qivo-gamma.vercel.app/recharge',
  IPN_ID: process.env.PESAPAL_IPN_ID || '',
};
