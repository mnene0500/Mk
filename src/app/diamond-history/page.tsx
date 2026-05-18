"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ref, onValue, query as rtdbQuery, limitToLast, off } from "firebase/database"
import { useUser, useDatabase } from "@/firebase"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Gem, ArrowUp, ArrowDown, Loader2, History } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface Transaction {
  id: string
  amount: number
  type: 'gift' | 'reply' | 'conversion' | 'withdrawal'
  description: string
  timestamp: number
}

export default function DiamondHistoryPage() {
  const router = useRouter()
  const { user } = useUser()
  const rtdb = useDatabase()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const historyRef = ref(rtdb, `diamond_history/${user.uid}`)
    const historyQuery = rtdbQuery(historyRef, limitToLast(50))
    
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
        <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-black">Diamond Statement</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#00A2FF]" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-12 text-center space-y-6">
            <div className="w-20 h-20 bg-blue-50 rounded-[2.5rem] flex items-center justify-center">
              <History className="w-10 h-10 text-blue-200" />
            </div>
            <p className="font-black text-sm uppercase tracking-widest text-black">No History Yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-6 hover:bg-gray-50/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    tx.amount > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    {tx.amount > 0 ? <ArrowUp className="w-6 h-6" /> : <ArrowDown className="w-6 h-6" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[13px] text-black tracking-tight">{tx.description}</span>
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">
                      {format(tx.timestamp, "MMM d, HH:mm")}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      "text-lg font-black",
                      tx.amount > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                    <Gem className="w-3 h-3 fill-current" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )