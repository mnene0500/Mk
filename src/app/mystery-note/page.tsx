
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { collection, query, where, limit, getDocs, doc } from "firebase/firestore"
import { ref, update, increment as rtdbIncrement, push, set, get } from "firebase/database"
import { useFirestore, useUser, useDoc, useDatabase } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, Coins, Users, Loader2, Send, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const RECIPIENT_OPTIONS = [2, 5, 10, 20]
const COST_PER_PERSON = 5

export default function MysteryNotePage() {
  const router = useRouter()
  const { user } = useUser()
  const db = useFirestore()
  const rtdb = useDatabase()
  const { toast } = useToast()

  const [message, setMessage] = useState("")
  const [recipientCount, setRecipientCount] = useState(2)
  const [isSending, setIsSending] = useState(false)
  const [userCoins, setUserCoins] = useState(0)

  const userRef = useMemo(() => (user?.uid && db) ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc<any>(userRef)

  useEffect(() => {
    if (!user?.uid || !rtdb) return
    const balRef = ref(rtdb, `balances/${user.uid}/coins`)
    get(balRef).then(snap => {
      if (snap.exists()) setUserCoins(snap.val())
    })
  }, [user?.uid, rtdb])

  const totalCost = recipientCount * COST_PER_PERSON

  const handleSend = async () => {
    if (!user || !profile || !message.trim() || !db || !rtdb) return
    if (userCoins < totalCost) {
      toast({ variant: "destructive", title: "Insufficient Coins", description: `You need ${totalCost} coins to send this note.` })
      return
    }

    setIsSending(true)
    try {
      const targetGender = profile.gender === 'male' ? 'female' : 'male'
      const q = query(
        collection(db, "users"),
        where("gender", "==", targetGender),
        where("onboardingComplete", "==", true),
        limit(50)
      )
      const snap = await getDocs(q)
      const allTargets = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as any))
        .filter(u => u.uid !== user.uid)
        .sort(() => Math.random() - 0.5)
        .slice(0, recipientCount)

      if (allTargets.length < recipientCount) {
        toast({ variant: "destructive", title: "Not enough users", description: "Could not find enough recipients." })
        setIsSending(false)
        return
      }

      const timestamp = Date.now()
      
      await update(ref(rtdb, `balances/${user.uid}`), {
        coins: rtdbIncrement(-totalCost),
        updatedAt: timestamp
      })
      await push(ref(rtdb, `coin_history/${user.uid}`), {
        amount: -totalCost,
        type: 'mystery_note',
        description: `Sent Mystery Note to ${recipientCount} people`,
        timestamp
      })

      for (const target of allTargets) {
        const ids = [user.uid, target.uid].sort()
        const chatId = `direct_${ids[0]}_${ids[1]}`

        const msgData = {
          text: message.trim(),
          senderId: user.uid,
          timestamp
        }
        
        await set(push(ref(rtdb, `chat_messages/${chatId}`)), msgData)

        const updates: any = {}
        updates[`user_chats/${user.uid}/${chatId}`] = {
          partnerId: target.uid,
          partnerName: target.name || "Unknown",
          partnerPhoto: target.photoURL || "",
          lastMessage: message.trim(),
          lastMessageAt: timestamp,
          unreadCount: 0
        }
        updates[`user_chats/${target.uid}/${chatId}`] = {
          partnerId: user.uid,
          partnerName: profile.name || "User",
          partnerPhoto: profile.photoURL || "",
          lastMessage: message.trim(),
          lastMessageAt: timestamp,
          unreadCount: rtdbIncrement(1)
        }
        await update(ref(rtdb), updates)
      }

      toast({ title: "Note Sent!", description: `Your note was delivered successfully.` })
      router.push("/chats")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex-1 bg-[#00A2FF] min-h-screen flex flex-col select-none relative overflow-hidden">
      <div className="absolute -top-10 -right-20 w-80 h-80 opacity-20 pointer-events-none rotate-12">
        <Sparkles className="w-full h-full text-white" />
      </div>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

      <header className="px-4 h-16 flex items-center bg-transparent z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-white hover:bg-white/10">
          <ChevronLeft className="w-8 h-8" />
        </Button>
      </header>

      <main className="flex-1 px-6 pt-4 pb-10 space-y-12 overflow-y-auto no-scrollbar relative z-10">
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-white tracking-tighter leading-tight animate-in fade-in slide-in-from-left-4 duration-700">
            Mystery<br/>Note
          </h1>
          <p className="text-sm font-bold text-white/70 uppercase tracking-[0.2em] ml-1">
            Send a secret message
          </p>
        </div>

        <div className="bg-white/15 backdrop-blur-2xl border border-white/20 rounded-[3rem] p-8 shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-white leading-tight">Write something<br/>anonymous...</h2>
            
            <div className="flex flex-wrap items-center gap-3">
               <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400 rounded-full shadow-lg border border-yellow-200">
                  <Coins className="w-3.5 h-3.5 text-yellow-800" />
                  <span className="text-[10px] font-black text-yellow-900 uppercase">5 coins / user</span>
               </div>
               
               <div className="flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full border border-white/20">
                  <Users className="w-3.5 h-3.5 text-white/80" />
                  <select 
                    value={recipientCount} 
                    onChange={(e) => setRecipientCount(Number(e.target.value))}
                    className="bg-transparent border-none text-[10px] font-black text-white outline-none cursor-pointer uppercase tracking-widest"
                  >
                    {RECIPIENT_OPTIONS.map(n => <option key={n} value={n} className="text-black">{n} People</option>)}
                  </select>
               </div>
            </div>
          </div>

          <div className="relative">
            <Textarea 
              placeholder="Type your note here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-white rounded-[2rem] min-h-[180px] border-none text-black font-bold placeholder:text-gray-300 p-6 text-sm resize-none focus-visible:ring-4 focus-visible:ring-white/20 shadow-inner"
            />
          </div>

          <Button 
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            className="w-full h-16 rounded-full bg-white text-[#00A2FF] hover:bg-gray-100 font-black uppercase tracking-[0.2em] text-sm shadow-xl active:scale-95 transition-all"
          >
            {isSending ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Blast to {recipientCount} Users
              </div>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}
