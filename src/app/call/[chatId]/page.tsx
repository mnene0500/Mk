
"use client"

import { useEffect, useRef, use, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { PhoneOff, Mic, MicOff, Video, VideoOff, Loader2 } from "lucide-react"
import { deductCallCoinsAction, checkCallBalanceAction } from "@/app/actions/call-actions"
import { useToast } from "@/hooks/use-toast"

/**
 * @fileOverview Video & Voice Calling Page with Per-Minute Billing.
 * Men are charged 150/min for video and 70/min for voice.
 */
export default function CallPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { toast } = useToast()
  
  const containerRef = useRef<HTMLDivElement>(null)
  const zpRef = useRef<any>(null)
  const billingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const partnerJoinedRef = useRef<boolean>(false)
  
  const isVideo = searchParams.get('type') !== 'voice'
  const isCaller = searchParams.get('caller') === 'true'
  const partnerName = searchParams.get('partner') || "Partner"
  const partnerId = searchParams.get('partnerId')
  const partnerPhoto = searchParams.get('partnerPhoto')
  
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(isVideo)
  const [isReady, setIsReady] = useState(false)

  // 1. Initial Setup & Signaling
  useEffect(() => {
    if (!user || !partnerId) return

    if (isCaller) {
      supabase.channel(`calls:${partnerId}`).send({
        type: 'broadcast',
        event: 'incoming-call',
        payload: { chatId, type: isVideo ? 'video' : 'voice', callerId: user.id, callerName: partnerName, callerPhoto: partnerPhoto }
      })
    }

    const channel = supabase.channel(`calls:${user.id}`)
      .on('broadcast', { event: 'call-rejected' }, () => { toast({ title: "Call Declined" }); hangUp(); })
      .on('broadcast', { event: 'cancel-call' }, () => hangUp())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, partnerId, isCaller])

  // 2. BILLING LOOP: Per Minute logic
  const startBillingLoop = () => {
    if (!isCaller || !user) return
    
    // Initial charge immediately upon connection
    deductCallCoinsAction(user.id, isVideo ? 'video' : 'voice', partnerName)

    billingIntervalRef.current = setInterval(async () => {
      // Check if user still has balance for next minute
      const balanceCheck = await checkCallBalanceAction(user.id, isVideo ? 'video' : 'voice')
      if (!balanceCheck.success) {
        toast({ variant: "destructive", title: "Balance Depleted", description: "Call ended due to low coins." })
        hangUp()
        return
      }

      // Deduct for the next minute
      deductCallCoinsAction(user.id, isVideo ? 'video' : 'voice', partnerName)
    }, 60000) // Every 1 minute
  }

  // 3. Initialize Zego
  useEffect(() => {
    if (!user || !containerRef.current) return

    const initCall = async () => {
      const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID),
        process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET!,
        chatId,
        user.id,
        user.user_metadata?.full_name || "User"
      )

      const zp = ZegoUIKitPrebuilt.create(kitToken)
      zpRef.current = zp
      zp.joinRoom({
        container: containerRef.current,
        mode: ZegoUIKitPrebuilt.OneONoneCall,
        showPreJoinView: false,
        turnOnCameraWhenJoining: isVideo,
        turnOnMicrophoneWhenJoining: true,
        showMyCameraToggleButton: isVideo,
        showAudioVideoSettingsButton: false,
        showMyDeviceStatusIcon: false,
        onUserJoin: (joinedUser) => {
          if (joinedUser.userID !== user.id) {
            partnerJoinedRef.current = true
            startBillingLoop()
          }
        },
        onLeaveRoom: () => hangUp(),
      })
      setIsReady(true)
    }
    initCall()

    return () => { if (billingIntervalRef.current) clearInterval(billingIntervalRef.current) }
  }, [user, chatId])

  const hangUp = () => {
    if (billingIntervalRef.current) clearInterval(billingIntervalRef.current)
    if (zpRef.current) zpRef.current.leaveRoom()
    if (isCaller && partnerId) supabase.channel(`calls:${partnerId}`).send({ type: 'broadcast', event: 'cancel-call' })
    router.replace("/chats")
  }

  return (
    <div className="w-full h-screen bg-black relative flex flex-col items-center justify-center">
      {!isReady && <div className="flex flex-col items-center gap-4 text-white opacity-40"><Loader2 className="animate-spin" /><span>Initializing secure line...</span></div>}
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-12 inset-x-0 flex justify-center items-center gap-8 z-50">
        <button onClick={() => { setMicEnabled(!micEnabled); zpRef.current?.enableMicrophone(!micEnabled); }} className={cn("w-16 h-16 rounded-full backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all", micEnabled ? "bg-white/10 text-white" : "bg-red-500 text-white")}>
          {micEnabled ? <Mic /> : <MicOff />}
        </button>
        <button onClick={hangUp} className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.5)] active:scale-95 transition-transform"><PhoneOff className="text-white w-8 h-8" /></button>
        {isVideo && (
          <button onClick={() => { setCameraEnabled(!cameraEnabled); zpRef.current?.enableCamera(!cameraEnabled); }} className={cn("w-16 h-16 rounded-full backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all", cameraEnabled ? "bg-white/10 text-white" : "bg-red-500 text-white")}>
            {cameraEnabled ? <Video /> : <VideoOff />}
          </button>
        )}
      </div>
    </div>
  )
}
