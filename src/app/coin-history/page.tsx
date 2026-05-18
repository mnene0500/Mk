"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ref, onValue, query as rtdbQuery, limitToLast, off } from "firebase/database"
import { useUser, useDatabase } from "@/firebase"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Coins, ArrowUpRight, ArrowDownRight, Loader2, ShoppingBag } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface Transaction {
  id: string
  amount: number
  type: string
  description: string
  timestamp: number
}

export default function CoinHistoryPage() {
  const router = useRouter()
  const { user } = useUser()
  const rtdb = useDatabase()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const historyRef = ref(rtdb, `coin_history/${user.uid}`)
    const historyQuery = rtdbQuery(historyRef, limitToLast(100))
    
    const unsubscribe = onValue(historyQuery, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ 
          id, 
          ...val 
        })).sort((a, b) => b.timestamp - a.timestamp)
        setTransactions(list)
      } else { 
        setTransactions([]) 
      }
      setLoading(false)
    })
    
    return () => off(historyRef, 'value', unsubscribe)
  }, [user?.uid, rtdb])

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center justify-between border-b sticky top-0 bg-white z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Wallet History</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Fetching Ledger...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-40 px-12 text-center space-y-4">
            <div className="w-20 h-20 bg-gray-50 rounded-[2.5rem] flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-gray-300" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-sm uppercase tracking-widest text-black">No Transactions</p>
              <p className="text-[10px] font-bold text-gray-400">Your coin usage will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((tx) => {
              const isCredit = tx.amount > 0
              return (
                <div key={tx.id} className="flex items-center justify-between p-6 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", 
                      isCredit ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {isCredit ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-[13px] text-black tracking-tight">{tx.description}</span>
                      <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
                        {format(tx.timestamp, "MMM d, HH:mm")} • {tx.type}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-lg font-black tracking-tighter", 
                        isCredit ? "text-green-600" : "text-red-600"
                      )}>
                        {isCredit ? '+' : ''}{tx.amount}
                      </span>
                      <div className={cn("w-4 h-4 rounded-full flex items-center justify-center", isCredit ? "bg-green-100" : "bg-red-100")}>
                        <Coins className={cn("w-2.5 h-2.5", isCredit ? "text-green-600" : "text-red-600")} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      
      <footer className="p-8 text-center bg-gray-50/30">
        <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.3em] leading-relaxed">
          Ledger synchronized with global MatchFlow economy.
        </p>
      </footer>
    </div>
  )
}
