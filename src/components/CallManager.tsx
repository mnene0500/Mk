"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Phone, PhoneOff, Video, User } from "lucide-react"

export function CallManager() {
  const router = useRouter()
  const { user } = useUser()
  const [incomingCall, setIncomingCall] = useState<any>(null)

  useEffect(() => {
    if (!user?.id) return

    // Listen for global broadcast events via Supabase Realtime
    const channel = supabase.channel(`calls:${user.id}`)
      .on('broadcast', { event: 'incoming-call' }, (payload) => {
        setIncomingCall(payload.payload)
        // Auto-expire after 45s
        setTimeout(() => setIncomingCall(null), 45000)
      })
      .on('broadcast', { event: 'cancel-call' }, () => {
        setIncomingCall(null)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const handleAccept = () => {
    if (!incomingCall) return
    const { chatId, type, callerName, callerId, callerPhoto } = incomingCall
    setIncomingCall(null)
    router.push(`/call/${chatId}?type=${type}&partner=${encodeURIComponent(callerName)}&partnerId=${callerId}&partnerPhoto=${encodeURIComponent(callerPhoto)}&caller=false`)
  }

  const handleReject = () => {
    if (!incomingCall) return
    // Signal the caller that we declined
    supabase.channel(`calls:${incomingCall.callerId}`).send({
      type: 'broadcast',
      event: 'call-rejected',
      payload: { reason: 'declined' }
    })
    setIncomingCall(null)
  }

  if (!incomingCall) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 animate-in fade-in">
      <div className="relative flex flex-col items-center gap-8">
        <Avatar className="w-40 h-40 border-4 border-[#00A2FF] shadow-2xl">
          <AvatarImage src={incomingCall.callerPhoto} />
          <AvatarFallback><User /></AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h2 className="text-4xl font-black text-white">{incomingCall.callerName}</h2>
          <p className="text-[#00A2FF] font-bold uppercase tracking-widest mt-2">Incoming {incomingCall.type} call...</p>
        </div>
        <div className="flex gap-12 mt-8">
          <button onClick={handleReject} className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-xl transition-transform active:scale-90"><PhoneOff className="text-white" /></button>
          <button onClick={handleAccept} className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-xl animate-bounce transition-transform active:scale-90">
            {incomingCall.type === 'video' ? <Video className="text-white" /> : <Phone className="text-white" />}
          </button>
        </div>
      </div>
    </div>
  )
}
