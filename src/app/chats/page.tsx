"use client"

import { useEffect, useState, Suspense, useMemo, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { BottomNav } from "@/components/layout/BottomNav"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Send, ChevronLeft, Loader2, Video, Phone, MessageSquare } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/auth/use-user"

interface Message {
  id: string
  text: string
  sender_id: string
  timestamp: number
  is_gift?: boolean
}

interface ChatSummary {
  id: string
  partner_id: string
  partner_name: string
  partner_photo: string
  last_message: string
  last_message_at: number
  unread_count: number
}

let globalChatCache: ChatSummary[] = [];

function ChatsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user: currentUser, loading: authLoading } = useUser()
  const startWithId = searchParams.get("startWith")
  
  const [chatId, setChatId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[]>(globalChatCache)
  const [loading, setLoading] = useState(globalChatCache.length === 0)
  const [partnerProfile, setPartnerProfile] = useState<any>(null)

  useEffect(() => {
    if (!currentUser?.id) return
    
    const fetchSummaries = async () => {
      const { data } = await supabase.from('chats').select('*').contains('participant_ids', [currentUser.id])
      if (data) {
        const summaries = data.map(c => {
          const partnerIdx = c.participant_ids.find((id: string) => id !== currentUser.id)
          return { id: c.id, partner_id: partnerIdx, last_message: c.last_message, last_message_at: c.last_message_at, unread_count: 0 } as any
        })
        setChatSummaries(summaries)
        globalChatCache = summaries
      }
      setLoading(false)
    }

    fetchSummaries()

    const channel = supabase.channel('chat_updates')
      .on('postgres_changes', { event: '*', table: 'chats' }, () => fetchSummaries())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUser?.id])

  useEffect(() => {
    if (currentUser?.id && startWithId) {
      const ids = [currentUser.id, startWithId].sort()
      const cId = `direct_${ids[0]}_${ids[1]}`
      setChatId(cId)
      supabase.from('users').select('*').eq('uid', startWithId).single().then(({ data }) => setPartnerProfile(data))
    }
  }, [currentUser?.id, startWithId])

  useEffect(() => {
    if (!chatId) return
    
    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('timestamp', { ascending: false }).limit(50)
      if (data) setMessages(data)
    }
    fetchMessages()

    const channel = supabase.channel(`chat:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages(prev => [payload.new as Message, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [chatId])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chatId || !currentUser?.id) return
    const timestamp = Date.now()
    const msg = { chat_id: chatId, text: newMessage.trim(), sender_id: currentUser.id, timestamp }
    await supabase.from('messages').insert(msg)
    await supabase.from('chats').upsert({ id: chatId, last_message: newMessage.trim(), last_message_at: timestamp, participant_ids: [currentUser.id, startWithId] })
    setNewMessage("")
  }

  if (!startWithId) return (
    <div className="flex-1 bg-white min-h-screen pb-20">
      <header className="p-4 border-b"><h1 className="text-xl font-bold text-[#00A2FF]">Messages</h1></header>
      <main>
        {chatSummaries.length === 0 ? <div className="py-20 text-center text-gray-400">No chats yet</div> : chatSummaries.map(s => (
          <div key={s.id} onClick={() => router.push(`/chats?startWith=${s.partner_id}`)} className="p-4 border-b flex items-center gap-4">
            <Avatar className="w-12 h-12"><AvatarFallback>U</AvatarFallback></Avatar>
            <div className="flex-1"><p className="font-bold text-sm">User {s.partner_id.slice(0, 4)}</p><p className="text-xs text-gray-500 truncate">{s.last_message}</p></div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="h-16 border-b flex items-center px-4 gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/chats')}><ChevronLeft /></Button>
        <span className="font-bold flex-1">{partnerProfile?.name || 'Loading...'}</span>
      </header>
      <main className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-4">
        {messages.map(m => (
          <div key={m.id} className={cn("max-w-[80%] p-3 rounded-2xl text-sm", m.sender_id === currentUser?.id ? "bg-[#00A2FF] text-white self-end" : "bg-gray-100 text-black self-start")}>
            {m.text}
          </div>
        ))}
      </main>
      <footer className="p-4 border-t flex gap-2">
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} className="flex-1 bg-gray-50 rounded-full px-4 text-sm" placeholder="Type..." />
        <Button onClick={handleSendMessage} size="icon" className="rounded-full bg-[#00A2FF]"><Send className="w-4 h-4" /></Button>
      </footer>
    </div>
  )
}

export default function ChatsPage() { return <Suspense fallback={<Loader2 className="animate-spin" />}><ChatsContent /></Suspense> }
