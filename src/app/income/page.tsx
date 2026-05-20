
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ref, get, update, increment as rtdbIncrement, push, set } from "firebase/database"
import { useUser, useDatabase } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft, Gem, History, Coins, ArrowRightLeft, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function IncomePage() {
  const router = useRouter()
  const { user } = useUser()
  const rtdb = useDatabase()
  const { toast } = useToast()
  
  const [balances, setBalances] = useState({ coins: 0, diamonds: 0 })
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [diamondsToConvert, setDiamondsToConvert] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.uid) {
      const cached = localStorage.getItem(`balance_cache_${user.uid}`)
      if (cached) setBalances(JSON.parse(cached))
    }
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return
    const fetchBalances = async () => {
      try {
        const snap = await get(ref(rtdb, `balances/${user.uid}`))
        if (snap.exists()) {
          const data = snap.val()
          const newBal = { coins: data.coins || 0, diamonds: data.diamonds || 0 }
          setBalances(newBal)
          localStorage.setItem(`balance_cache_${user.uid}`, JSON.stringify(newBal))
        }
      } finally {
        setBalanceLoading(false)
      }
    }
    fetchBalances()
  }, [rtdb, user?.uid])

  const diamondBalance = balances.diamonds
  const conversionRate = 0.09 // 1000 diamonds = 90 coins
  const minDiamonds = 1000
  const expectedCoins = Math.floor(Number(diamondsToConvert) * conversionRate)

  const handleConvert = async () => {
    const amount = Number(diamondsToConvert)
    if (isNaN(amount) || amount < minDiamonds) {
      toast({ variant: "destructive", title: "Invalid Amount", description: `Minimum conversion is ${minDiamonds} diamonds.` })
      return
    }
    if (amount > diamondBalance) {
      toast({ variant: "destructive", title: "Insufficient Balance" })
      return
    }

    setIsProcessing(true)
    try {
      const timestamp = Date.now()
      const balRef = ref(rtdb, `balances/${user?.uid}`)
      
      await update(balRef, {
        diamonds: rtdbIncrement(-amount),
        coins: rtdbIncrement(expectedCoins),
        updatedAt: timestamp
      })

      const updatedBal = {
        coins: balances.coins + expectedCoins,
        diamonds: balances.diamonds - amount
      }
      setBalances(updatedBal)
      if (user?.uid) localStorage.setItem(`balance_cache_${user.uid}`, JSON.stringify(updatedBal))

      const historyRef = push(ref(rtdb, `diamond_history/${user?.uid}`))
      await set(historyRef, {
        amount: -amount,
        type: 'conversion',
        description: `Converted to ${expectedCoins} coins`,
        timestamp
      })

      toast({ title: "Success!", description: `Added ${expectedCoins} coins to your wallet.` })
      setDiamondsToConvert("")
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Conversion failed." })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col relative overflow-hidden">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-sm font-bold text-black uppercase tracking-widest">My Income</h1>
        <Button variant="ghost" size="icon" onClick={() => router.push("/diamond-history")} className="rounded-full">
          <History className="w-5 h-5 text-black" />
        </Button>
      </header>

      <main className="flex-1 p-6 space-y-8">
        <div className="bg-gradient-to-br from-[#00A2FF] to-[#0081CC] p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-2">Total Diamonds</p>
            <div className="flex items-center gap-3">
              <Gem className="w-8 h-8 fill-blue-200" />
              <h2 className="text-4xl font-bold tracking-tight">
                {balanceLoading && balances.diamonds === 0 ? "..." : diamondBalance.toFixed(0)}
              </h2>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <Label className="text-[10px] font-bold uppercase text-gray-400">Convert Diamonds to Coins</Label>
              <span className="text-[9px] font-bold text-[#00A2FF] uppercase tracking-widest">Min: {minDiamonds}</span>
            </div>
            <div className="relative">
              <Input
                type="number"
                placeholder="0"
                value={diamondsToConvert}
                onChange={(e) => setDiamondsToConvert(e.target.value)}
                className="rounded-2xl h-16 pl-12 border-gray-100 bg-gray-50 text-lg font-bold"
              />
              <Gem className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
            </div>
          </div>

          {Number(diamondsToConvert) > 0 && (
            <div className="p-5 rounded-2xl border bg-blue-50 border-blue-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="text-[10px] font-bold text-black uppercase tracking-widest">You'll Receive</span>
              </div>
              <span className="text-xl font-bold text-blue-600">
                +{expectedCoins} Coins
              </span>
            </div>
          )}

          <Button
            className="w-full h-16 rounded-full bg-[#00A2FF] hover:bg-[#0081CC] text-white font-bold uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all"
            onClick={handleConvert}
            disabled={isProcessing || !diamondsToConvert || Number(diamondsToConvert) < minDiamonds}
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : (
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5" />
                Convert to Coins
              </div>
            )}
          </Button>
        </div>

        <div className="p-6 bg-gray-50 rounded-3xl">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-blue-600">i</span>
            </div>
            <p className="text-[11px] font-medium text-gray-500 leading-relaxed">
              Conversion Rate: 1000 Diamonds = 90 Coins. Coins can be used to chat and send gifts to other users across the QIVO network.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
