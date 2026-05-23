
"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react"
import { verifyPaymentAction } from "@/app/actions/payment-actions"
import { cn } from "@/lib/utils"

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  
  const [countdown, setCountdown] = useState(5)
  const [status, setStatus] = useState<'verifying' | 'success' | 'pending'>('verifying')
  const orderTrackingId = searchParams.get("OrderTrackingId") || searchParams.get("orderTrackingId")
  
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!orderTrackingId || !user?.id) return

    const verify = async () => {
      try {
        const res = await verifyPaymentAction(orderTrackingId, user.id)
        if (res.success && res.coins_added) {
          setStatus('success')
          if (pollTimerRef.current) clearInterval(pollTimerRef.current)
        }
      } catch (err) {}
    }

    // Initial check
    verify()
    // Poll every 4 seconds
    pollTimerRef.current = setInterval(verify, 4000)

    // UI Countdown to restore button
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      clearInterval(timer)
    }
  }, [orderTrackingId, user?.id, status])

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col items-center justify-center p-8 space-y-12 select-none">
      <div className="relative">
        <div className="w-40 h-40 border-4 border-blue-50 rounded-full flex items-center justify-center">
          {status === 'success' ? (
            <CheckCircle2 className="w-20 h-20 text-green-500 animate-in zoom-in" />
          ) : (
            <>
              <Loader2 className="w-32 h-32 text-[#00A2FF] animate-spin opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-4xl font-black text-black leading-none">{countdown}</span>
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">SEC</span>
              </div>
            </>
          )}
        </div>
        {status === 'success' && (
          <div className="absolute -bottom-4 -right-4 bg-green-500 p-3 rounded-2xl shadow-xl border-4 border-white animate-bounce">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      <div className="text-center space-y-2">
        <h2 className={cn("text-xl font-black tracking-tight uppercase", status === 'success' ? "text-green-600" : "text-black")}>
          {status === 'verifying' ? "Finalizing Payment" : status === 'success' ? "Coins Delivered!" : "Verification in Progress"}
        </h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em] max-w-[240px] leading-relaxed mx-auto">
          {status === 'success' 
            ? "Your wallet has been updated. Happy chatting!" 
            : "Talking to gateway. We are confirming your transaction in the background."}
        </p>
      </div>

      <Button 
        onClick={() => router.replace('/recharge')}
        className={cn(
          "w-full max-w-xs h-16 rounded-full font-black uppercase tracking-widest text-xs shadow-xl transition-all",
          status === 'success' ? "bg-green-600 text-white" : "bg-black text-white"
        )}
      >
        {status === 'success' ? "Continue" : "Return to Store"}
      </Button>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-white" />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
