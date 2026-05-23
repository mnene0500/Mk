import { NextResponse } from 'next/server';

/**
 * @fileOverview PesaPal IPN Registration Tool.
 * Use this once to get your IPN_ID for Vercel environment variables.
 */

const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3"; // Production

async function getAuthToken() {
  const res = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
    })
  });
  const data = await res.json();
  return data.token;
}

export async function GET() {
  try {
    const token = await getAuthToken();
    if (!token) throw new Error("Could not authenticate with PesaPal. Check your Keys in Vercel.");

    const payload = {
      url: "https://qivo-gamma.vercel.app/api/pesapal/callback",
      ipn_notification_type: "GET"
    };

    const res = await fetch(`${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (data.ipn_id) {
      return NextResponse.json({
        success: true,
        message: "IPN Registered Successfully",
        ipn_id: data.ipn_id,
        instruction: "Copy the 'ipn_id' above and add it to Vercel Environment Variables as PESAPAL_IPN_ID"
      });
    }

    return NextResponse.json({ success: false, error: data }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
