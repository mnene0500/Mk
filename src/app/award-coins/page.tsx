"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Coins, Trophy, Loader2, AlertCircle } from "lucide-react"
import { useUser } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { awardCoinsAction } from "@/app/actions/matchflow-actions"

export default function AwardCoinsPage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  const [targetId, setTargetId] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAward = async () => {
    if (!user || !targetId || !amount || isNaN(Number(amount))) return
    
    const numAmount = Number(amount);
    if (numAmount < 500) {
      toast({ variant: "destructive", title: "Error", description: "Minimum award is 500 coins." });
      return;
    }

    setLoading(true)
    try {
      const result = await awardCoinsAction(user.uid, targetId, numAmount)
      if (result.success) {
        toast({ title: "Coins Awarded", description: result.message })
        router.back()
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      <header className="px-4 h-16 flex items-center justify-between border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-black">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-base font-black text-black">Award Coins</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-8 flex flex-col items-center justify-center space-y-10">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-yellow-50 rounded-[2.5rem] flex items-center justify-center mx-auto">
            <Coins className="w-10 h-10 text-yellow-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-black tracking-tight">Send MatchFlow Coins</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Certified Seller Tools</p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">User Numeric ID</label>
            <Input 
              placeholder="e.g. 1234567" 
              value={targetId} 
              onChange={(e) => setTargetId(e.target.value)} 
              className="rounded-2xl h-16 text-center text-xl font-bold tracking-widest border-gray-100 bg-gray-50 text-black placeholder:text-gray-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Coin Amount</label>
            <Input 
              type="number"
              placeholder="Min 500" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              className="rounded-2xl h-16 text-center text-xl font-bold border-gray-100 bg-gray-50 text-black placeholder:text-gray-300"
            />
            <div className="flex items-center gap-1.5 px-2 text-[9px] font-bold text-amber-600 uppercase">
              <AlertCircle className="w-3 h-3" />
              Limit: 500 - 50,000 Coins
            </div>
          </div>

          <Button 
            onClick={handleAward} 
            disabled={loading || !targetId || !amount}
            className="w-full h-16 rounded-full bg-black text-white font-black uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Confirm Award
              </div>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}
