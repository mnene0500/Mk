
"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Coins, Trophy, CheckCircle2, Loader2, Target, Zap, Gift, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { dailyCheckInAction, claimVerificationRewardAction } from "@/app/actions/matchflow-actions"

export default function TaskCenterPage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  const days = [
    { day: "Day 1", reward: 2 }, { day: "Day 2", reward: 2 }, { day: "Day 3", reward: 5 }, { day: "Day 4", reward: 2 }, { day: "Day 5", reward: 2 }, { day: "Day 6", reward: 2 }, { day: "Day 7", reward: 10 },
  ]

  useEffect(() => {
    if (!user?.id) return
    supabase.from('users').select('*').eq('uid', user.id).single().then(({ data }) => {
      setProfile(data); setLoading(false);
    })
  }, [user?.id])

  const hasCheckedInToday = useMemo(() => {
    if (!profile?.last_check_in_date) return false
    return new Date(profile.last_check_in_date).toDateString() === new Date().toDateString();
  }, [profile?.last_check_in_date])

  const handleCheckIn = async () => {
    if (!user || hasCheckedInToday || isProcessing) return
    setIsProcessing(true)
    try {
      const res = await dailyCheckInAction(user.id);
      if (res.success) {
        toast({ title: "Daily Bonus Received!" })
        const { data } = await supabase.from('users').select('*').eq('uid', user.id).single();
        setProfile(data);
      }
    } finally { setIsProcessing(false) }
  }

  const handleClaimVerification = async () => {
    if (!user || isProcessing) return
    setIsProcessing(true)
    try {
      const res = await claimVerificationRewardAction(user.id)
      if (res.success) {
        toast({ title: "50 Coins Received!", description: "Identity verification bonus credited." })
        const { data } = await supabase.from('users').select('*').eq('uid', user.id).single();
        setProfile(data);
      } else {
        toast({ variant: "destructive", title: "Claim Failed", description: res.error })
      }
    } finally { setIsProcessing(false) }
  }

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none animate-in fade-in duration-500">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-black"><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Task Center</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-6 space-y-8 overflow-y-auto no-scrollbar pb-32">
        <div className="p-8 bg-[#00A2FF] rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
          <Target className="absolute -right-4 -top-4 w-32 h-32 text-white/10" />
          <div className="relative z-10 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Quest Progress</p>
            <h2 className="text-4xl font-black tracking-tight">{profile?.check_in_streak || 0} <span className="text-xs uppercase opacity-80 tracking-widest font-bold">Day Streak</span></h2>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Daily Attendance</h3>
            {hasCheckedInToday && <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Completed</span>}
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            {days.map((d, i) => {
              const currentCycleDay = (profile?.check_in_streak % 7) || (profile?.check_in_streak > 0 ? 7 : 0);
              const isCollected = hasCheckedInToday ? (i + 1) <= currentCycleDay : (i + 1) <= (profile?.check_in_streak % 7);
              
              return (
                <div key={i} className={cn("aspect-square rounded-3xl flex flex-col items-center justify-center border-2 transition-all", isCollected ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100")}>
                  {isCollected ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <><Coins className="w-5 h-5 text-yellow-500 mb-1" /><span className="text-[10px] font-black text-gray-400">+{d.reward}</span></>}
                  <span className="text-[7px] font-black text-gray-400 mt-1 uppercase">{d.day}</span>
                </div>
              )
            })}
          </div>

          <Button onClick={handleCheckIn} disabled={hasCheckedInToday || isProcessing} className="w-full h-18 py-6 rounded-[2rem] bg-black text-white font-black uppercase tracking-[0.2em] text-sm shadow-xl active:scale-95 transition-all">
            {isProcessing ? <Loader2 className="animate-spin" /> : hasCheckedInToday ? "Collected Today" : "Claim Reward"}
          </Button>
        </section>

        <section className="space-y-4">
          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-2">Mission Center</h3>
          <div className="space-y-3">
            {profile?.is_verified && !profile?.claimed_verification_reward && (
              <TaskItem 
                icon={ShieldCheck} 
                title="Identity Bonus" 
                reward="+50 Coins" 
                desc="Claim your verification reward" 
                onClick={handleClaimVerification} 
                color="text-green-500" 
              />
            )}
            {!profile?.is_verified && (
              <TaskItem icon={ShieldCheck} title="Identity Check" reward="Trust Badge" desc="Verify your face with AI" onClick={() => router.push('/verify-identity')} color="text-[#00A2FF]" />
            )}
            <TaskItem icon={Gift} title="First Recharge" reward="Bonus Coins" desc="Make any purchase" onClick={() => router.push('/recharge')} color="text-pink-500" />
          </div>
        </section>
      </main>
    </div>
  )
}

function TaskItem({ icon: Icon, title, reward, desc, onClick, color }: any) {
  return (
    <div onClick={onClick} className="p-5 bg-gray-50 rounded-[2.5rem] border border-gray-100 flex items-center justify-between active:bg-gray-100 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm"><Icon className={cn("w-6 h-6", color)} /></div>
        <div className="space-y-0.5"><p className="text-sm font-black text-black">{title}</p><p className="text-[10px] font-medium text-gray-400">{desc}</p></div>
      </div>
      <div className="text-right"><p className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">{reward}</p></div>
    </div>
  )
}
