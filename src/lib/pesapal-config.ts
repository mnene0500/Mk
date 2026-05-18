/**
 * @fileOverview Configuration for PesaPal v3 API.
 * Ensure these environment variables are set in your deployment environment.
 */

export const PESAPAL_CONFIG = {
  CONSUMER_KEY: process.env.PESAPAL_CONSUMER_KEY || '',
  CONSUMER_SECRET: process.env.PESAPAL_CONSUMER_SECRET || '',
  API_BASE_URL: process.env.PESAPAL_API_BASE_URL || 'https://cybqa.pesapal.com/pesapalv3', // Default to sandbox
  IPN_URL: process.env.PESAPAL_IPN_URL || '',
  CALLBACK_URL: process.env.PESAPAL_CALLBACK_URL || '',
  IPN_ID: process.env.PESAPAL_IPN_ID || '',
};
