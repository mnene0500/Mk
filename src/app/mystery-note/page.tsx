"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, Coins, Loader2, Send, Zap, Target } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { sendMysteryNoteAction } from "@/app/actions/matchflow-actions"
import { cn } from "@/lib/utils"

const RECIPIENT_OPTIONS = [2, 3, 5, 10]
const COST_PER_PERSON = 10

export default function MysteryNotePage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()

  const [message, setMessage] = useState("")
  const [recipientCount, setRecipientCount] = useState(5)
  const [isSending, setIsSending] = useState(false)
  const [userCoins, setUserCoins] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.id) return
    
    const fetchBalance = async () => {
      const { data: b } = await supabase.from('balances').select('coins').eq('user_id', user.id).maybeSingle()
      if (b) setUserCoins(Number(b.coins) || 0)
    }

    fetchBalance()

    const channel = supabase.channel(`mystery-note-sync:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', table: 'balances', filter: `user_id=eq.${user.id}` }, (payload) => {
        setUserCoins(Number(payload.new.coins) || 0)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const totalCost = Number(recipientCount) * COST_PER_PERSON

  const handleSend = async () => {
    if (!user?.id || !message.trim()) return
    
    if (/\d{3,}/.test(message)) {
      toast({ variant: "destructive", title: "Security Block", description: "Sharing phone numbers or IDs is not allowed in blasts." });
      return;
    }

    const currentCoins = Number(userCoins ?? 0);
    const requiredCoins = Number(totalCost);

    if (userCoins === null) {
      toast({ title: "Checking wallet..." })
      return
    }

    if (currentCoins < requiredCoins) {
      toast({ 
        variant: "destructive", 
        title: "Insufficient Coins", 
        description: `You need ${requiredCoins} coins for this broadcast.` 
      })
      return
    }

    setIsSending(true)
    try {
      const res = await sendMysteryNoteAction(user.id, message, recipientCount)
      if (res.success) {
        toast({ title: "Blast Dispatched!", description: "Conversations have been started with chosen recipients." })
        router.push("/chats")
      } else {
        toast({ variant: "destructive", title: "Blast Failed", description: res.error })
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Signal Lost", description: "Please check your connection." })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex-1 bg-red-50 min-h-screen flex flex-col select-none relative overflow-hidden animate-in fade-in duration-500">
      <header className="px-4 h-16 flex items-center justify-between bg-transparent z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-black hover:bg-black/5">
          <ChevronLeft className="w-8 h-8" />
        </Button>
        <div className="px-4 py-1.5 bg-white rounded-full border border-black/5 flex items-center gap-2 shadow-sm">
           <Coins className="w-3.5 h-3.5 text-yellow-500 fill-current" />
           <span className="text-xs font-black text-black tracking-tighter">{userCoins ?? '...'}</span>
        </div>
      </header>

      <main className="flex-1 px-6 pt-4 pb-12 space-y-10 overflow-y-auto no-scrollbar relative z-[60]">
        <div className="space-y-2 px-2 text-center">
          <div className="w-20 h-20 bg-[#8B0000] rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl active:scale-90 transition-transform">
             <Zap className="w-10 h-10 text-white fill-current" />
          </div>
          <h1 className="text-4xl font-black text-black tracking-tighter leading-none uppercase italic">Message <span className="text-[#8B0000]">Blast</span></h1>
          <p className="text-[10px] font-black text-gray-400 tracking-[0.4em] uppercase">Targeted Global Transmission</p>
        </div>

        <div className="bg-white border border-black/5 rounded-[3.5rem] p-8 shadow-sm space-y-10 relative overflow-hidden">
          <div className="space-y-6">
            <div className="flex justify-between items-end">
               <div className="space-y-1">
                 <h2 className="text-2xl font-black text-black leading-none">The Broadcast</h2>
                 <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Sent only to opposite gender</p>
               </div>
               <div className="px-3 py-1 bg-yellow-400 rounded-lg shadow-md rotate-3">
                 <span className="text-[10px] font-black text-black tracking-tight">{COST_PER_PERSON} <Coins className="inline w-3 h-3 mb-0.5" /> / User</span>
               </div>
            </div>

            <div className="relative group z-20">
              <Textarea 
                placeholder="Broadcast your mood, a question, or a greeting..." 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                className="bg-gray-50 rounded-[2.5rem] min-h-[180px] border-none text-slate-900 font-bold p-8 text-base shadow-inner focus-visible:ring-2 focus-visible:ring-red-900/10 transition-all placeholder:text-slate-300 relative z-30" 
              />
            </div>
          </div>

          <div className="space-y-8 relative z-20">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] text-center">Opposite Gender Reach</p>
              <div className="flex flex-wrap justify-center gap-3">
                {RECIPIENT_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setRecipientCount(n)}
                    className={cn(
                      "px-6 py-3 rounded-2xl font-black text-xs transition-all border active:scale-90",
                      recipientCount === n 
                        ? "bg-[#8B0000] text-white border-[#8B0000] shadow-lg shadow-red-200" 
                        : "bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100"
                    )}
                  >
                    {n} PEERS
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center px-6">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gray-300" />
                  <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Required Power</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black text-black tracking-tighter">{totalCost}</span>
                  <Coins className="w-6 h-6 text-yellow-500 fill-current" />
                </div>
              </div>
              
              <Button 
                onClick={handleSend} 
                disabled={isSending || !message.trim() || userCoins === null} 
                className="w-full h-20 rounded-[2.5rem] bg-black text-white font-black tracking-[0.2em] text-sm shadow-xl active:scale-95 transition-all py-8 group"
              >
                {isSending ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    DISPATCHING...
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    INITIATE BLAST
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="p-8 text-center">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.5em]">QIVO Targeted Broadcast Engine v2.5</p>
      </footer>
    </div>
  )
}
