"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Coins, ShieldCheck, Loader2, MessageSquare, ExternalLink } from "lucide-react"
import { useUser } from "@/firebase/auth/use-user"
import { useToast } from "@/hooks/use-toast"
import { initiatePesaPalPayment } from "@/app/actions/payment-actions"
import { cn } from "@/lib/utils"

const PACKAGES = [
  { id: "micro", label: "Micro Pack", coins: 10, price: 1, color: "bg-gray-50", text: "text-gray-600" },
  { id: "test", label: "Test Pack", coins: 500, price: 50, color: "bg-blue-50", text: "text-blue-600", popular: true },
  { id: "starter", label: "Basic Pack", coins: 2000, price: 200, color: "bg-gray-50", text: "text-gray-600" },
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
        <h1 className="text-base font-black text-black">Top Up</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-6 space-y-8 pb-20">
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-black">Select Package</h2>
          <p className="text-xs font-medium text-gray-400">Choose a coin bundle to continue.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {PACKAGES.map((pkg) => (
            <div 
              key={pkg.id} 
              className={cn(
                "relative group p-6 rounded-2xl border transition-all active:scale-[0.98]",
                pkg.popular ? "border-[#00A2FF] bg-blue-50/20" : "border-gray-100 bg-white"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", pkg.color)}>
                    <Coins className={cn("w-6 h-6", pkg.text)} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-black leading-none">{pkg.coins} Coins</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{pkg.label}</p>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handleBuy(pkg)}
                  disabled={!!loadingId}
                  className={cn(
                    "rounded-full px-6 h-10 font-black text-xs uppercase tracking-widest transition-all",
                    pkg.popular ? "bg-[#00A2FF] text-white" : "bg-black text-white"
                  )}
                >
                  {loadingId === pkg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : `KES ${pkg.price}`}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-50">
          <Button 
            onClick={() => router.push('/coin-sellers')}
            variant="ghost"
            className="w-full h-14 rounded-2xl bg-gray-50 flex items-center justify-between px-6 text-black font-bold text-xs hover:bg-gray-100 transition-all"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-[#00A2FF]" />
              Buy from Certified Seller
            </div>
            <ExternalLink className="w-4 h-4 opacity-30" />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 text-gray-300">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Secure Checkout</span>
        </div>
      </main>

      <footer className="p-8 text-center">
        <p className="text-[9px] font-medium text-gray-400 leading-relaxed uppercase tracking-widest px-6">
          Coins are added instantly after payment.
        </p>
      </footer>
    </div>
  )
}
