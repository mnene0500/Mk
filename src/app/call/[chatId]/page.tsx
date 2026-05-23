
"use client"

import { useEffect, useRef, use, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { PhoneOff, Mic, MicOff, Video, VideoOff, Loader2, AlertCircle } from "lucide-react"
import { deductCallCoinsAction, checkCallBalanceAction } from "@/app/actions/call-actions"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function CallPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { toast } = useToast()
  
  const clientRef = useRef<any>(null)
  const localAudioTrackRef = useRef<any>(null)
  const localVideoTrackRef = useRef<any>(null)
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null)
  const billingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const isVideo = searchParams.get('type') !== 'voice'
  const isCaller = searchParams.get('caller') === 'true'
  const partnerName = searchParams.get('partner') || "Partner"
  const partnerId = searchParams.get('partnerId') || ""
  
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(isVideo)
  const [isConnected, setIsConnected] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [callStartTime, setCallStartTime] = useState<number>(0)

  const logCallInChat = async (status: string) => {
    if (!chatId || !user) return
    const ts = Date.now()
    await supabase.from('messages').insert({ chat_id: chatId, text: status, sender_id: user.id, timestamp: ts })
    await supabase.from('chats').upsert({ id: chatId, last_message: status, last_message_at: ts, participant_ids: [user.id, partnerId] })
  }

  const hangUp = async () => {
    if (billingIntervalRef.current) clearInterval(billingIntervalRef.current)
    
    if (localAudioTrackRef.current) { localAudioTrackRef.current.close() }
    if (localVideoTrackRef.current) { localVideoTrackRef.current.close() }
    if (clientRef.current) { await clientRef.current.leave() }
    
    if (isCaller && !isConnected) {
      supabase.channel(`calls:${partnerId}`).send({ type: 'broadcast', event: 'cancel-call' })
      logCallInChat("[Cancelled]")
    } else if (isConnected) {
      const durationSec = Math.floor((Date.now() - callStartTime) / 1000)
      const mins = Math.floor(durationSec / 60)
      const secs = durationSec % 60
      logCallInChat(`[${mins}:${secs.toString().padStart(2, '0')}]`)
    }

    router.replace("/chats")
  }

  // 1. Signaling & Balance Check
  useEffect(() => {
    if (!user || !partnerId) return
    
    const initCall = async () => {
      if (isCaller) {
        const check = await checkCallBalanceAction(user.id, isVideo ? 'video' : 'voice')
        if (!check.success) {
          toast({ variant: "destructive", title: "Insufficient Coins", description: "Recharge to start call." })
          router.replace("/recharge")
          return
        }

        supabase.channel(`calls:${partnerId}`).send({
          type: 'broadcast',
          event: 'incoming-call',
          payload: { 
            chatId, 
            type: isVideo ? 'video' : 'voice', 
            callerId: user.id, 
            callerName: user.user_metadata?.full_name || "User", 
            callerPhoto: user.user_metadata?.avatar_url 
          }
        })
      }
      setIsInitializing(false)
    }

    initCall()

    const channel = supabase.channel(`calls:${user.id}`)
      .on('broadcast', { event: 'call-rejected' }, () => { toast({ title: "Call Rejected" }); hangUp(); })
      .on('broadcast', { event: 'cancel-call' }, () => { toast({ title: "Caller Cancelled" }); hangUp(); })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, partnerId])

  // 2. Agora RTC Initialization
  useEffect(() => {
    if (isInitializing || !user) return
    
    const setupRTC = async () => {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID
      
      if (!APP_ID) {
        toast({ variant: "destructive", title: "System Error", description: "Agora App ID missing." })
        return
      }

      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
      
      clientRef.current.on('user-published', async (remoteUser: any, mediaType: string) => {
        await clientRef.current.subscribe(remoteUser, mediaType)
        if (mediaType === 'video') {
          remoteUser.videoTrack.play(remoteVideoContainerRef.current)
        }
        if (mediaType === 'audio') {
          remoteUser.audioTrack.play()
        }
        
        if (!isConnected) {
          setIsConnected(true)
          setCallStartTime(Date.now())
          if (isCaller) startBilling()
        }
      })

      clientRef.current.on('user-left', () => hangUp())

      try {
        await clientRef.current.join(APP_ID, chatId, null, user.id)
        
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack()
        localAudioTrackRef.current = audioTrack
        
        let videoTrack = null
        if (isVideo) {
          videoTrack = await AgoraRTC.createCameraVideoTrack()
          localVideoTrackRef.current = videoTrack
          videoTrack.play('local-player')
        }

        await clientRef.current.publish(isVideo ? [audioTrack, videoTrack] : [audioTrack])
      } catch (err: any) {
        toast({ variant: "destructive", title: "Permission Denied", description: "Camera/Mic access is required." })
        hangUp()
      }
    }

    setupRTC()
  }, [isInitializing, user])

  const startBilling = () => {
    if (!isCaller) return
    
    // Minute 1: Billed at 11th second
    setTimeout(async () => {
      deductCallCoinsAction(user!.id, isVideo ? 'video' : 'voice', partnerId, partnerName)
    }, 11000)

    // Minute 2+: Billed at start of every minute
    billingIntervalRef.current = setInterval(async () => {
      const check = await checkCallBalanceAction(user!.id, isVideo ? 'video' : 'voice')
      if (!check.success) {
        toast({ variant: "destructive", title: "Balance Exhausted" })
        return hangUp()
      }
      deductCallCoinsAction(user!.id, isVideo ? 'video' : 'voice', partnerId, partnerName)
    }, 60000)
  }

  if (isInitializing) return <div className="h-screen bg-black flex flex-col items-center justify-center text-white"><Loader2 className="w-10 h-10 animate-spin text-[#00A2FF]" /></div>

  return (
    <div className="w-full h-screen bg-black relative flex flex-col items-center justify-center overflow-hidden select-none">
      {/* REMOTE VIDEO */}
      <div ref={remoteVideoContainerRef} className="absolute inset-0 w-full h-full bg-neutral-900" />
      
      {/* LOCAL PREVIEW */}
      {isVideo && (
        <div id="local-player" className="absolute top-12 right-6 w-32 h-44 bg-black rounded-2xl border-2 border-white/20 shadow-2xl overflow-hidden z-40" />
      )}

      {/* CONNECTING OVERLAY */}
      {!isConnected && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center">
          <div className="w-24 h-24 border-4 border-[#00A2FF] border-t-transparent rounded-full animate-spin mb-8" />
          <h2 className="text-2xl font-black text-white italic tracking-tighter">{isCaller ? 'Calling...' : 'Connecting...'}</h2>
          <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-[0.4em]">{partnerName}</p>
        </div>
      )}

      {/* CONTROLS */}
      <div className="absolute bottom-12 inset-x-0 flex justify-center items-center gap-8 z-50">
        <button 
          onClick={() => { 
            const newState = !micEnabled;
            setMicEnabled(newState);
            localAudioTrackRef.current?.setEnabled(newState);
          }} 
          className={cn("w-16 h-16 rounded-full backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all", micEnabled ? "bg-white/10 text-white" : "bg-red-500 text-white")}
        >
          {micEnabled ? <Mic /> : <MicOff />}
        </button>
        
        <button onClick={hangUp} className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
          <PhoneOff className="text-white w-8 h-8" />
        </button>
        
        {isVideo && (
          <button 
            onClick={() => {
              const newState = !cameraEnabled;
              setCameraEnabled(newState);
              localVideoTrackRef.current?.setEnabled(newState);
            }} 
            className={cn("w-16 h-16 rounded-full backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all", cameraEnabled ? "bg-white/10 text-white" : "bg-red-500 text-white")}
          >
            {cameraEnabled ? <Video /> : <VideoOff />}
          </button>
        )}
      </div>
    </div>
  )
}
