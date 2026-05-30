"use client"

import { useEffect, useState, Suspense, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Send, ChevronLeft, User, Gift, Trash2, MoreVertical, BadgeCheck, Loader2, Ban, Flag, PlusCircle, Coins } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/auth/use-user"
import { format } from "date-fns"
import { sendGiftAction, clearChatAction, sendMessageAction, markChatAsReadAction } from "@/app/actions/matchflow-actions"
import { useBalance } from "@/lib/providers/BalanceProvider"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

interface Message {
  id: string | number
  text: string
  sender_id: string
  timestamp: number
  is_gift?: boolean
  is_optimistic?: boolean
}

interface ChatSummary {
  id: string
  partner_id: string
  partner_name: string
  partner_photo: string
  partner_is_verified?: boolean
  last_message: string
  last_message_at: number
  unread_count: number
}

const GIFTS = [
  { name: "Rose", icon: "🌹", price: 10 },
  { name: "Coffee", icon: "☕", price: 50 },
  { name: "Heart", icon: "❤️", price: 100 },
  { name: "Fire", icon: "🔥", price: 300 },
  { name: "Bouquet", icon: "💐", price: 500 },
]

const PAGE_SIZE = 20;

function ChatsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user: currentUser, isInitialized } = useUser()
  const { coins } = useBalance()
  const startWithId = searchParams.get("startWith")
  
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[]>([])
  const [loadingSummaries, setLoadingSummaries] = useState(false)
  const [hasMoreSummaries, setHasMoreSummaries] = useState(true)
  const [summaryPage, setSummaryPage] = useState(0)

  const [chatId, setChatId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [partnerProfile, setPartnerProfile] = useState<any>(null)
  const [activeChatClearedAt, setActiveChatClearedAt] = useState<number>(-1)
  
  const [isGifting, setIsGifting] = useState(false)
  const [giftDialogOpen, setGiftDialogOpen] = useState(false)
  const [selectedGift, setSelectedGift] = useState<any>(null)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)

  const observerTarget = useRef<HTMLDivElement>(null)

  const fetchSummaries = useCallback(async (pageNum = 0) => {
    if (!currentUser?.id || loadingSummaries) return
    setLoadingSummaries(true)

    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: chatsData } = await supabase
        .from('chats')
        .select('*')
        .contains('participant_ids', [currentUser.id])
        .order('last_message_at', { ascending: false })
        .range(from, to);

      if (!chatsData || chatsData.length === 0) {
        setHasMoreSummaries(false);
        setLoadingSummaries(false);
        return;
      }

      const { data: userData } = await supabase.from('users').select('blocking, blocked_by').eq('uid', currentUser.id).single();
      const blockedUids = new Set([...(userData?.blocking || []), ...(userData?.blocked_by || [])]);

      const validChats = chatsData.filter(c => {
        const pId = c.participant_ids.find((id: string) => id !== currentUser.id);
        if (!pId || blockedUids.has(pId)) return false;
        const myClearedAt = (c.cleared_at as Record<string, number>)?.[currentUser.id] || 0;
        return (c.last_message_at > myClearedAt);
      });

      if (validChats.length === 0 && chatsData.length === PAGE_SIZE) {
        setLoadingSummaries(false);
        fetchSummaries(pageNum + 1);
        return;
      }

      const partnerIds = validChats.map(c => c.participant_ids.find((id: string) => id !== currentUser.id));
      const { data: profiles } = await supabase.from('users').select('uid, name, photo_url, is_verified').in('uid', partnerIds);
      const profileMap = new Map(profiles?.map(p => [p.uid, p]));

      const enhanced: ChatSummary[] = validChats.map(c => {
        const pId = c.participant_ids.find((id: string) => id !== currentUser.id);
        const p = profileMap.get(pId);
        const mySeenAt = (c.last_seen_at as Record<string, number>)?.[currentUser.id] || 0;
        return {
          id: c.id,
          partner_id: pId!,
          partner_name: p?.name || 'User',
          partner_photo: p?.photo_url || '',
          partner_is_verified: p?.is_verified,
          last_message: c.last_message || "",
          last_message_at: c.last_message_at || Date.now(),
          unread_count: (c.last_message_at > mySeenAt && c.last_sender_id !== currentUser.id) ? 1 : 0
        };
      });

      setChatSummaries(prev => pageNum === 0 ? enhanced : [...prev, ...enhanced]);
      setHasMoreSummaries(chatsData.length === PAGE_SIZE);
      setSummaryPage(pageNum);
    } finally {
      setLoadingSummaries(false);
    }
  }, [currentUser?.id, loadingSummaries]);

  useEffect(() => {
    if (currentUser?.id && !startWithId) {
      fetchSummaries(0);
    }
  }, [currentUser?.id, startWithId]);

  const handleSendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !chatId || !currentUser?.id || !startWithId) return;
    const ts = Date.now();
    const optimistic = { id: `temp-${ts}`, text, sender_id: currentUser.id, timestamp: ts, is_optimistic: true };
    setMessages(prev => [optimistic, ...prev]);
    setNewMessage("");
    const res = await sendMessageAction({ chatId, senderId: currentUser.id, recipientId: startWithId, text });
    if (!res.success) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      toast({ variant: "destructive", title: res.error === 'insufficient_funds' ? "Insufficient Coins" : "Error" });
    }
  };

  if (!isInitialized) return null;

  if (!startWithId) return (
    <div className="flex-1 bg-white min-h-screen relative select-none">
      <header className="px-6 h-16 flex items-center border-b sticky top-0 bg-white/90 backdrop-blur-md z-[50]">
        <h1 className="text-2xl font-black text-[#00A2FF] tracking-tight">Chats</h1>
      </header>
      <main className="flex flex-col">
        {chatSummaries.length === 0 && !loadingSummaries ? (
          <div className="flex flex-col items-center justify-center py-40 opacity-40 px-12 text-center text-gray-300">
            <User className="w-12 h-12 mb-4" /><p className="font-bold text-xs uppercase tracking-widest">No conversations</p>
          </div>
        ) : (
          chatSummaries.map(s => (
            <div key={s.id} onClick={() => router.push(`/chats?startWith=${s.partner_id}`)} className="p-4 flex items-center gap-4 active:bg-gray-50 border-b border-gray-50 transition-colors cursor-pointer">
              <div className="relative">
                <Avatar className="w-14 h-14 border"><AvatarImage src={s.partner_photo} /><AvatarFallback>{s.partner_name[0]}</AvatarFallback></Avatar>
                {s.unread_count > 0 && <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">{s.unread_count}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0"><p className="text-sm font-black truncate">{s.partner_name}</p>{s.partner_is_verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00A2FF] fill-blue-50" />}</div>
                  <span className="text-[9px] font-bold text-gray-300 uppercase shrink-0">{format(s.last_message_at, "HH:mm")}</span>
                </div>
                <p className={cn("text-xs truncate", s.unread_count > 0 ? "font-bold text-black" : "text-gray-400")}>{s.last_message}</p>
              </div>
            </div>
          ))
        )}
        {loadingSummaries && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#00A2FF]" /></div>}
      </main>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-white select-none overflow-hidden">
      <header className="h-16 border-b flex items-center px-4 gap-4 bg-white z-[50] shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ChevronLeft className="w-6 h-6 text-black" /></Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="w-10 h-10 border shrink-0"><AvatarImage src={partnerProfile?.photo_url} /><AvatarFallback>{partnerProfile?.name?.[0]}</AvatarFallback></Avatar>
          <p className="font-black text-sm truncate">{partnerProfile?.name || '...'}</p>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto p-6 flex flex-col-reverse gap-4 bg-gray-50 no-scrollbar">
        {messages.map(m => (
          <div key={m.id} className={cn("max-w-[85%] p-4 rounded-2xl text-sm font-medium shadow-sm animate-in fade-in duration-200", 
            m.sender_id === currentUser?.id ? "bg-[#00A2FF] text-white self-end rounded-br-none" : "bg-white text-black self-start rounded-bl-none border"
          )}>
            {m.text}
          </div>
        ))}
      </main>

      <footer className="p-4 border-t bg-white shrink-0">
        <div className="flex items-center gap-3 max-w-5xl mx-auto w-full">
          <input 
            value={newMessage} 
            onChange={e => setNewMessage(e.target.value)} 
            className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 outline-none" 
            placeholder="Type something..." 
          />
          <Button onClick={handleSendMessage} size="icon" disabled={!newMessage.trim()} className="rounded-full h-12 w-12 bg-[#00A2FF] text-white">
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default function ChatsPage() { return <Suspense fallback={null}><ChatsContent /></Suspense> }
