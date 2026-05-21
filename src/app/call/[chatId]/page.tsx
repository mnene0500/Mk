"use client"

import { useEffect, useRef, use, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { PhoneOff, Mic, MicOff, Video, VideoOff, Coins, User } from "lucide-react"
import { deductCallCoinsAction } from "@/app/actions/call-actions"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
      // Signal the recipient
      supabase.channel(`calls:${partnerId}`).send({
        type: 'broadcast',
        event: 'incoming-call',
        payload: { chatId, type: isVideo ? 'video' : 'voice', callerId: user.id, callerName: partnerName, callerPhoto: partnerPhoto }
      })
    }

    const channel = supabase.channel(`calls:${user.id}`)
      .on('broadcast', { event: 'call-rejected' }, () => {
        toast({ title: "Call Declined" })
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
        onUserJoin: (joinedUser) => {
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
    if (zpRef.current) zpRef.current.leaveRoom()
    if (isCaller && partnerId) {
      supabase.channel(`calls:${partnerId}`).send({ type: 'broadcast', event: 'cancel-call' })
    }
    router.replace("/chats")
  }

  return (
    <div className="w-full h-screen bg-black relative">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-12 inset-x-0 flex justify-center gap-8">
        <button onClick={() => { setMicEnabled(!micEnabled); zpRef.current?.enableMicrophone(!micEnabled); }} className="w-16 h-16 rounded-full bg-white/10 text-white flex items-center justify-center">
          {micEnabled ? <Mic /> : <MicOff />}
        </button>
        <button onClick={hangUp} className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-2xl"><PhoneOff className="text-white" /></button>
        {isVideo && (
          <button onClick={() => { setCameraEnabled(!cameraEnabled); zpRef.current?.enableCamera(!cameraEnabled); }} className="w-16 h-16 rounded-full bg-white/10 text-white flex items-center justify-center">
            {cameraEnabled ? <Video /> : <VideoOff />}
          </button>
        )}
      </div>
    </div>
  )
}
