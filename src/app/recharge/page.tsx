
"use client"

import { useState, Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Loader2, History, CheckCircle2, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { initiatePesaPalPayment } from "@/app/actions/payment-actions"

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PACKAGES = [
  { amount: 500, price: 80.0 },
  { amount: 1000, price: 120.0 },
  { amount: 2000, price: 230.0 },
  { amount: 5000, price: 550.0 },
  { amount: 10000, price: 1000.0 },
  { amount: 20000, price: 1800.0 },
  { amount: 200, price: 1.0 } 
]

function RechargeContent() {
  const router = useRouter()
  const { user, loading: authLoading, isInitialized } = useUser()
  const { toast } = useToast()
  
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentCoins, setCurrentCoins] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.id) return
    const fetchBalance = async () => {
      const { data: b } = await supabase.from('balances').select('coins').eq('user_id', user.id).maybeSingle()
      if (b) setCurrentCoins(Number(b.coins) || 0)
    }
    fetchBalance()

    const channel = supabase.channel(`recharge-live-sync:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', table: 'balances', filter: `user_id=eq.${user.id}` }, (payload) => {
        setCurrentCoins(Number(payload.new.coins) || 0)
        toast({ title: "Wallet Updated!" })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const handlePayment = async () => {
    const pkg = PACKAGES.find(p => p.amount === selectedPackage)
    if (!user || !pkg) return
    setLoading(true)
    try {
      const result = await initiatePesaPalPayment(pkg.price, {
        uid: user.id,
        email: user.email || `user_${user.id}@qivo.app`,
        name: user.user_metadata?.full_name || "QIVO User"
      })
      if (result.success && result.redirect_url) {
        window.location.href = result.redirect_url;
      } else {
        toast({ variant: "destructive", title: "Payment Error", description: result.error })
        setLoading(false)
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Connection Failure" })
      setLoading(false)
    }
  }

  if (authLoading || !isInitialized) return <div className="flex-1 flex items-center justify-center h-screen bg-white"><Loader2 className="animate-spin text-[#00A2FF]" /></div>

  return (
    <div className="flex-1 bg-[#F9FAFB] min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center justify-between bg-white border-b sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ChevronLeft className="w-6 h-6 text-black" /></Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Recharge</h1>
        <Button variant="ghost" size="icon" onClick={() => router.push("/coin-history")} className="rounded-full"><History className="w-5 h-5 text-black" /></Button>
      </header>
      <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="px-6 pt-8 space-y-8">
          <div className="bg-gradient-to-br from-[#00A2FF] to-[#0066CC] rounded-[2.5rem] p-8 shadow-2xl text-white relative overflow-hidden">
            <Zap className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Balance</p>
              <div className="flex items-center gap-4 mt-1"><span className="text-6xl font-black tracking-tighter">{currentCoins ?? "..."}</span><span className="text-xs font-bold opacity-60 uppercase tracking-widest">Coins</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {PACKAGES.map((p) => (
              <div key={p.amount} onClick={() => setSelectedPackage(p.amount)} className={cn("relative rounded-[2rem] h-32 flex flex-col items-center justify-center p-4 transition-all active:scale-95 cursor-pointer border-2", selectedPackage === p.amount ? "bg-white border-[#00A2FF] shadow-xl" : "bg-white border-transparent shadow-sm")}>
                <span className="text-2xl font-black text-black tracking-tighter">{p.amount}</span>
                <div className="bg-gray-50 px-3 py-1 rounded-full border border-gray-100 mt-2"><span className="text-[10px] font-black text-[#00A2FF]">KES {p.price}</span></div>
                {selectedPackage === p.amount && <div className="absolute -top-2 -right-2 bg-[#00A2FF] rounded-full p-1 shadow-lg"><CheckCircle2 className="w-4 h-4 text-white" /></div>}
              </div>
            ))}
          </div>
        </div>
      </main>
      <footer className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-xl p-6 border-t z-50">
        <Button disabled={loading || !selectedPackage} className="w-full h-16 rounded-full bg-[#00A2FF] text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl active:scale-95 transition-all" onClick={handlePayment}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : selectedPackage ? `Pay KES ${PACKAGES.find(p => p.amount === selectedPackage)?.price}` : "Select Package"}
        </Button>
      </footer>
    </div>
  )
}

export default function RechargePage() { return <Suspense fallback={<div className="h-screen bg-white" />}><RechargeContent /></Suspense> }
