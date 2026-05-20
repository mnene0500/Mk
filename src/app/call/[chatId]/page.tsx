
"use client"

import { useEffect, useRef, use, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser, useDoc, useFirestore, useDatabase } from "@/firebase"
import { doc } from "firebase/firestore"
import { ref, onValue, off } from "firebase/database"
import { Loader2, Coins, AlertCircle, X } from "lucide-react"
import { deductCallCoinsAction } from "@/app/actions/call-actions"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"

/**
 * @fileOverview One-on-one Video/Voice call interface with per-minute billing.
 * Integrated with ZegoCloud for high-fidelity communication.
 */
export default function CallPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const db = useFirestore()
  const rtdb = useDatabase()
  const { toast } = useToast()
  
  const containerRef = useRef<HTMLDivElement>(null)
  const billingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const zpRef = useRef<any>(null)
  
  const isVideo = searchParams.get('type') !== 'voice'
  const isCaller = searchParams.get('caller') === 'true'
  const partnerName = searchParams.get('partner') || "Partner"
  
  const { data: profile } = useDoc<any>(user?.uid && db ? doc(db, "users", user.uid) : null)
  const [currentBalance, setCurrentBalance] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  // Real-time balance listener for UI display and caller tracking
  useEffect(() => {
    if (!user?.uid || !rtdb) return
    const balRef = ref(rtdb, `balances/${user.uid}/coins`)
    const unsubscribe = onValue(balRef, (snap) => {
      setCurrentBalance(snap.val() || 0)
    })
    return () => off(balRef, 'value', unsubscribe)
  }, [user?.uid, rtdb])

  const handleDeduction = async () => {
    if (!user || !isCaller) return true;
    
    const type = isVideo ? 'video' : 'voice';
    const result = await deductCallCoinsAction(user.uid, type, partnerName);
    
    if (!result.success) {
      toast({ variant: "destructive", title: "Call Terminated", description: result.error });
      if (zpRef.current) zpRef.current.leaveRoom();
      router.replace("/chats");
      return false;
    }
    return true;
  }

  useEffect(() => {
    if (!user || !profile || !containerRef.current) return

    const initCall = async () => {
      try {
        const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')
        
        const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID)
        const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET
        
        if (!appID || !serverSecret) {
          setError("Call System Error: Missing ZegoCloud configuration in Vercel settings.")
          return
        }

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          chatId,
          user.uid,
          profile.name || "User"
        )

        const zp = ZegoUIKitPrebuilt.create(kitToken)
        zpRef.current = zp;
        
        zp.joinRoom({
          container: containerRef.current,
          mode: ZegoUIKitPrebuilt.OneONoneCall,
          showPreJoinView: false,
          scenario: {
            mode: isVideo ? ZegoUIKitPrebuilt.VideoCall : ZegoUIKitPrebuilt.VoiceCall,
          },
          onUserJoin: async (users) => {
            // BILLING TRIGGER: Start charging the CALLER only when the OTHER user joins.
            // In a 1:1 call, if more than 1 user is present, it means the partner joined.
            if (isCaller && !billingIntervalRef.current) {
               const success = await handleDeduction();
               if (success) {
                 billingIntervalRef.current = setInterval(handleDeduction, 60000);
               }
            }
          },
          onLeaveRoom: () => {
            if (billingIntervalRef.current) clearInterval(billingIntervalRef.current);
            router.replace("/chats")
          },
        })
      } catch (err: any) {
        console.error("Zego Init Error:", err)
        setError(err.message || "Failed to initialize call service.")
      }
    }

    initCall()

    return () => {
      if (billingIntervalRef.current) clearInterval(billingIntervalRef.current);
    }
  }, [user, profile, chatId, isVideo, router, isCaller])

  if (error) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center text-white p-10 text-center select-none">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-black uppercase tracking-tighter mb-2">Service Offline</h2>
        <p className="font-bold text-white/40 uppercase tracking-widest text-[9px] mb-8 leading-relaxed">{error}</p>
        <Button onClick={() => router.replace("/chats")} className="rounded-full bg-white text-black font-bold uppercase tracking-widest text-[10px] h-12 px-8">Return to Chat</Button>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center text-white select-none">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-white/5 rounded-full" />
          <div className="w-20 h-20 border-4 border-[#00A2FF] border-t-transparent rounded-full animate-spin absolute inset-0" />
        </div>
        <p className="mt-6 font-bold uppercase tracking-[0.3em] text-[9px] text-[#00A2FF] animate-pulse">Initializing Flux...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative select-none">
      {/* Zego UI Container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Premium Overlay Info */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-2.5 rounded-full flex items-center gap-3 shadow-2xl">
           <div className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
           <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
             {isVideo ? 'Video' : 'Voice'} Call Live
           </span>
           <div className="w-px h-3 bg-white/20" />
           <div className="flex items-center gap-1.5">
             <Coins className="w-3.5 h-3.5 text-yellow-500" />
             <span className="text-[10px] font-black text-white">{isVideo ? '150' : '70'} / min</span>
           </div>
        </div>

        {isCaller && (
          <div className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5 shadow-lg flex items-center gap-2">
            <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">Your Balance:</span>
            <span className="text-[10px] font-black text-yellow-400">{currentBalance} Coins</span>
          </div>
        )}
      </div>

      {/* Manual Hangup (Fallback) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.4em]">Secure Call • 256-bit Encryption</p>
      </div>
    </div>
  )
}
