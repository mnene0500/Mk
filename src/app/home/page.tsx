"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { RotateCw, BadgeCheck, FileText, Target, Loader2 } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/auth/use-user"

interface UserProfile {
  uid: string; 
  name: string; 
  photo_url: string; 
  country: string; 
  dob: string; 
  is_verified?: boolean; 
  updated_at: string;
}

const PAGE_SIZE = 12;

export default function HomePage() {
  const router = useRouter()
  const { user: currentUser, isInitialized } = useUser()
  const [activeTab, setActiveTab] = useState<'Recommend' | 'Nearby'>('Recommend')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const fetchUsers = useCallback(async (pageNum = 0, isManualRefresh = false) => {
    if (!currentUser?.id) return;
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    const { data: myProfile } = await supabase
      .from('users')
      .select('uid, gender, country, blocking, blocked_by')
      .eq('uid', currentUser.id)
      .single();

    if (!myProfile) return;
    setProfile(myProfile);

    const oppositeGender = myProfile.gender === 'male' ? 'female' : 'male';
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const blockedList = [...(myProfile.blocking || []), ...(myProfile.blocked_by || [])];

    let query = supabase.from('users')
      .select('uid, name, photo_url, country, dob, is_verified, updated_at')
      .eq('onboarding_complete', true)
      .eq('gender', oppositeGender)
      .is('is_deleted', false)
      .neq('uid', currentUser.id);

    if (blockedList.length > 0) {
       query = query.not('uid', 'in', `(${[...blockedList].join(',')})`);
    }

    if (activeTab === 'Nearby') query = query.eq('country', myProfile.country);
    
    const { data } = await query
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (data) {
      let finalData = data as any;
      
      if (isManualRefresh) {
        finalData = shuffleArray(finalData);
      }

      if (pageNum === 0) {
        setUsers(finalData);
      } else {
        setUsers(prev => {
          const existingIds = new Set(prev.map(u => u.uid));
          const filteredNew = finalData.filter((u: any) => u && !existingIds.has(u.uid));
          return [...prev, ...filteredNew];
        });
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [currentUser?.id, activeTab]);

  useEffect(() => {
    if (isInitialized) {
      fetchUsers(0);
    }
  }, [isInitialized, activeTab, fetchUsers]);

  const handleManualRefresh = () => {
    setPage(0);
    setUsers([]);
    fetchUsers(0, true);
  };

  const calculateAge = (dob: string) => {
    if (!dob) return 21;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <div className="flex flex-col w-full bg-white select-none min-h-screen">
      {/* SCROLLABLE TOP PART (Pale Blue) */}
      <div className="bg-blue-50/50 pt-8 pb-6 px-4">
        <div className="grid grid-cols-2 gap-3 relative">
          {/* QIVO STAMP (Subtle) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[100px] font-black text-blue-200/10 pointer-events-none select-none italic tracking-tighter z-0">
            QIVO
          </div>

          <button 
            onClick={() => router.push('/mystery-note')} 
            className="relative z-10 h-32 bg-gradient-to-br from-blue-600 to-blue-500 rounded-[1.5rem] p-5 flex flex-col items-start justify-between text-white active:scale-95 transition-all shadow-xl shadow-blue-200/40"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <p className="text-[13px] font-black leading-tight text-left uppercase tracking-widest">Message<br/>blast</p>
          </button>

          <button 
            onClick={() => router.push('/tasks')} 
            className="relative z-10 h-32 bg-gradient-to-br from-purple-600 to-fuchsia-500 rounded-[1.5rem] p-5 flex flex-col items-start justify-between text-white active:scale-95 transition-all shadow-xl shadow-purple-200/40"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <p className="text-[13px] font-black leading-tight text-left uppercase tracking-widest">Task<br/>center</p>
          </button>
        </div>
      </div>

      {/* STICKY TAB BAR (Pale Blue) */}
      <div className="sticky top-0 z-[60] bg-blue-50/50 backdrop-blur-md border-b border-black/5">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {['Recommend', 'Nearby'].map((t) => (
              <button 
                key={t} 
                onClick={() => { setPage(page => 0); setUsers([]); setActiveTab(t as any); }} 
                className={cn(
                  "text-[11px] font-black transition-all relative py-2 uppercase tracking-[0.15em]", 
                  activeTab === t ? "text-[#00A2FF]" : "text-gray-400"
                )}
              >
                {t}
                {activeTab === t && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#00A2FF] rounded-full" />
                )}
              </button>
            ))}
          </div>
          <button 
            onClick={handleManualRefresh} 
            disabled={loading}
            className="w-10 h-10 flex items-center justify-center text-gray-300 active:bg-blue-100 rounded-full transition-all"
          >
            <RotateCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* USER GRID */}
      <main className="px-3 pt-6 pb-24 bg-white">
        {loading && users.length === 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="aspect-[4/5] bg-gray-50 rounded-[1.2rem] animate-pulse" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="py-40 text-center opacity-40 uppercase font-black text-[10px] tracking-widest">No profiles found</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {users.map((u) => {
              if (!u) return null;
              return (
                <Card key={u.uid} className="relative overflow-hidden border-none aspect-[4/5] rounded-[1.2rem] shadow-md active:scale-[0.98] transition-all" onClick={() => router.push(`/users/${u.uid}`)}>
                  <Image src={u.photo_url} alt={u.name} fill className="object-cover" sizes="50vw" priority />
                  
                  {/* OVERLAY GRADIENT */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  {/* CHAT BADGE */}
                  <div className="absolute top-3 right-3 z-10">
                    <div className="bg-[#00A2FF] text-white text-[12px] font-black uppercase px-3 py-1.5 rounded-full shadow-lg border border-white/20 tracking-widest">
                      CHAT
                    </div>
                  </div>

                  {/* USER INFO */}
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                      <h4 className="font-black text-[15px] truncate leading-none tracking-tight">{u.name}</h4>
                      {u.is_verified && <BadgeCheck className="w-4 h-4 text-[#00A2FF] fill-white shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-[#00D1FF] text-white px-1.5 py-0.5 rounded-md flex items-center justify-center min-w-[20px]">
                        <span className="text-[10px] font-black">{calculateAge(u.dob)}</span>
                      </div>
                      <span className="text-[10px] font-black opacity-80 uppercase truncate tracking-widest">{u.country}</span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
        {(loadingMore || (loading && users.length > 0)) && (
          <div className="py-10 flex justify-center w-full">
            <Loader2 className="w-5 h-5 animate-spin text-[#00A2FF]" />
          </div>
        )}
      </main>
    </div>
  )
}
