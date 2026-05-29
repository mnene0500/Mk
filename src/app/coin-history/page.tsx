
"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const { data, error } = await supabase
      .from('coin_history')
      .select('id, amount, type, description, timestamp')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(50); // Fixed size: latest 50
    
    if (!error && data) {
      setTransactions(data)
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center justify-between border-b sticky top-0 bg-white z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Coin History</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00A2FF]" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-40 px-12 text-center space-y-4">
            <ShoppingBag className="w-10 h-10 text-gray-300" />
            <p className="font-black text-xs uppercase tracking-widest">No Transactions</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            <div className="bg-blue-50/50 p-4 text-center border-b">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Displaying 50 Latest Activities</p>
            </div>
            {transactions.map((tx) => {
              const isCredit = tx.amount > 0
              return (
                <div key={tx.id} className="flex items-center justify-between p-6 hover:bg-gray-50/50 transition-colors animate-in fade-in duration-300">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", isCredit ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                      {isCredit ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[13px] text-black truncate">{tx.description}</span>
                      <span className="text-[9px] font-black text-gray-300 uppercase">{format(tx.timestamp, "MMM d, HH:mm")}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-lg font-black tracking-tighter", isCredit ? "text-green-600" : "text-red-600")}>
                        {isCredit ? '+' : ''}{tx.amount}
                      </span>
                      <Coins className={cn("w-3.5 h-3.5", isCredit ? "text-green-600" : "text-red-600")} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
