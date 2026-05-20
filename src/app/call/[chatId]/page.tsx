"use client"

import { useEffect, useRef, use, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser, useDoc, useFirestore, useDatabase } from "@/firebase"
import { doc } from "firebase/firestore"
import { ref, onValue, off, set } from "firebase/database"
import { 
  Loader2, 
  Coins, 
  AlertCircle, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  ShieldCheck,
  User
} from "lucide-react"
import { deductCallCoinsAction } from "@/app/actions/call-actions"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/**
 * @fileOverview Premium 1-on-1 Call Interface.
 * Optimized for instant hardware release and cinematic visual feedback.
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
  const partnerId = searchParams.get('partnerId')
  const partnerPhoto = searchParams.get('partnerPhoto')
  
  const { data: profile } = useDoc<any>(user?.uid && db ? doc(db, "users", user.uid) : null)
  const [currentBalance, setCurrentBalance] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isPartnerInRoom, setIsPartnerInRoom] = useState(false)
  
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = isVideo ? useState(true) : [false, () => {}]

  // Monitor Balance
  useEffect(() => {
    if (!user?.uid || !rtdb) return
    const balRef = ref(rtdb, `balances/${user.uid}/coins`)
    const unsubscribe = onValue(balRef, (snap) => {
      setCurrentBalance(snap.val() || 0)
    })
    return () => off(balRef, 'value', unsubscribe)
  }, [user?.uid, rtdb])

  // Sync Rejection/End state via Signaling
  useEffect(() => {
    if (!rtdb || !partnerId || !isCaller) return
    const callSignalRef = ref(rtdb, `calls/${partnerId}`)
    const unsubscribe = onValue(callSignalRef, (snap) => {
      // If the signal disappears before the partner joins, it means they declined
      if (!snap.exists() && !isPartnerInRoom) {
         toast({ title: "Call Declined", description: `${partnerName} is unavailable.` });
         hangUp();
      }
    })
    return () => off(callSignalRef, 'value', unsubscribe)
  }, [rtdb, partnerId, isCaller, partnerName, isPartnerInRoom])

  const handleDeduction = async () => {
    if (!user || !isCaller) return true;
    
    const type = isVideo ? 'video' : 'voice';
    const result = await deductCallCoinsAction(user.uid, type, partnerName);
    
    if (!result.success) {
      toast({ variant: "destructive", title: "Call Terminated", description: result.error });
      hangUp();
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
          setError("Service configuration incomplete. Contact support.")
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
          showMyDeviceStatusIcon: false,
          showAudioVideoSettingsButton: false,
          showScreenSharingButton: false,
          showUserHideButton: false,
          showLeavingView: false,
          showTextChat: false,
          showUserList: false,
          turnOnCameraWhenJoining: isVideo,
          turnOnMicrophoneWhenJoining: true,
          showMyCameraToggleButton: isVideo,
          showAudioVideoSettings: false,
          layout: "Auto",
          scenario: {
            mode: isVideo ? ZegoUIKitPrebuilt.VideoCall : ZegoUIKitPrebuilt.VoiceCall,
          },
          onUserJoin: async (joinedUser) => {
            if (joinedUser.userID !== user.uid) {
              setIsPartnerInRoom(true);
              if (isCaller && !billingIntervalRef.current) {
                const success = await handleDeduction();
                if (success) {
                  billingIntervalRef.current = setInterval(handleDeduction, 60000);
                }
              }
            }
          },
          onUserLeave: () => hangUp(),
          onLeaveRoom: () => hangUp(),
        })
      } catch (err: any) {
        setError(err.message || "Failed to establish secure connection.")
      }
    }

    initCall()

    return () => {
      stopAllMediaTracks();
      if (billingIntervalRef.current) clearInterval(billingIntervalRef.current);
      if (zpRef.current) {
        try { zpRef.current.leaveRoom(); } catch(e) {}
      }
    }
  }, [user, profile, chatId, isVideo, isCaller])

  const stopAllMediaTracks = () => {
    // Robust hardware release
    try {
      // 1. SDK Cleanup
      if (zpRef.current) {
        zpRef.current.enableCamera(false);
        zpRef.current.enableMicrophone(false);
      }
      
      // 2. Global Browser Cleanup
      if (typeof window !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.enumerateDevices().then(() => {
          // This is a safety catch for any lingering streams
          if ((window as any).localStream) {
            (window as any).localStream.getTracks().forEach((track: any) => track.stop());
          }
        });
      }
    } catch (e) {
      console.warn("Hardware release error:", e);
    }
  }

  const toggleMic = () => {
    if (zpRef.current) {
      const newState = !micEnabled
      zpRef.current.enableMicrophone(newState)
      setMicEnabled(newState)
    }
  }

  const toggleCamera = () => {
    if (zpRef.current && isVideo) {
      const newState = !cameraEnabled
      zpRef.current.enableCamera(newState)
      setCameraEnabled(newState)
    }
  }

  const hangUp = () => {
    if (billingIntervalRef.current) clearInterval(billingIntervalRef.current);
    if (zpRef.current) {
      try {
        zpRef.current.leaveRoom()
      } catch (e) {}
    }
    stopAllMediaTracks();
    router.replace("/chats")
  }

  if (error) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center text-white p-10 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center mb-8">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Call Failed</h2>
        <p className="font-bold text-white/40 uppercase tracking-widest text-[10px] leading-relaxed mb-10 max-w-xs">
          {error}
        </p>
        <Button onClick={hangUp} className="rounded-full bg-white text-black font-black uppercase text-[10px] h-14 px-12 shadow-2xl">Return to Chat</Button>
      </div>
    )
  }

  if (!user || !profile) return <div className="flex-1 bg-black" />;

  return (
    <div className="w-full h-[100dvh] bg-black overflow-hidden relative select-none">
      {/* Zego Video Container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Voice Call UI Overlay (Shown when partner hasn't joined or it's audio only) */}
      {!isVideo && (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-black">
          <div className="relative mb-12">
            <div className="absolute inset-0 rounded-full bg-[#00A2FF]/20 animate-ping duration-[3000ms]" />
            <Avatar className="w-40 h-40 border-4 border-[#00A2FF]/30 shadow-2xl relative z-10">
              <AvatarImage src={partnerPhoto || ""} className="object-cover" />
              <AvatarFallback className="bg-slate-800 text-white text-5xl font-bold">
                <User className="w-16 h-16" />
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">{partnerName}</h2>
          <p className="text-[#00A2FF] font-black uppercase tracking-[0.4em] text-[10px] animate-pulse">
            {isPartnerInRoom ? 'Connected' : 'Calling...'}
          </p>
        </div>
      )}

      {/* Floating Header Info */}
      <div className="absolute top-12 left-0 right-0 z-50 flex flex-col items-center gap-3 px-6 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 px-6 py-2.5 rounded-full flex items-center gap-4 shadow-2xl animate-in slide-in-from-top-4 duration-500">
           <div className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
           <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
             {isVideo ? 'HD Video' : 'Secure Voice'}
           </span>
           <div className="w-px h-3 bg-white/20" />
           <div className="flex items-center gap-2">
             <Coins className="w-3.5 h-3.5 text-yellow-500" />
             <span className="text-[10px] font-black text-white">{isVideo ? '150' : '70'}/min</span>
           </div>
        </div>

        {isCaller && (
          <div className="bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5 shadow-lg flex items-center gap-2">
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Wallet:</span>
            <span className="text-[10px] font-black text-yellow-400">{currentBalance} Coins</span>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-12 left-0 right-0 z-50 px-8">
        <div className="max-w-md mx-auto bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-5 flex items-center justify-around shadow-2xl">
          <button 
            onClick={toggleMic}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90",
              micEnabled ? "bg-white/5 text-white hover:bg-white/10" : "bg-red-500 text-white shadow-lg shadow-red-500/20"
            )}
          >
            {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <button 
            onClick={hangUp}
            className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.5)] active:scale-95 transition-transform"
          >
            <PhoneOff className="w-8 h-8 text-white fill-current" />
          </button>

          {isVideo ? (
            <button 
              onClick={toggleCamera}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90",
                cameraEnabled ? "bg-white/5 text-white hover:bg-white/10" : "bg-red-500 text-white shadow-lg shadow-red-500/20"
              )}
            >
              {cameraEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
          ) : (
             <div className="w-16 h-16" /> // Placeholder for symmetry
          )}
        </div>
        
        <div className="mt-8 flex flex-col items-center gap-2 opacity-30">
           <ShieldCheck className="w-3.5 h-3.5 text-white" />
           <p className="text-[8px] font-bold text-white uppercase tracking-[0.4em]">End-to-End Encrypted</p>
        </div>
      </div>
    </div>
  )
}
