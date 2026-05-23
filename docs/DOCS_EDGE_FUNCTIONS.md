

# QIVO Final Production Edge Functions

Update your Supabase Edge Functions with these logic blocks to ensure coins, diamonds, and history are synchronized perfectly.

## 1. Function Name: `payment-ops`
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const PESA_ENV = "https://pay.pesapal.com/v3"

async function getPesapalToken() {
  const res = await fetch(`${PESA_ENV}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consumer_key: Deno.env.get("PESAPAL_CONSUMER_KEY"),
      consumer_secret: Deno.env.get("PESAPAL_CONSUMER_SECRET"),
    }),
  })
  const data = await res.json()
  return data.token
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const body = await req.json()
    const { action } = body

    if (action === "initiate") {
      const { amount, user } = body
      const token = await getPesapalToken()
      const orderId = crypto.randomUUID()
      
      const order = {
        id: orderId,
        currency: "KES",
        amount: Number(amount),
        description: "QIVO Coins Recharge",
        callback_url: "https://qivo-gamma.vercel.app/recharge",
        notification_id: Deno.env.get("PESAPAL_IPN_ID"),
        billing_address: { email_address: user.email || "user@qivo.app" },
      }

      const res = await fetch(`${PESA_ENV}/api/Transactions/SubmitOrderRequest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(order),
      })
      const data = await res.json()
      return new Response(JSON.stringify({ success: true, redirect_url: data.redirect_url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (action === "fulfill") {
      const { orderTrackingId, user_uid } = body
      const token = await getPesapalToken()
      
      const verifyRes = await fetch(`${PESA_ENV}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
      const statusData = await verifyRes.json()

      if (statusData.payment_status_description === "Completed") {
        const paidAmount = Number(statusData.amount)
        let coins = 0
        
        // Match Packages
        if (paidAmount === 1) coins = 200
        else if (paidAmount === 80) coins = 500
        else if (paidAmount === 120) coins = 1000
        else if (paidAmount === 230) coins = 2000
        else if (paidAmount === 550) coins = 5000
        else if (paidAmount === 1000) coins = 10000
        else if (paidAmount === 1800) coins = 20000
        else coins = Math.floor(paidAmount * 6.25)

        const { data: existing } = await supabase.from('processed_payments').select('order_tracking_id').eq('order_tracking_id', orderTrackingId).maybeSingle()
        if (existing) return new Response(JSON.stringify({ success: true, message: "Already fulfilled" }), { headers: corsHeaders })

        await supabase.rpc("increment_coins", { user_uid, amount: coins })
        await supabase.from('processed_payments').insert({ order_tracking_id: orderTrackingId, user_id: user_uid, amount: paidAmount, coins })
        
        await supabase.from("coin_history").insert({
          user_id: user_uid,
          amount: coins,
          type: "recharge",
          description: "PesaPal Recharge",
          timestamp: Date.now()
        })

        return new Response(JSON.stringify({ success: true, coins_added: coins }), { headers: corsHeaders })
      }
      return new Response(JSON.stringify({ success: false, message: "Payment not completed" }), { headers: corsHeaders })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 200, headers: corsHeaders })
  }
})
```

## 2. Function Name: `calling-ops`
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { action, uid, type, partnerId } = await req.json()

    if (action === "check-balance") {
      const { data: bal } = await supabase.from('balances').select('coins').eq('user_id', uid).single()
      const { data: user } = await supabase.from('users').select('is_admin, is_coin_seller').eq('uid', uid).single()
      if (user?.is_admin || user?.is_coin_seller) return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
      
      const cost = type === 'video' ? 150 : 70
      if ((bal?.coins || 0) < cost) throw new Error("Insufficient coins for next minute.")
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }

    if (action === "deduct-coins") {
      const cost = type === 'video' ? 150 : 70
      const ts = Date.now()
      
      await supabase.rpc("increment_coins", { user_uid: uid, amount: -cost })
      await supabase.from("coin_history").insert({ user_id: uid, amount: -cost, type: "call_cost", description: `${type.toUpperCase()} Call Minute`, timestamp: ts })

      const { data: caller } = await supabase.from('users').select('gender, name').eq('uid', uid).single()
      const { data: recipient } = await supabase.from('users').select('gender').eq('uid', partnerId).single()

      if (caller?.gender === 'male' && recipient?.gender === 'female') {
        await supabase.rpc("increment_diamonds", { user_id: partnerId, amount: 50 })
        await supabase.from("diamond_history").insert({
          user_id: partnerId,
          amount: 50,
          type: "call_earning",
          description: `Call from ${caller?.name || 'User'}`,
          timestamp: ts
        })
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 200, headers: corsHeaders })
  }
})
```

## 3. Function Name: `economy-ops`
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { action, ...params } = await req.json()
    const ts = Date.now()

    if (action === "send-gift") {
      const { senderUid, recipientUid, coinAmount, giftName } = params
      const ids = [senderUid, recipientUid].sort()
      const chatId = `direct_${ids[0]}_${ids[1]}`
      
      // 1. Deduct Sender
      await supabase.rpc("increment_coins", { user_uid: senderUid, amount: -coinAmount })
      await supabase.from("coin_history").insert({ user_id: senderUid, amount: -coinAmount, type: "gift_sent", description: `Sent ${giftName}`, timestamp: ts })

      // 2. Fetch Recipient for Rates
      const { data: rec } = await supabase.from('users').select('gender, name').eq('uid', recipientUid).single()
      const { data: sender } = await supabase.from('users').select('name').eq('uid', senderUid).single()
      
      const rate = rec?.gender === 'female' ? 0.5 : 0.4
      const diamondReward = coinAmount * rate

      // 3. Award Recipient
      await supabase.rpc("increment_diamonds", { user_id: recipientUid, amount: diamondReward })
      await supabase.from("diamond_history").insert({ 
        user_id: recipientUid, 
        amount: diamondReward, 
        type: "gift_received", 
        description: `Gift from ${sender?.name || 'User'}`, 
        timestamp: ts 
      })

      // 4. INSERT INTO CHAT CONVERSATION
      const giftMsg = `[Gift: ${giftName}]`
      await supabase.from('messages').insert({ chat_id: chatId, sender_id: senderUid, text: giftMsg, is_gift: true, timestamp: ts })
      await supabase.from('chats').upsert({ id: chatId, last_message: giftMsg, last_message_at: ts, participant_ids: [senderUid, recipientUid] })

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }

    if (action === "daily-check-in") {
      const { uid } = params
      const { data: user } = await supabase.from("users").select("*").eq("uid", uid).single()
      if (!user) throw new Error("Profile not found")
      
      const streak = (user.check_in_streak || 0) + 1
      const rewards = [2, 2, 5, 2, 2, 2, 10]
      const amount = rewards[(streak - 1) % 7]

      await supabase.from("users").update({ last_check_in_date: new Date().toISOString(), check_in_streak: streak }).eq("uid", uid)
      await supabase.rpc("increment_coins", { user_uid: uid, amount })
      await supabase.from("coin_history").insert({ user_id: uid, amount, type: "checkin", description: `Daily Check-in Day ${streak}`, timestamp: ts })
      
      return new Response(JSON.stringify({ success: true, amount, day: streak }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 200, headers: corsHeaders })
  }
})
```
