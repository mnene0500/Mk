"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Coins, LayoutGrid, Loader2, Sparkles, Star, Info, Trophy } from "lucide-react"
import { useUser } from "@/firebase/auth/use-user"
import { useToast } from "@/hooks/use-toast"
import { useBalance } from "@/lib/providers/BalanceProvider"
import { playSlotsAction } from "@/app/actions/matchflow-actions"
import { cn } from "@/lib/utils"

const STAKES = [10, 20, 50, 100, 500]
const SYMBOLS = ["bar", "cherry", "crown"]
const ICON_MAP: Record<string, string> = {
  bar: "🍫",
  cherry: "🍒",
  crown: "👑"
}

export default function SlotMachinePage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  const { coins } = useBalance()
  
  const [selectedStake, setSelectedStake] = useState(20)
  const [isSpinning, setIsSpinning] = useState(false)
  const [reels, setReels] = useState(["cherry", "bar", "crown"])
  const [lastWin, setLastWin] = useState<number | null>(null)

  const handleSpin = async () => {
    if (!user || isSpinning) return
    if (coins < selectedStake) {
      toast({ variant: "destructive", title: "Insufficient Coins" })
      return
    }

    setIsSpinning(true)
    setLastWin(null)

    try {
      const res = await playSlotsAction(user.id, selectedStake)
      
      if (res.success && res.slots) {
        // Start reel shuffle animation
        let counter = 0
        const interval = setInterval(() => {
          setReels([
            SYMBOLS[Math.floor(Math.random() * 3)],
            SYMBOLS[Math.floor(Math.random() * 3)],
            SYMBOLS[Math.floor(Math.random() * 3)]
          ])
          counter++
          if (counter > 20) {
            clearInterval(interval)
            setReels(res.slots)
            setIsSpinning(false)
            
            if (res.winAmount > 0) {
              setLastWin(res.winAmount)
              toast({ title: "WINNER!", description: res.message || "Winnings added to your wallet." })
            } else {
              toast({ title: "You Lost", description: res.message || "Better luck next time!" })
            }
          }
        }, 100)
      } else {
        throw new Error(res.error)
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
      setIsSpinning(false)
    }
  }

  return (
    <div className="flex-1 bg-[#0F0F0F] min-h-screen flex flex-col select-none overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,#6366F1_0%,transparent_70%)]" />
      </div>

      <header className="px-4 h-16 flex items-center justify-between sticky top-0 z-[60] bg-black/40 backdrop-blur-md">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-white/60 hover:text-white">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-2 bg-black/50 px-4 py-1.5 rounded-full border border-white/10">
          <Coins className="w-3.5 h-3.5 text-yellow-500 fill-current" />
          <span className="text-xs font-black text-white">{coins}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 relative z-10">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase">Slot <span className="text-indigo-500">Machine</span></h1>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Match 3 & Multiply Your Luck</p>
        </div>

        {/* SLOT REELS */}
        <div className="w-full max-w-sm bg-zinc-900 rounded-[3rem] p-6 border-8 border-indigo-950 shadow-[0_0_80px_rgba(99,102,241,0.15)] relative">
           {/* Center Line */}
           <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500/20 z-0" />
           
           <div className="flex justify-between gap-4 relative z-10">
             {reels.map((symbol, i) => (
               <div key={i} className="flex-1 aspect-[3/4] bg-black rounded-2xl border-4 border-zinc-800 flex items-center justify-center shadow-inner overflow-hidden">
                  <div className={cn(
                    "text-5xl transition-all duration-300",
                    isSpinning && "animate-bounce"
                  )}>
                    {ICON_MAP[symbol]}
                  </div>
               </div>
             ))}
           </div>
        </div>

        {/* CONTROLS */}
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3">
             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Set Stake</p>
             <div className="flex justify-between gap-1.5">
               {STAKES.map((stake) => (
                 <button
                   key={stake}
                   disabled={isSpinning}
                   onClick={() => { setSelectedStake(stake); setLastWin(null); }}
                   className={cn(
                     "flex-1 h-11 rounded-xl border font-black text-[10px] transition-all active:scale-90",
                     selectedStake === stake 
                       ? "bg-indigo-500 border-indigo-400 text-white shadow-lg" 
                       : "bg-white/5 border-white/5 text-white/40"
                   )}
                 >
                   {stake}
                 </button>
               ))}
             </div>
          </div>

          <Button
            onClick={handleSpin}
            disabled={isSpinning || coins < selectedStake}
            className={cn(
              "w-full h-18 py-7 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all",
              isSpinning ? "bg-indigo-900/20 text-indigo-500" : "bg-indigo-600 text-white hover:bg-indigo-500"
            )}
          >
            {isSpinning ? <Loader2 className="w-6 h-6 animate-spin" /> : "Pull Lever"}
          </Button>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">3x Cherries</span>
                <span className="text-xs font-black text-green-400">10x STAKE</span>
             </div>
             <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">3x Crowns</span>
                <span className="text-xs font-black text-yellow-400">+50 COINS</span>
             </div>
          </div>
        </div>
      </main>

      {/* WIN OVERLAY */}
      {lastWin !== null && lastWin > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-10 animate-in fade-in zoom-in duration-300" onClick={() => setLastWin(null)}>
           <div className="bg-indigo-600 p-10 rounded-[3rem] text-center space-y-6 shadow-[0_0_100px_rgba(99,102,241,0.5)] border-4 border-white/20">
             <Trophy className="w-20 h-20 text-white mx-auto animate-bounce" />
             <div className="space-y-1">
               <h3 className="text-4xl font-black text-white tracking-tighter uppercase italic">Big Win!</h3>
               <div className="flex items-center justify-center gap-3 text-white bg-black px-6 py-2 rounded-full mt-4">
                 <Coins className="w-6 h-6 fill-current text-yellow-500" />
                 <span className="text-3xl font-black">+{lastWin}</span>
               </div>
             </div>
             <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em]">Added to Wallet</p>
           </div>
        </div>
      )}
    </div>
  )
}
