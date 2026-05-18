"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { collection, query, where, limit } from "firebase/firestore"
import { useFirestore, useCollection } from "@/firebase"
import { Button } from "@/components/ui/button"
import { ChevronLeft, MessageSquare, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserProfile {
  uid: string
  name: string
  photoURL: string
  isCoinSeller?: boolean
}

export default function CoinSellersPage() {
  const router = useRouter()
  const db = useFirestore()

  // Fetch users with the isCoinSeller role
  const sellersQuery = useMemo(() => query(
    collection(db, "users"),
    where("isCoinSeller", "==", true),
    limit(20)
  ), [db])

  const { data: sellers, loading } = useCollection<UserProfile>(sellersQuery)

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-sm font-bold text-black uppercase tracking-widest">Certified Sellers</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-6">
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-2 text-blue-600">
            <ShieldCheck className="w-5 h-5" />
            <h2 className="text-lg font-bold">Verified Merchants</h2>
          </div>
          <p className="text-[11px] font-medium text-gray-500 leading-relaxed">
            Contact these certified sellers to recharge your MatchFlow coins via local payment methods like M-Pesa.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : sellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-12 text-center opacity-40">
            <ShieldCheck className="w-16 h-16 mb-4 text-gray-300" />
            <p className="font-bold text-sm uppercase tracking-widest text-gray-400">No active sellers found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sellers.map((seller) => (
              <div 
                key={seller.uid} 
                className="flex items-center justify-between p-5 bg-gray-50 rounded-3xl border border-gray-100/50 hover:bg-gray-100/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                      <AvatarImage src={seller.photoURL} className="object-cover" />
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">
                        {seller.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 fill-current" />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-black">{seller.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available</p>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => router.push(`/chats?startWith=${seller.uid}`)}
                  className="rounded-full bg-blue-600 hover:bg-blue-700 h-12 w-12 shadow-lg shadow-blue-100 flex items-center justify-center"
                >
                  <MessageSquare className="w-5 h-5 text-white fill-current" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="p-10 text-center bg-gray-50/30">
        <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.3em] leading-relaxed">
          MatchFlow Certified Sellers are vetted for your security. Always trade within the platform.
        </p>
      </footer>
    </div>
  )
}
