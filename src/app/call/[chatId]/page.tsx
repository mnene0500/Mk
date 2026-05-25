
"use client"

import { useEffect, useState, useRef, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PhoneOff, Mic, MicOff, Video, VideoOff, User, Loader2, AlertCircle, SwitchCamera } from "lucide-react"
import { useUser } from "@/firebase/auth/use-user"
import { supabase } from "@/lib/supabase"
import { generateAgoraTokenAction, deductCallCoinsAction, endCallAction } from "@/app/actions/call-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Overhauled Agora Call Page for reliable Real-time AV communication.
 * Fixed: Remote user visibility, audio connectivity, and UI cleanup on exit.
 */

export default function CallPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()

  const type = searchParams.get("type") as 'video' | 'voice'
  const partnerId = searchParams.get("partnerId")
  const callId = searchParams.get("callId")

  const rtc = useRef<{ 
    client: any, 
    localAudioTrack: any, 
    localVideoTrack: any 
  }>({ 
    client: null, 
    localAudioTrack: null, 
    localVideoTrack: null 
  })
  
  const [joined, setJoined] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(type === 'voice')
  const [remoteUser, setRemoteUser] = useState<any>(null)
  const [partnerProfile, setPartnerProfile] = useState<any>(null)
  const [duration, setDuration] = useState(0)
  const [isRinging, setIsRinging] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)

  const localVideoRef = useRef<HTMLDivElement>(null)
  const remoteVideoRef = useRef<HTMLDivElement>(null)
  const billingTimer = useRef<NodeJS.Timeout | null>(null)
  const joining = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    if (!partnerId) return
    supabase.from('users').select('uid, name, photo_url').eq('uid', partnerId).single().then(({ data }) => {
      if (mounted.current) setPartnerProfile(data)
    })
    return () => { mounted.current = false }
  }, [partnerId])

  // CALL STATUS MONITORING
  useEffect(() => {
    if (!callId) return
    const channel = supabase.channel(`call-status-monitor-${callId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public',
        table: 'calls', 
        filter: `id=eq.${callId}` 
      }, (payload) => {
        if (payload.new.status === 'ended' && mounted.current) {
          handleEndCall(false)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [callId])

  // BILLING TIMER
  useEffect(() => {
    if (joined && remoteUser && user?.id && partnerId) {
      billingTimer.current = setInterval(async () => {
        if (!mounted.current) return;
        setDuration(prev => {
          const next = prev + 1
          const isDeductionPoint = next === 11 || (next > 11 && (next - 11) % 60 === 0);
          if (isDeductionPoint) {
            deductCallCoinsAction(user.id, type, partnerId).then(res => {
              if (!res.success && mounted.current) handleEndCall(true)
            })
          }
          return next
        })
      }, 1000)
    }
    return () => { if (billingTimer.current) clearInterval(billingTimer.current) }
  }, [joined, !!remoteUser, user?.id, partnerId, type])

  useEffect(() => {
    const init = async () => {
      if (typeof window === 'undefined' || !user?.id || !chatId || joining.current) return
      joining.current = true
      
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
        rtc.current.client = client

        // Handle remote users joining/publishing
        client.on("user-published", async (remote, mediaType) => {
          await client.subscribe(remote, mediaType)
          
          if (mediaType === "video") {
            setRemoteUser(remote)
            setIsRinging(false)
            if (mounted.current) {
              setTimeout(() => {
                if (remoteVideoRef.current && remote.videoTrack) {
                  remote.videoTrack.play(remoteVideoRef.current)
                }
              }, 300)
            }
          }
          
          if (mediaType === "audio") {
            remote.audioTrack?.play()
            setIsRinging(false)
            setRemoteUser((prev: any) => prev || remote)
          }
        })

        client.on("user-left", () => {
          if (mounted.current) handleEndCall(false)
        })

        // PRE-JOIN MEDIA (Camera Preview)
        if (type === 'video') {
          try {
            const videoTrack = await AgoraRTC.createCameraVideoTrack({
                encoderConfig: "720p_1",
                facingMode: "user"
            })
            rtc.current.localVideoTrack = videoTrack
            if (localVideoRef.current) {
              videoTrack.play(localVideoRef.current)
            }
          } catch (vErr) {
            console.error("Camera access denied:", vErr)
            setPermissionError("Camera access required for video call.")
            return
          }
        }

        // JOIN AND PUBLISH
        const tokenData = await generateAgoraTokenAction(chatId, user.id)
        await client.join(tokenData.appId, tokenData.channelName, tokenData.token, tokenData.uid)
        
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack()
        rtc.current.localAudioTrack = audioTrack
        
        const tracksToPublish = [audioTrack]
        if (rtc.current.localVideoTrack) tracksToPublish.push(rtc.current.localVideoTrack)
        
        await client.publish(tracksToPublish)
        setJoined(true)
      } catch (err: any) {
        console.error("Call Init Error:", err)
        if (mounted.current) router.replace('/home')
      } finally {
        joining.current = false
      }
    }

    init()
    
    return () => { 
      mounted.current = false
      shutdownAgora()
    }
  }, [chatId, user?.id])

  const shutdownAgora = async () => {
    if (rtc.current.localAudioTrack) { rtc.current.localAudioTrack.stop(); rtc.current.localAudioTrack.close(); rtc.current.localAudioTrack = null; }
    if (rtc.current.localVideoTrack) { rtc.current.localVideoTrack.stop(); rtc.current.localVideoTrack.close(); rtc.current.localVideoTrack = null; }
    if (rtc.current.client) {
      try { await rtc.current.client.leave() } catch (e) {}
      rtc.current.client = null
    }
  }

  const handleEndCall = async (manual = true) => {
    await shutdownAgora()
    if (manual && callId) { 
      await endCallAction(callId) 
    }
    if (mounted.current) {
      router.replace(`/chats?startWith=${partnerId}`)
    }
  }

  const toggleMute = () => {
    if (rtc.current.localAudioTrack) {
      const newState = !muted
      rtc.current.localAudioTrack.setEnabled(!newState)
      setMuted(newState)
    }
  }

  const toggleCamera = () => {
    if (rtc.current.localVideoTrack) {
      const newState = !cameraOff
      rtc.current.localVideoTrack.setEnabled(!newState)
      setCameraOff(newState)
    }
  }

  const handleSwitchCamera = async () => {
    if (!rtc.current.localVideoTrack || isSwitching) return;
    setIsSwitching(true);
    try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
        const cameras = await AgoraRTC.getCameras();
        if (cameras.length < 2) return;

        const currentDeviceId = rtc.current.localVideoTrack.getMediaStreamTrack().getSettings().deviceId;
        const nextDevice = cameras.find(c => c.deviceId !== currentDeviceId) || cameras[0];

        if (rtc.current.client && joined) {
            await rtc.current.client.unpublish(rtc.current.localVideoTrack);
        }
        rtc.current.localVideoTrack.stop();
        rtc.current.localVideoTrack.close();

        const newTrack = await AgoraRTC.createCameraVideoTrack({ cameraId: nextDevice.deviceId });
        rtc.current.localVideoTrack = newTrack;
        
        if (localVideoRef.current) {
            newTrack.play(localVideoRef.current);
        }

        if (rtc.current.client && joined) {
            await rtc.current.client.publish(newTrack);
        }
    } catch (e) {
        console.error("Camera Switch Error:", e);
    } finally {
        setIsSwitching(false);
    }
  }

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (permissionError) {
    return (
      <div className="fixed inset-0 bg-zinc-900 z-[100] flex flex-col items-center justify-center p-10 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-white text-xl font-bold mb-2">Permission Required</h2>
        <p className="text-zinc-400 text-sm mb-8">{permissionError}</p>
        <Button onClick={() => router.back()} className="w-full h-14 rounded-full bg-white text-black font-bold">Go Back</Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center select-none overflow-hidden">
      {/* REMOTE VIDEO / PLACEHOLDER */}
      <div className="absolute inset-0 z-0">
        {type === 'video' && remoteUser ? (
          <div ref={remoteVideoRef} className="w-full h-full bg-black" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
             <div className="relative">
               {isRinging && <div className="absolute inset-0 bg-[#00A2FF] rounded-full animate-ping opacity-20" />}
               <Avatar className="w-32 h-32 border-4 border-white/10 shadow-2xl relative z-10">
                 <AvatarImage src={partnerProfile?.photo_url} className="object-cover" />
                 <AvatarFallback className="bg-zinc-800 text-zinc-500"><User className="w-16 h-16" /></AvatarFallback>
               </Avatar>
             </div>
             <h2 className="text-white text-2xl font-black mt-6 tracking-tight">{partnerProfile?.name || 'Connecting...'}</h2>
             <div className="flex flex-col items-center gap-2 mt-4">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
                  {joined ? (remoteUser ? formatDuration(duration) : 'Ringing...') : 'Connecting Media...'}
                </p>
                {remoteUser && duration < 11 && (
                  <div className="px-4 py-1.5 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                    <p className="text-[10px] font-black uppercase tracking-widest">Free Preview: {10 - duration}s</p>
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* LOCAL VIDEO PREVIEW */}
      {type === 'video' && (
        <div className={cn(
          "absolute transition-all duration-500 overflow-hidden border-2 border-white/20 shadow-2xl z-20",
          remoteUser 
            ? "top-12 right-6 w-32 aspect-[3/4] rounded-3xl" 
            : "inset-0 border-none rounded-none z-[5]"
        )}>
          <div ref={localVideoRef} className={cn("w-full h-full bg-zinc-800", cameraOff && "opacity-0")} />
          {cameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
               <VideoOff className="w-8 h-8 text-zinc-600" />
            </div>
          )}
        </div>
      )}

      {/* CONTROLS */}
      <div className="absolute bottom-12 inset-x-0 px-8 flex items-center justify-center gap-4 z-50">
        <button onClick={toggleMute} className={cn("w-14 h-14 rounded-full backdrop-blur-xl border border-white/10 shadow-2xl transition-all active:scale-90 flex items-center justify-center", muted ? "bg-red-500 text-white" : "bg-white/10 text-white")}>
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        
        <button onClick={() => handleEndCall(true)} className="w-20 h-20 rounded-full bg-red-600 text-white shadow-2xl shadow-red-500/40 border-4 border-white/10 active:scale-95 transition-all flex items-center justify-center">
          <PhoneOff className="w-8 h-8" />
        </button>
        
        {type === 'video' && (
          <>
            <button onClick={toggleCamera} className={cn("w-14 h-14 rounded-full backdrop-blur-xl border border-white/10 shadow-2xl transition-all active:scale-90 flex items-center justify-center", cameraOff ? "bg-red-500 text-white" : "bg-white/10 text-white")}>
              {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
            <button onClick={handleSwitchCamera} disabled={isSwitching} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 text-white shadow-2xl active:scale-90 transition-all flex items-center justify-center">
              <SwitchCamera className={cn("w-5 h-5", isSwitching && "animate-spin")} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
