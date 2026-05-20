
"use client"

import { useState, Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { doc } from "firebase/firestore"
import { ref, onValue, off } from "firebase/database"
import { useFirestore, useUser, useDoc, useMemoFirebase, useDatabase } from "@/firebase"
import { Button } from "@/components/ui/button"
import { 
  ChevronLeft, 
  CreditCard, 
  Loader2, 
  History, 
  Users, 
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Star
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { initiatePesaPalPayment, fulfillPaymentAction } from "@/app/actions/payment-actions"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

function CoinIcon({ className }: { className?: string }) {
  return (
    <div className={cn("w-10 h-10 rounded-full bg-gradient-to-tr from-[#FFD600] to-[#FFF500] flex items-center justify-center shadow-lg", className)}>
      <span className="text-white font-black text-xl italic drop-shadow-[0_2px_2px_rgba(0,0,0,0.2)]">S</span>
    </div>
  )
}

const PACKAGES = [
  { amount: 500, price: 80.0 },
  { amount: 1000, price: 120.0 },
  { amount: 2000, price: 230.0 },
  { amount: 5000, price: 550.0 },
  { amount: 10000, price: 1000.0 },
  { amount: 20000, price: 1800.0 },
]

function RechargeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const db = useFirestore()
  const rtdb = useDatabase()
  const { toast } = useToast()
  
  const [selectedPackage, setSelectedPackage] = useState<number | null>(2000)
  const [loading, setLoading] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [isFulfilling, setIsFulfilling] = useState(false)
  const [fulfillmentError, setFulfillmentError] = : string | null>(null)
  
  const [currentCoins, setCurrentCoins] = useState(0)

  const userRef = useMemoFirebase(() => (user?.uid && db) ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc<any>(userRef)

  useEffect(() => {
    const orderId = searchParams.get("OrderTrackingId") || searchParams.get("orderTrackingId");
    const merchantRef = searchParams.get("OrderMerchantReference") || searchParams.get("orderMerchantReference");
    
    if (orderId && merchantRef) {
      const runFulfillment = async () => {
        setIsFulfilling(true);
        try {
          const res = await fulfillPaymentAction(orderId, merchantRef);
          if (res.success) {
            toast({ 
              title: "Success!", 
              description: `Added ${res.coins || ''} coins to your wallet.`,
            });
            setTimeout(() => router.replace("/profile"), 2000);
          } else {
            setFulfillmentError(res.error || "Verification pending...");
            setTimeout(() => router.replace("/profile"), 3000);
          }
        } catch (e: any) {
          setFulfillmentError("Connection error during verification.");
          setTimeout(() => router.replace("/profile"), 3000);
        } finally {
          setIsFulfilling(false);
        }
      };
      runFulfillment();
    }
  }, [searchParams, router, toast]);

  useEffect(() => {
    if (!user?.uid || !rtdb) return
    
    const balanceRef = ref(rtdb, `balances/${user.uid}/coins`)
    const unsubscribe = onValue(balanceRef, (snapshot) => {
      if (snapshot.exists()) {
        setCurrentCoins(snapshot.val() || 0)
      }
    })

    return () => off(balanceRef, 'value', unsubscribe)
  }, [user?.uid, rtdb])

  const handlePayment = async () => {
    const pkg = PACKAGES.find(p => p.amount === selectedPackage)
    if (!user || !profile || !pkg) return
    
    setLoading(true)
    try {
      const result = await initiatePesaPalPayment(pkg.price, {
        uid: user.uid,
        email: user.email || `user_${user.uid}@qivo.app`,
        name: profile.name || "QIVO User"
      })
      
      if (result.success && result.redirect_url) {
        setPaymentUrl(result.redirect_url)
      } else {
        toast({ 
          variant: "destructive", 
          title: "Payment Error", 
          description: result.error || "Could not initiate payment." 
        })
      }
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "System Error", 
        description: "Failed to connect to payment server." 
      })
    } finally {
      setLoading(false)
    }
  }

  if (isFulfilling || fulfillmentError) {
    return (
      <div className="flex-1 bg-white min-h-screen flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in duration-500">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-blue-50 rounded-full" />
          {!fulfillmentError ? (
            <div className="w-24 h-24 border-4 border-[#00A2FF] border-t-transparent rounded-full animate-spin absolute inset-0" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-amber-500">
              <AlertCircle className="w-12 h-12" />
            </div>
          )}
          <CheckCircle2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-[#00A2FF] opacity-10" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-black uppercase tracking-tighter">
            {fulfillmentError ? "Hold on..." : "Confirming..."}
          </h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] leading-relaxed max-w-[200px] mx-auto text-center">
            {fulfillmentError || "Syncing with PesaPal Secure API. Don't close the app."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-[#F9FAFB] min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center justify-between bg-white border-b sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">My Wallet</h1>
        <Button variant="ghost" size="icon" onClick={() => router.push("/coin-history")} className="rounded-full">
          <History className="w-5 h-5 text-black" />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-6 pt-8 pb-32 space-y-10">
          <div className="bg-gradient-to-br from-[#00A2FF] to-[#0066CC] rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-white">
            <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12">
               <CoinIcon className="w-40 h-40" />
            </div>
            <div className="relative z-10 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Current Balance</p>
              <div className="flex items-center gap-4">
                <span className="text-6xl font-black tracking-tighter">{currentCoins}</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold opacity-60">QIVO</span>
                  <span className="text-xs font-bold opacity-60 uppercase tracking-widest">Coins</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Select Package</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {PACKAGES.map((p) => (
                <div 
                  key={p.amount} 
                  onClick={() => setSelectedPackage(p.amount)} 
                  className={cn(
                    "relative rounded-[2rem] h-36 flex flex-col items-center justify-center p-4 transition-all duration-300 active:scale-95 cursor-pointer border-2", 
                    selectedPackage === p.amount 
                      ? "bg-white border-[#00A2FF] shadow-[0_15px_30px_-5px_rgba(0,162,255,0.15)] ring-4 ring-blue-50" 
                      : "bg-white border-transparent shadow-sm hover:border-gray-200"
                  )}
                >
                  <CoinIcon className="w-8 h-8 mb-2" />
                  <span className="text-2xl font-black text-black tracking-tighter">{p.amount}</span>
                  <div className="bg-gray-50 px-3 py-1 rounded-full border border-gray-100 mt-2">
                    <span className="text-[10px] font-black text-[#00A2FF]">KES {p.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {profile?.country === 'Kenya' && (
            <div className="pt-2">
              <Button 
                onClick={() => router.push('/coin-sellers')}
                className="w-full h-20 bg-white hover:bg-gray-50 rounded-[2rem] border-none shadow-xl flex items-center justify-center gap-4 text-[#00A2FF] active:scale-95 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shadow-sm group-hover:bg-white transition-colors">
                  <Users className="w-5 h-5" /> 
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-black uppercase tracking-widest text-black">Certified Sellers</span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Buy via M-Pesa Directly</span>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto mr-2 opacity-40 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-xl p-6 border-t z-50">
        <div className="max-w-md mx-auto">
          <Button 
            disabled={loading || !selectedPackage} 
            className="w-full h-16 rounded-full bg-[#00A2FF] hover:bg-[#0081CC] text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-blue-200 active:scale-95 transition-all group" 
            onClick={handlePayment}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Pay KES {PACKAGES.find(p => p.amount === selectedPackage)?.price}</span>
              </div>
            )}
          </Button>
        </div>
      </footer>

      <Dialog open={!!paymentUrl} onOpenChange={(open) => !open && setPaymentUrl(null)}>
        <DialogContent className="max-w-none w-full h-[100dvh] p-0 border-none bg-white rounded-none flex flex-col overflow-hidden z-[9999] [&>button]:hidden">
          <DialogTitle className="sr-only">Secure Payment Checkout</DialogTitle>
          <div className="h-14 bg-white border-b flex items-center px-4">
             <Button variant="ghost" size="sm" onClick={() => setPaymentUrl(null)} className="rounded-full font-bold text-[10px] uppercase tracking-widest gap-2">
               <ChevronLeft className="w-4 h-4" /> Cancel Payment
             </Button>
             <div className="flex-1 flex justify-center items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                <span className="text-[9px] font-black uppercase tracking-widest">Secure Checkout</span>
             </div>
             <div className="w-20" />
          </div>
          <div className="flex-1 relative bg-gray-50">
            {paymentUrl && (
              <iframe 
                src={paymentUrl} 
                className="absolute inset-0 w-full h-full border-none"
                title="Payment Checkout"
                allow="payment"
              />
            )}
            <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center bg-white space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-50 rounded-full" />
                <div className="w-20 h-20 border-4 border-[#00A2FF] border-t-transparent rounded-full animate-spin absolute inset-0" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] animate-pulse">Establishing Secure Session...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function RechargePage() { 
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center h-screen bg-white"><Loader2 className="animate-spin text-[#00A2FF]" /></div>}>
      <RechargeContent />
    </Suspense>
  )
}
