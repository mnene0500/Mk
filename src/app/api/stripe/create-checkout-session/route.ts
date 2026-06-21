import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://qivo10.vercel.app";

function getStripe() {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    throw new Error("Missing STRIPE_SECRET_KEY in environment.");
  }
  return new Stripe(stripeSecret, { apiVersion: "2023-11-15" });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, amount, coins, packageId } = body;

  if (!userId || !amount || !coins) {
    return NextResponse.json(
      { success: false, error: "Missing payment details." },
      { status: 400 }
    );
  }

  const amountInCents = Math.round(Number(amount) * 100);
  if (amountInCents <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid amount." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "kes",
          product_data: {
            name: `${coins} QIVO Coins`,
            description: `Recharge package: ${coins} coins`
          },
          unit_amount: amountInCents
        },
        quantity: 1
      }
    ],
    mode: "payment",
    success_url: `${appUrl}/payment-success?source=stripe&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/recharge`,
    metadata: {
      user_id: userId,
      coins: String(coins),
      package_id: packageId || ""
    }
  });

  const supabase = getSupabaseAdmin();
  await supabase.from("pending_payments").insert({
    order_id: session.id,
    user_id: userId,
    amount: amount,
    status: "pending",
    payment_method: "Stripe"
  });

  return NextResponse.json({ success: true, url: session.url });
}
