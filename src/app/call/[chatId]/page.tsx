"use client"

import { useEffect, useRef, use, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react"
import { deductCallCoinsAction } from "@/app/actions/call-actions"
import { useToast } from "@/hooks/use-toast"

export default function CallPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { toast } = useToast()
  
  const containerRef = useRef<HTMLDivElement>(null)
  const zpRef = useRef<any>(null)
  
  const isVideo = searchParams.get('type') !== 'voice'
  const isCaller = searchParams.get('caller') === 'true'
  const partnerName = searchParams.get('partner') || "Partner"
  const partnerId = searchParams.get('partnerId')
  const partnerPhoto = searchParams.get('partnerPhoto')
  
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(isVideo)

  useEffect(() => {
    if (!user || !partnerId) return

    if (isCaller) {
      // Signal the recipient via Supabase Realtime
      supabase.channel(`calls:${partnerId}`).send({
        type: 'broadcast',
        event: 'incoming-call',
        payload: { 
          chatId, 
          type: isVideo ? 'video' : 'voice', 
          callerId: user.id, 
          callerName: partnerName, 
          callerPhoto: partnerPhoto 
        }
      })
    }

    const channel = supabase.channel(`calls:${user.id}`)
      .on('broadcast', { event: 'call-rejected' }, () => {
        toast({ title: "Call Declined" })
        hangUp()
      })
      .on('broadcast', { event: 'cancel-call' }, () => {
        hangUp()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, partnerId, isCaller])

  useEffect(() => {
    if (!user || !containerRef.current) return

    const initCall = async () => {
      const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID),
        process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET!,
        chatId,
        user.id,
        "User"
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
          // BILLING: Only charge when the recipient actually joins
          if (joinedUser.userID !== user.id && isCaller) {
             deductCallCoinsAction(user.id, isVideo ? 'video' : 'voice', partnerName)
          }
        },
        onLeaveRoom: () => hangUp(),
      })
    }
    initCall()
  }, [user, chatId])

  const hangUp = () => {
    // Force disconnect hardware
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(stream => stream.getTracks().forEach(track => track.stop()))
        .catch(() => {});
    }

    if (zpRef.current) zpRef.current.leaveRoom()
    
    if (isCaller && partnerId) {
      supabase.channel(`calls:${partnerId}`).send({ type: 'broadcast', event: 'cancel-call' })
    }
    
    router.replace("/chats")
  }

  return (
    <div className="w-full h-screen bg-black relative flex flex-col items-center justify-center">
      {/* Zego Container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Glassmorphism Control Bar */}
      <div className="absolute bottom-12 inset-x-0 flex justify-center items-center gap-8 z-50">
        <button 
          onClick={() => { setMicEnabled(!micEnabled); zpRef.current?.enableMicrophone(!micEnabled); }} 
          className={cn(
            "w-16 h-16 rounded-full backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all active:scale-90",
            micEnabled ? "bg-white/10 text-white" : "bg-red-500 text-white"
          )}
        >
          {micEnabled ? <Mic /> : <MicOff />}
        </button>

        <button 
          onClick={hangUp} 
          className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.5)] transition-transform active:scale-95"
        >
          <PhoneOff className="text-white w-8 h-8" />
        </button>

        {isVideo && (
          <button 
            onClick={() => { setCameraEnabled(!cameraEnabled); zpRef.current?.enableCamera(!cameraEnabled); }} 
            className={cn(
              "w-16 h-16 rounded-full backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all active:scale-90",
              cameraEnabled ? "bg-white/10 text-white" : "bg-red-500 text-white"
            )}
          >
            {cameraEnabled ? <Video /> : <VideoOff />}
          </button>
        )}
      </div>
    </div>
  )
}
