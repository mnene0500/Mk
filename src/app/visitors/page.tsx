"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Users, Loader2, Zap, Coins, Heart, Star, Clock } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface Visitor {
  visitor_id: string
  count: number
  last_visit_at: string
  profile?: any
}

export default function VisitorsPage() {
  const router = useRouter()
  const { user } = useUser()
  
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    
    const fetchData = async () => {
      const { data: p } = await supabase.from('users').select('*').eq('uid', user.id).single()
      setProfile(p)

      const { data: vists } = await supabase
        .from('profile_visits')
        .select('*')
        .eq('visited_id', user.id)
        .order('last_visit_at', { ascending: false })
        .limit(30)
      
      if (vists) {
        const enriched = await Promise.all(vists.map(async (v) => {
          const { data: prof } = await supabase.from('users').select('name, photo_url').eq('uid', v.visitor_id).single()
          return { ...v, profile: prof }
        }))
        setVisitors(enriched)
      }
      setLoading(false)
    }

    fetchData()
  }, [user?.id])

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-[#00A2FF] w-8 h-8" /></div>

  const isPremium = profile?.has_visitor_tracking

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none animate-in fade-in duration-300">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-black">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">My Visitors</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {!isPremium ? (
          <div className="p-8 flex flex-col items-center justify-center space-y-10 py-20 text-center">
            <div className="w-24 h-24 bg-purple-50 rounded-[2.5rem] flex items-center justify-center text-purple-600 shadow-xl border border-purple-100">
              <Zap className="w-12 h-12 fill-current" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-black tracking-tight uppercase">Who's Watching?</h2>
              <p className="text-sm font-medium text-gray-400 px-6 leading-relaxed">
                Unlock the visitor tracker to see exactly who visited your profile and how many times.
              </p>
            </div>
            
            <div className="w-full space-y-4">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl opacity-40 blur-sm pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-gray-200" />
                    <div className="flex-1 text-left space-y-1">
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                      <div className="h-2 w-16 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                onClick={() => router.push('/settings')}
                className="w-full h-16 rounded-full bg-purple-600 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-purple-100 active:scale-95 transition-all"
              >
                Unlock Now for 400 Coins
              </Button>
            </div>
          </div>
        ) : visitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center opacity-40">
            <Users className="w-16 h-16 mb-4 text-gray-300" />
            <p className="font-black text-xs uppercase tracking-widest">No visitors yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            <div className="bg-purple-50/50 p-4 text-center border-b">
              <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Tracking Live Viewers</p>
            </div>
            {visitors.map((v) => (
              <div key={v.visitor_id} className="flex items-center justify-between p-6 hover:bg-gray-50/50 transition-colors" onClick={() => router.push(`/users/${v.visitor_id}`)}>
                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14 border-2 border-white shadow-sm">
                    <AvatarImage src={v.profile?.photo_url} className="object-cover" />
                    <AvatarFallback>{v.profile?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-black text-sm text-black">{v.profile?.name || "Unknown"}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3" /> {format(new Date(v.last_visit_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full border border-purple-100 flex items-center gap-1.5">
                    <span className="text-[10px] font-black">{v.count}</span>
                    <span className="text-[9px] font-black uppercase tracking-tighter">Visits</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
