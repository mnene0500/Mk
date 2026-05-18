"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore"
import { ref, update, increment as rtdbIncrement, push } from "firebase/database"
import { useFirestore, useUser, useDoc, useDatabase } from "@/firebase"
import { Button } from "@/components/ui/button"
import { ChevronLeft, X, Coins, Trophy, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"

interface UserProfile {
  coins?: number
  checkInStreak?: number
  lastCheckInDate?: any
}

export default function TaskCenterPage() {
  const router = useRouter()
  const db = useFirestore()
  const rtdb = useDatabase()
  const { user } = useUser()
  const { toast } = useToast()
  
  const userRef = useMemo(() => user?.uid ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc<UserProfile>(userRef)

  const days = [
    { day: "1st", reward: 2 },
    { day: "2nd", reward: 2 },
    { day: "3rd", reward: 5 },
    { day: "4th", reward: 2 },
    { day: "5th", reward: 2 },
    { day: "6th", reward: 2 },
    { day: "7th", reward: 10 },
  ]

  const hasCheckedInToday = useMemo(() => {
    if (!profile?.lastCheckInDate) return false
    
    const rawDate = profile.lastCheckInDate;
    let lastDate: Date;
    
    if (rawDate && typeof rawDate.toDate === 'function') {
      lastDate = rawDate.toDate();
    } else if (rawDate && typeof rawDate === 'object' && 'seconds' in rawDate) {
      lastDate = new Date(rawDate.seconds * 1000);
    } else {
      lastDate = new Date(rawDate);
    }

    const today = new Date()
    return (
      lastDate.getDate() === today.getDate() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getFullYear() === today.getFullYear()
    )
  }, [profile?.lastCheckInDate])

  const currentStreak = profile?.checkInStreak || 0

  const handleCheckIn = async () => {
    if (!user || !userRef || hasCheckedInToday) return
    const streakIndex = currentStreak % 7
    const rewardAmount = days[streakIndex].reward
    const timestamp = Date.now()
    
    // 1. Update Firestore (for metadata like streak and date)
    updateDoc(userRef, {
      lastCheckInDate: serverTimestamp(),
      checkInStreak: increment(1)
    }).catch(async () => {
      const permissionError = new FirestorePermissionError({ 
        path: userRef.path, 
        operation: 'update',
        requestResourceData: {
          lastCheckInDate: 'serverTimestamp()',
          checkInStreak: 'increment(1)'
        }
      });
      errorEmitter.emit('permission-error', permissionError);
    })

    // 2. Update RTDB (The real source of truth for the real-time balance)
    update(ref(rtdb, `balances/${user.uid}`), {
      coins: rtdbIncrement(rewardAmount),
      updatedAt: timestamp
    })

    // 3. Log to Coin History
    push(ref(rtdb, `coin_history/${user.uid}`), {
      amount: rewardAmount,
      type: 'task',
      description: 'Daily Check-in Reward',
      timestamp: timestamp
    })

    toast({ 
      title: "Check-in Successful!", 
      description: `You earned ${rewardAmount} coins. Keep it up!` 
    })
  }

  return (
    <div className="flex-1 bg-[#F8F9FA] min-h-screen pb-10 select-none">
      <header className="bg-[#00A2FF] h-32 relative px-4 pt-12">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white rounded-full hover:bg-white/20">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-white tracking-tight uppercase">Task Center</h1>
          <Button variant="ghost" size="icon" onClick={() => router.push('/home')} className="text-white rounded-full hover:bg-white/20">
            <X className="w-6 h-6" />
          </Button>
        </div>
      </header>

      <main className="mt-8 px-4 space-y-6">
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xs font-bold text-black uppercase tracking-widest">Daily Check-in</h2>
            </div>
            <span className="text-[10px] font-semibold text-gray-400">Total: {currentStreak} Days</span>
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            {days.map((d, i) => {
              const isChecked = i < (currentStreak % 7) || (currentStreak > 0 && currentStreak % 7 === 0 && i < 7)
              const isToday = hasCheckedInToday && (i === (currentStreak - 1) % 7)
              return (
                <div 
                  key={i} 
                  className={cn(
                    "aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all", 
                    (isChecked || isToday) ? "bg-green-50 border-green-200" : "bg-gray-50 border-transparent"
                  )}
                >
                  {(isChecked || isToday) ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <>
                      <Coins className="w-5 h-5 text-yellow-500 mb-1" />
                      <span className="text-[10px] font-semibold text-gray-500">+{d.reward}</span>
                    </>
                  )}
                  <span className="text-[8px] font-medium text-gray-400 uppercase mt-1">{d.day}</span>
                </div>
              )
            })}
          </div>
          
          <Button 
            onClick={handleCheckIn} 
            disabled={hasCheckedInToday}
            className={cn(
              "w-full mt-6 h-14 rounded-full text-white font-bold uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all", 
              hasCheckedInToday ? "bg-gray-300 shadow-none cursor-default" : "bg-[#00A2FF] shadow-blue-100"
            )}
          >
            {hasCheckedInToday ? "Already Checked-in" : "Check-in Now"}
          </Button>
        </section>

        <div className="text-center py-10 px-6 opacity-30">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            More tasks coming soon! Check in daily to grow your streak.
          </p>
        </div>
      </main>
    </div>
  )
}