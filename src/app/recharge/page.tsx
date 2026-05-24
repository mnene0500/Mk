"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Coins, ShieldCheck, Loader2, MessageSquare, ExternalLink, Zap, Check } from "lucide-react"
import { useUser } from "@/firebase/auth/use-user"
import { useToast } from "@/hooks/use-toast"
import { initiatePesaPalPayment } from "@/app/actions/payment-actions"
import { cn } from "@/lib/utils"
import { useBalance } from "@/lib/providers/BalanceProvider"

const PACKAGES = [
  { id: "p1", label: "10", coins: 10, price: 1 },
  { id: "p2", label: "500", coins: 500, price: 60 },
  { id: "p3", label: "1K", coins: 1000, price: 120, popular: true },
  { id: "p4", label: "1.5K", coins: 1500, price: 180 },
  { id: "p5", label: "2K", coins: 2000, price: 240 },
  { id: "p6", label: "5K", coins: 5000, price: 600 },
]

export default function RechargePage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  const { coins } = useBalance()
  
  const [selectedId, setSelectedId] = useState<string>("p3")
  const [isProcessing, setIsProcessing] = useState(false)

  const selectedPackage = PACKAGES.find(p => p.id === selectedId) || PACKAGES[2]

  const handleRecharge = async () => {
    if (!user) {
      router.push("/auth")
      return
    }
    
    setIsProcessing(true)
    try {
      const res = await initiatePesaPalPayment(user.id, selectedPackage.price, selectedPackage.coins)
      if (res.success && res.redirect_url) {
        window.location.href = res.redirect_url
      } else {
        toast({ variant: "destructive", title: "Gateway Error", description: res.error || "Failed to initiate payment." })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to payment server." })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none animate-in fade-in duration-500">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-black">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-base font-black text-black uppercase tracking-widest">Recharge</h1>
        <div className="flex items-center gap-1 font-bold text-lg">
            <Coins className='w-5 h-5 text-yellow-500'/>
            {coins}
        </div>
      </header>

      <main className="flex-1 p-5 space-y-8 pb-32">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black tracking-tighter text-black uppercase">Coin Shop</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select a pack to top up</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {PACKAGES.map((pkg) => (
            <button 
              key={pkg.id} 
              onClick={() => setSelectedId(pkg.id)}
              className={cn(
                "relative group flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all active:scale-95 h-32",
                selectedId === pkg.id 
                  ? "border-[#00A2FF] bg-blue-50/50 shadow-lg shadow-blue-100" 
                  : "border-gray-50 bg-gray-50/30 hover:border-gray-100"
              )}
            >
              {selectedId === pkg.id && (
                <div className="absolute -top-2 -right-1 bg-[#00A2FF] text-white p-1 rounded-full shadow-lg">
                  <Check className="w-3 h-3" />
                </div>
              )}
              
              <div className="flex flex-col items-center gap-1 mb-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-colors",
                  selectedId === pkg.id ? "bg-[#00A2FF] text-white" : "bg-white shadow-sm text-yellow-500"
                )}>
                  <Coins className="w-4 h-4" />
                </div>
                <span className="text-sm font-black text-black leading-none">{pkg.label}</span>
                <span className="text-[8px] font-bold text-gray-400 uppercase">Coins</span>
              </div>
              
              <div className="mt-auto">
                <span className={cn(
                  "text-[10px] font-black",
                  selectedId === pkg.id ? "text-[#00A2FF]" : "text-gray-400"
                )}>KES {pkg.price}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <Button 
            onClick={() => router.push('/coin-sellers')}
            variant="ghost"
            className="w-full h-14 rounded-2xl bg-gray-50 flex items-center justify-between px-6 text-black font-bold text-xs hover:bg-gray-100 transition-all border border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="bg-[#00A2FF]/10 p-2 rounded-lg">
                <MessageSquare className="w-4 h-4 text-[#00A2FF]" />
              </div>
              <span className="uppercase tracking-tight text-[10px] font-black">Offline Merchants</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 opacity-30" />
          </Button>

          <div className="flex items-center justify-center gap-2 text-gray-300 py-4">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Secure PesaPal Channel</span>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 inset-x-0 p-6 bg-white/90 backdrop-blur-md border-t border-gray-50 z-40 flex flex-col gap-4">
        <Button 
          onClick={handleRecharge}
          disabled={isProcessing}
          className="w-full h-16 rounded-full bg-[#00A2FF] hover:bg-[#0081CC] text-white font-black uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all"
        >
          {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : (
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 fill-current text-yellow-300" />
              Recharge Now (KES {selectedPackage.price})
            </div>
          )}
        </Button>
        <p className="text-[8px] font-bold text-gray-400 leading-relaxed uppercase tracking-widest text-center px-8">
          By purchasing, you agree to our Terms. Coins are non-refundable and added instantly.
        </p>
      </footer>
    </div>
  )
}
