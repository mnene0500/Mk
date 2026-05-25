"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { BottomNav } from "./BottomNav"
import { Suspense, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Phone, Video, PhoneOff, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"

/**
 * @fileOverview Signaling Shell for incoming calls and persistent navigation.
 */
function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()
  
  const [incomingCall, setIncomingCall] = useState<any>(null)
  const [callerProfile, setCallerProfile] = useState<any>(null)

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel(`calls-signaling-${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        table: 'calls', 
        filter: `receiver_id=eq.${user.id}` 
      }, async (payload) => {
        if (payload.new.status === 'calling') {
          const { data } = await supabase.from('users').select('*').eq('uid', payload.new.caller_id).single()
          setCallerProfile(data)
          setIncomingCall(payload.new)
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        table: 'calls',
        filter: `receiver_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new.status === 'ended') {
          setIncomingCall(null)
        }
      })
      .subscribe()

    return () => { 
      supabase.removeChannel(channel)
      setIncomingCall(null) 
    }
  }, [user?.id])

  const handleAccept = () => {
    if (!incomingCall) return
    const call = incomingCall
    setIncomingCall(null)
    router.push(`/call/${call.chat_id}?type=${call.type}&partnerId=${call.caller_id}&callId=${call.id}`)
  }

  const handleReject = async () => {
    if (!incomingCall) return
    await supabase.from('calls').update({ status: 'ended' }).eq('id', incomingCall.id)
    setIncomingCall(null)
  }
  
  const isChatDetail = pathname === '/chats' && searchParams.has('startWith')
  const isCallPage = pathname?.startsWith('/call')
  const isVisible = ['/home', '/chats', '/profile'].includes(pathname || "") && !isChatDetail && !isCallPage

  return (
    <div className="flex-1 flex flex-col relative min-h-screen overflow-x-hidden">
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      {isVisible && <BottomNav />}

      <Dialog open={!!incomingCall} onOpenChange={(open) => !open && handleReject()}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-[85vw] border-none shadow-2xl bg-zinc-900 text-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
          <DialogHeader className="items-center text-center relative z-10">
            <div className="relative mb-6">
               <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
               <Avatar className="w-24 h-24 border-4 border-white/10 shadow-2xl relative z-10">
                 <AvatarImage src={callerProfile?.photo_url} className="object-cover" />
                 <AvatarFallback className="bg-zinc-800 text-zinc-500"><User className="w-10 h-10" /></AvatarFallback>
               </Avatar>
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight">{callerProfile?.name || 'Incoming Call'}</DialogTitle>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mt-1">
              Incoming {incomingCall?.type === 'video' ? 'Video' : 'Voice'} Call
            </p>
          </DialogHeader>
          <div className="flex gap-4 mt-10 relative z-10">
            <Button onClick={handleReject} variant="destructive" className="flex-1 h-16 rounded-full shadow-xl shadow-red-500/20 active:scale-95 transition-all">
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button onClick={handleAccept} className="flex-1 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-xl shadow-green-500/20 active:scale-95 transition-all">
              {incomingCall?.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-1 bg-white" />}>
      <ShellContent>
        {children}
      </ShellContent>
    </Suspense>
  )
}
