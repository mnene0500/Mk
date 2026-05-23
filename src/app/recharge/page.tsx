"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Coins, ShieldCheck, Loader2, MessageSquare, ExternalLink, Zap } from "lucide-react"
import { useUser } from "@/firebase/auth/use-user"
import { useToast } from "@/hooks/use-toast"
import { initiatePesaPalPayment } from "@/app/actions/payment-actions"
import { cn } from "@/lib/utils"

const PACKAGES = [
  { id: "p1", label: "10", coins: 10, price: 1 },
  { id: "p2", label: "100", coins: 100, price: 10 },
  { id: "p3", label: "500", coins: 500, price: 50, popular: true },
  { id: "p4", label: "1K", coins: 1000, price: 100 },
  { id: "p5", label: "2K", coins: 2000, price: 200 },
  { id: "p6", label: "5K", coins: 5000, price: 500 },
  { id: "p7", label: "10K", coins: 10000, price: 1000 },
  { id: "p8", label: "20K", coins: 20000, price: 2000 },
  { id: "p9", label: "50K", coins: 50000, price: 5000 },
]

export default function RechargePage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleBuy = async (pkg: typeof PACKAGES[0]) => {
    if (!user) {
      router.push("/auth")
      return
    }
    
    setLoadingId(pkg.id)
    try {
      const res = await initiatePesaPalPayment(user.id, pkg.price, pkg.coins)
      if (res.success && res.redirect_url) {
        window.location.href = res.redirect_url
      } else {
        toast({ variant: "destructive", title: "Gateway Error", description: res.error || "Failed to initiate payment." })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to payment server." })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none animate-in fade-in duration-500">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-black">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-base font-black text-black uppercase tracking-widest">Recharge</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-5 space-y-8 pb-24">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black tracking-tighter text-black uppercase">Coin Shop</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select a pack to top up</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {PACKAGES.map((pkg) => (
            <button 
              key={pkg.id} 
              onClick={() => handleBuy(pkg)}
              disabled={!!loadingId}
              className={cn(
                "relative group flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all active:scale-95 h-32",
                pkg.popular 
                  ? "border-[#00A2FF] bg-blue-50/30 shadow-lg shadow-blue-100" 
                  : "border-gray-50 bg-gray-50/50 hover:border-gray-200"
              )}
            >
              {pkg.popular && (
                <div className="absolute -top-2 px-2 py-0.5 bg-[#00A2FF] text-white text-[7px] font-black rounded-full uppercase tracking-tighter">
                  Popular
                </div>
              )}
              
              <div className="flex flex-col items-center gap-1 mb-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center mb-1",
                  pkg.popular ? "bg-blue-100" : "bg-white shadow-sm"
                )}>
                  {loadingId === pkg.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#00A2FF]" />
                  ) : (
                    <Coins className={cn("w-4 h-4", pkg.popular ? "text-[#00A2FF]" : "text-yellow-500")} />
                  )}
                </div>
                <span className="text-sm font-black text-black leading-none">{pkg.label}</span>
                <span className="text-[8px] font-bold text-gray-400 uppercase">Coins</span>
              </div>
              
              <div className="mt-auto">
                <span className="text-[10px] font-black text-[#00A2FF]">KES {pkg.price}</span>
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

      <footer className="fixed bottom-0 inset-x-0 p-6 bg-white/80 backdrop-blur-md border-t border-gray-50 z-40">
        <p className="text-[8px] font-bold text-gray-400 leading-relaxed uppercase tracking-widest text-center px-8">
          By purchasing, you agree to our Terms. Coins are non-refundable and added instantly.
        </p>
      </footer>
    </div>
  )
}
