
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Coins, Trophy, Loader2, AlertCircle, Wallet } from "lucide-react"
import { useUser } from "@/firebase/auth/use-user"
import { useToast } from "@/hooks/use-toast"
import { awardCoinsAction } from "@/app/actions/matchflow-actions"
import { supabase } from "@/lib/supabase"

export default function AwardCoinsPage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  
  const [targetId, setTargetId] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [balance, setBalance] = useState<number>(0)

  useEffect(() => {
    if (!user?.id) return
    const fetchData = async () => {
      const { data: p } = await supabase.from('users').select('*').eq('uid', user.id).single()
      const { data: b } = await supabase.from('balances').select('coins').eq('user_id', user.id).maybeSingle()
      if (p) setProfile(p)
      if (b) setBalance(Number(b.coins) || 0)
    }
    fetchData()

    // Realtime balance sync for Merchants
    const channel = supabase.channel(`merchant-bal-sync:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', table: 'balances', filter: `user_id=eq.${user.id}` }, (payload) => {
        setBalance(Number(payload.new.coins) || 0)
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const handleAward = async () => {
    if (!user || !targetId || !amount || isNaN(Number(amount))) return
    
    const numAmount = Number(amount);
    if (numAmount < 1) {
      toast({ variant: "destructive", title: "Error", description: "Invalid amount." });
      return;
    }

    // Only non-admin merchants are restricted by their own balance
    if (!profile?.is_admin && balance < numAmount) {
      toast({ variant: "destructive", title: "Insufficient Balance", description: "You don't have enough coins to transfer." });
      return;
    }

    setLoading(true)
    try {
      const result = await awardCoinsAction(user.id, targetId, numAmount)
      if (result.success) {
        toast({ title: "Transfer Successful", description: result.message })
        setTargetId("")
        setAmount("")
      } else {
        toast({ variant: "destructive", title: "Transfer Error", description: result.error })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Critical Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = profile?.is_admin

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-black">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Coin Merchant</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-8 flex flex-col items-center space-y-10">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-yellow-50 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
            <Coins className="w-10 h-10 text-yellow-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-black tracking-tight">Transfer QIVO Coins</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isAdmin ? "Admin (Unlimited Access)" : "Certified Merchant Portal"}
            </p>
          </div>
        </div>

        {!isAdmin && (
          <div className="w-full max-w-sm p-6 bg-gray-50 rounded-3xl border border-black/5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-xl"><Wallet className="w-5 h-5 text-[#00A2FF]" /></div>
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none">Your Balance</span>
            </div>
            <span className="text-lg font-black text-black">{balance} <span className="text-[10px] text-gray-400">Coins</span></span>
          </div>
        )}

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Recipient Numeric ID</label>
            <Input 
              placeholder="e.g. 1234567" 
              value={targetId} 
              onChange={(e) => setTargetId(e.target.value)} 
              className="rounded-2xl h-16 text-center text-xl font-bold tracking-widest border-gray-100 bg-gray-50 text-black placeholder:text-gray-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Amount to Transfer</label>
            <Input 
              type="number"
              placeholder="Enter amount" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              className="rounded-2xl h-16 text-center text-xl font-bold border-gray-100 bg-gray-50 text-black placeholder:text-gray-300"
            />
            <div className="flex items-center gap-1.5 px-2 text-[9px] font-bold text-amber-600 uppercase">
              <AlertCircle className="w-3 h-3" />
              Transfer will take effect immediately.
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
                Confirm Transfer
              </div>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}
