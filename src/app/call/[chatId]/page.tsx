"use client"

import { useEffect, useState, useRef, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PhoneOff, Mic, MicOff, Video, VideoOff, User, Loader2, AlertCircle, Volume2, VolumeX, RefreshCw, Clock } from "lucide-react"
import { useUser } from "@/firebase/auth/use-user"
import { supabase } from "@/lib/supabase"
import { generateAgoraTokenAction, deductCallCoinsAction, endCallAction } from "@/app/actions/call-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

/**
 * @fileOverview Hardened Video/Voice Call Screen.
 * Optimized: Fixed camera switcher and high-fidelity Voice UI.
 */
export default function CallPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()

  const type = searchParams.get("type") as 'video' | 'voice'
  const partnerId = searchParams.get("partnerId")
  const callId = searchParams.get("callId")

  const rtc = useRef<{ 
    client: any, 
    localAudioTrack: any, 
    localVideoTrack: any 
  }>({ client: null, localAudioTrack: null, localVideoTrack: null })
  
  const [joined, setJoined] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [isLoudspeaker, setIsLoudspeaker] = useState(true)
  const [remoteUser, setRemoteUser] = useState<any>(null)
  const [partnerProfile, setPartnerProfile] = useState<any>(null)
  const [duration, setDuration] = useState(0)
  const [isRinging, setIsRinging] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  
  const totalCostRef = useRef(0)
  const totalDiamondsRef = useRef(0)
  const durationRef = useRef(0)

  const localVideoRef = useRef<HTMLDivElement>(null)
  const remoteVideoRef = useRef<HTMLDivElement>(null)
  const billingTimer = useRef<NodeJS.Timeout | null>(null)
  const ringingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    if (!partnerId) return
    supabase.from('users').select('uid, name, photo_url').eq('uid', partnerId).single().then(({ data }) => {
      if (mounted.current) setPartnerProfile(data)
    })
    return () => { mounted.current = false }
  }, [partnerId])

  useEffect(() => {
    if (!callId) return
    const channel = supabase.channel(`call-mon-${callId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` }, (payload) => {
        if (payload.new.status === 'ended' && mounted.current) {
          handleEndCall(false); 
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [callId])

  useEffect(() => {
    if (isRinging && !remoteUser) {
       ringingTimeoutRef.current = setTimeout(() => {
        if (mounted.current && isRinging && !remoteUser) {
          handleEndCall(true, 'No Answer');
        }
      }, 45000);
    }
    return () => { if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current) }
  }, [isRinging, !!remoteUser])

  useEffect(() => {
    if (joined && remoteUser && user?.id && partnerId) {
      billingTimer.current = setInterval(async () => {
        if (!mounted.current) {
          if (billingTimer.current) clearInterval(billingTimer.current);
          return;
        }
        
        const next = durationRef.current + 1;
        const isDeductionPoint = (next === 1) || (next > 60 && (next - 1) % 60 === 0);
        
        if (isDeductionPoint) {
          const res = await deductCallCoinsAction(user.id, type, partnerId);
          if (!res.success) {
            if (billingTimer.current) clearInterval(billingTimer.current);
            if (mounted.current) {
              toast({ variant: "destructive", title: "Insufficient Coins", description: "Recharge to continue." });
              handleEndCall(true, 'Insufficient Coins');
            }
            return;
          }
          totalCostRef.current += (res.cost || 0);
          totalDiamondsRef.current += (res.diamondReward || 0);
        }

        durationRef.current = next;
        setDuration(next);
      }, 1000)
    }
    return () => { if (billingTimer.current) clearInterval(billingTimer.current) }
  }, [joined, !!remoteUser, user?.id, partnerId, type, toast])

  useEffect(() => {
    const init = async () => {
      if (typeof window === 'undefined' || !user?.id) return
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
        rtc.current.client = client

        client.on("user-published", async (remote, mediaType) => {
          await client.subscribe(remote, mediaType)
          if (mediaType === "video") {
            setRemoteUser(remote)
            setIsRinging(false)
            if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
            setTimeout(() => { if (remoteVideoRef.current) remote.videoTrack?.play(remoteVideoRef.current) }, 300)
          }
          if (mediaType === "audio") {
            remote.audioTrack?.play()
            setIsRinging(false)
            if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
            setRemoteUser((prev: any) => prev || remote)
          }
        })

        client.on("user-left", () => { if (mounted.current) handleEndCall(false) })

        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: type === 'voice' ? "speech_standard" : "music_standard"
        }).catch(e => { throw new Error("Mic required.") });
        rtc.current.localAudioTrack = audioTrack;

        if (type === 'video') {
          const videoTrack = await AgoraRTC.createCameraVideoTrack({ facingMode: "user" }).catch(() => null);
          if (videoTrack) {
            rtc.current.localVideoTrack = videoTrack;
            if (localVideoRef.current) videoTrack.play(localVideoRef.current);
          }
        }

        const tokenData = await generateAgoraTokenAction(chatId, user.id);
        await client.join(tokenData.appId, tokenData.channelName, tokenData.token, tokenData.uid);
        
        const tracks: any[] = [rtc.current.localAudioTrack];
        if (rtc.current.localVideoTrack) tracks.push(rtc.current.localVideoTrack);
        
        await client.publish(tracks);
        setJoined(true);
        if (callId) await supabase.from('calls').update({ status: 'active' }).eq('id', callId);

      } catch (err: any) {
        setPermissionError(err.message || "Setup failed.");
      }
    }
    init()
    return () => { shutdownAgora() }
  }, [chatId, user?.id, type, callId])

  const switchCamera = async () => {
    if (!rtc.current.localVideoTrack || !rtc.current.client || type !== 'video') return;
    const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    
    try {
      // 1. Unpublish and close old track
      await rtc.current.client.unpublish(rtc.current.localVideoTrack);
      rtc.current.localVideoTrack.stop();
      rtc.current.localVideoTrack.close();
      
      // 2. Create and play new track
      const newVideoTrack = await AgoraRTC.createCameraVideoTrack({ facingMode: newMode });
      rtc.current.localVideoTrack = newVideoTrack;
      if (localVideoRef.current) newVideoTrack.play(localVideoRef.current);
      
      // 3. Republish
      await rtc.current.client.publish(newVideoTrack);
      setFacingMode(newMode);
    } catch (e) {
      console.error("Switch failed", e);
    }
  };

  const shutdownAgora = async () => {
    if (rtc.current.localAudioTrack) { rtc.current.localAudioTrack.stop(); rtc.current.localAudioTrack.close(); }
    if (rtc.current.localVideoTrack) { rtc.current.localVideoTrack.stop(); rtc.current.localVideoTrack.close(); }
    if (rtc.current.client) { await rtc.current.client.leave().catch(() => {}); }
  }

  const handleEndCall = async (manual = true, overrideReason?: string) => {
    mounted.current = false;
    if (billingTimer.current) clearInterval(billingTimer.current);
    router.replace(`/chats?startWith=${partnerId}`);
    await shutdownAgora();
    
    if (manual && callId) {
      let reason = overrideReason || 'Call Ended';
      if (!remoteUser && isRinging) {
        reason = overrideReason === 'No Answer' ? 'No Answer' : 'Cancelled';
      } else if (remoteUser) {
        const m = Math.floor(durationRef.current / 60);
        const s = durationRef.current % 60;
        reason = `Duration: ${m}:${s.toString().padStart(2, '0')}`;
      }
      await endCallAction({
        callId, logReason: reason,
        totalCost: totalCostRef.current,
        totalDiamonds: totalDiamondsRef.current,
        partnerName: partnerProfile?.name
      });
    }
  }

  if (permissionError) return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-10 text-center z-[200]">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-white font-bold text-xl mb-2">Call Error</h2>
      <p className="text-gray-400 text-xs mb-10 max-w-[280px]">{permissionError}</p>
      <Button onClick={() => router.back()} className="rounded-2xl h-14 px-10 bg-[#8B0000] text-white font-black uppercase text-xs">Go Back</Button>
    </div>
  )

  const formattedTime = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden select-none">
      <div className="absolute inset-0 z-0">
        {type === 'video' && remoteUser ? <div ref={remoteVideoRef} className="w-full h-full bg-black" /> : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
             <div className="relative">
               {isRinging && <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20" />}
               <Avatar className="w-40 h-40 border-4 border-white/10 shadow-2xl relative z-10">
                 <AvatarImage src={partnerProfile?.photo_url} className="object-cover" />
                 <AvatarFallback><User className="w-16 h-16 text-zinc-700" /></AvatarFallback>
               </Avatar>
             </div>
             <h2 className="text-white text-2xl font-black mt-8 tracking-tight">{partnerProfile?.name || 'Connecting...'}</h2>
             <p className={cn("text-[10px] font-black uppercase tracking-[0.4em] mt-4", remoteUser ? "text-green-500" : "text-zinc-500")}>
               {remoteUser ? 'Connected' : 'Ringing...'}
             </p>
          </div>
        )}
      </div>

      {remoteUser && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
          <div className="px-6 py-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-black text-white font-mono">{formattedTime}</span>
          </div>
        </div>
      )}

      {type === 'video' && (
        <div className={cn(
          "absolute transition-all duration-500 overflow-hidden border-2 border-white/20 shadow-2xl z-20", 
          remoteUser ? "top-12 right-6 w-32 aspect-[3/4] rounded-3xl" : "inset-0 rounded-none z-[5]"
        )}>
          <div ref={localVideoRef} className={cn("w-full h-full bg-zinc-800", (cameraOff || !rtc.current.localVideoTrack) && "opacity-0", facingMode === 'user' && "scale-x-[-1]")} />
          {(cameraOff || !rtc.current.localVideoTrack) && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-md">
               <VideoOff className="w-8 h-8 text-white/20" />
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-12 inset-x-0 px-6 flex flex-wrap items-center justify-center gap-3 z-50">
        <button onClick={() => { setMuted(!muted); rtc.current.localAudioTrack?.setEnabled(muted); }} className={cn("w-14 h-14 rounded-full backdrop-blur-xl border border-white/10 flex items-center justify-center", muted ? "bg-red-500" : "bg-white/10 text-white")}>
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button onClick={() => setIsLoudspeaker(!isLoudspeaker)} className={cn("w-14 h-14 rounded-full backdrop-blur-xl border border-white/10 flex items-center justify-center", !isLoudspeaker ? "bg-black/80" : "bg-white/10 text-white")}>
          {isLoudspeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
        <button onClick={() => handleEndCall(true)} className="w-20 h-20 rounded-full bg-red-600 text-white shadow-2xl border-4 border-white/10 flex items-center justify-center active:scale-95 mx-2"><PhoneOff className="w-8 h-8" /></button>
        {type === 'video' && (
          <>
            <button onClick={() => { setCameraOff(!cameraOff); rtc.current.localVideoTrack?.setEnabled(cameraOff); }} className={cn("w-14 h-14 rounded-full backdrop-blur-xl border border-white/10 flex items-center justify-center", cameraOff ? "bg-red-500" : "bg-white/10 text-white")}>
              {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
            <button onClick={switchCamera} className="w-14 h-14 rounded-full backdrop-blur-xl bg-white/10 border border-white/10 text-white flex items-center justify-center active:rotate-180 transition-transform duration-500">
               <RefreshCw className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}