
"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { RotateCw, BadgeCheck, FileText, Target, Loader2, Sparkles, MessageSquare } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"

interface UserProfile {
  uid: string; name: string; photo_url: string; country: string; dob: string; is_verified?: boolean; updated_at: string;
}

let cachedUsers: UserProfile[] = [];

export default function HomePage() {
  const router = useRouter()
  const { user: currentUser, isInitialized } = useUser()
  const [activeTab, setActiveTab] = useState<'recommend' | 'nearby'>('recommend')
  const [loading, setLoading] = useState(cachedUsers.length === 0)
  const [users, setUsers] = useState<UserProfile[]>(cachedUsers)
  const [profile, setProfile] = useState<any>(null)

  const fetchUsers = useCallback(async (reshuffle = false) => {
    if (!currentUser?.id) return;
    if (users.length === 0) setLoading(true);

    const { data: myProfile } = await supabase.from('users').select('*').eq('uid', currentUser.id).single();
    if (!myProfile) return;
    setProfile(myProfile);

    const oppositeGender = myProfile.gender === 'male' ? 'female' : 'male';
    let query = supabase.from('users')
      .select('*')
      .eq('onboarding_complete', true)
      .eq('gender', oppositeGender)
      .is('is_deleted', false)
      .neq('uid', currentUser.id);

    if (activeTab === 'nearby') query = query.eq('country', myProfile.country);
    
    // Prioritize active users
    const { data } = await query.order('updated_at', { ascending: false }).limit(40);

    if (data) {
      let final = data as any[];
      if (reshuffle && final.length > 5) {
        // Cyclic shuffle requested: first moves to middle
        const top = final[0];
        const rest = final.slice(1);
        const mid = Math.floor(rest.length / 2);
        final = [...rest.slice(0, mid), top, ...rest.slice(mid)];
      }
      setUsers(final);
      cachedUsers = final;
    }
    setLoading(false);
  }, [currentUser?.id, activeTab, users.length]);

  useEffect(() => {
    if (isInitialized) fetchUsers();
  }, [isInitialized, activeTab, fetchUsers]);

  const calculateAge = (dob: string) => {
    if (!dob) return 21;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <div className="flex flex-col w-full bg-white select-none">
      {/* BLUE HEADER SECTION */}
      <div className="bg-[#00A2FF] pt-10 pb-4 shadow-xl">
        <div className="px-4 grid grid-cols-2 gap-3 py-6">
          <button onClick={() => router.push('/mystery-note')} className="h-28 bg-white/10 backdrop-blur-md rounded-[2rem] p-6 flex flex-col items-start justify-center text-white border border-white/20 active:scale-95 transition-all">
            <FileText className="w-6 h-6 mb-1" /><p className="text-sm font-black uppercase tracking-widest leading-tight">Message<br/>Blast</p>
          </button>
          <button onClick={() => router.push('/tasks')} className="h-28 bg-white/10 backdrop-blur-md rounded-[2rem] p-6 flex flex-col items-start justify-center text-white border border-white/20 active:scale-95 transition-all">
            <Target className="w-6 h-6 mb-1" /><p className="text-sm font-black uppercase tracking-widest leading-tight">Task<br/>Center</p>
          </button>
        </div>

        <div className="px-5 py-3 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            {['recommend', 'nearby'].map((t) => (
              <button 
                key={t} 
                onClick={() => setActiveTab(t as any)} 
                className={cn(
                  "text-xs font-black uppercase tracking-widest transition-all", 
                  activeTab === t ? "text-white scale-110" : "text-white/40"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <button onClick={() => fetchUsers(true)} className="p-2 text-white/60 active:rotate-180 transition-transform duration-500">
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <main className="px-4 pt-6 pb-24">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="aspect-[1/1.3] bg-gray-50 rounded-[2rem] animate-pulse" />)}</div>
        ) : users.length === 0 ? (
          <div className="py-40 text-center opacity-40 uppercase font-black text-xs">No profiles found</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {users.map((u) => (
              <Card key={u.uid} className="relative overflow-hidden border-none aspect-[1/1.3] rounded-[2rem] shadow-xl active:scale-[0.98] transition-all" onClick={() => router.push(`/users/${u.uid}`)}>
                <Image src={u.photo_url} alt={u.name} fill className="object-cover" sizes="50vw" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="flex items-center gap-1 mb-1">
                    <h4 className="font-black text-sm truncate">{u.name}</h4>
                    {u.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-[#00A2FF] fill-white" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#006400] text-[9px] font-black px-1.5 py-0.5 rounded-md">{calculateAge(u.dob)}</span>
                    <span className="text-[9px] font-bold opacity-60 uppercase truncate">{u.country}</span>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); router.push(`/chats?startWith=${u.uid}`); }} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                  <MessageSquare className="w-4 h-4 fill-current" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
