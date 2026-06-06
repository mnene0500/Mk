
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { RotateCw, BadgeCheck, FileText, Target, Loader2, Sparkles } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"

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
  const [activeTab, setActiveTab] = useState<'recommend' | 'nearby'>('recommend')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  
  // Track if we are doing a manual refresh to reshuffle
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchUsers = useCallback(async (pageNum = 0, isManualRefresh = false) => {
    if (!currentUser?.id) return;
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    // 1. Efficient single-row fetch for self
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

    // 2. Select ONLY necessary columns
    let query = supabase.from('users')
      .select('uid, name, photo_url, country, dob, is_verified, updated_at')
      .eq('onboarding_complete', true)
      .eq('gender', oppositeGender)
      .is('is_deleted', false)
      .neq('uid', currentUser.id);

    if (blockedList.length > 0) {
       query = query.not('uid', 'in', `(${blockedList.join(',')})`);
    }

    if (activeTab === 'nearby') query = query.eq('country', myProfile.country);
    
    // Sort by updated_at to ensure online/recent users are at the top
    const { data } = await query
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (data) {
      if (pageNum === 0) {
        setUsers(data as any);
      } else {
        setUsers(prev => {
          // Filter duplicates just in case
          const existingIds = new Set(prev.map(u => u.uid));
          const filteredNew = (data as any).filter((u: any) => !existingIds.has(u.uid));
          return [...prev, ...filteredNew];
        });
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [currentUser?.id, activeTab]);

  // Initial load only occurs once or when activeTab changes
  useEffect(() => {
    if (isInitialized) {
      // Don't auto-fetch if we already have users for this tab (manual cache behavior)
      // unless it's the very first load
      if (users.length === 0 || page === 0) {
        fetchUsers(0);
      }
    }
  }, [isInitialized, activeTab]);

  // SCROLL RESTORATION & INFINITE LOAD
  useEffect(() => {
    const handleScroll = () => {
      const threshold = 600;
      const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - threshold;
      
      if (isAtBottom && !loadingMore && hasMore && !loading && users.length > 0) {
        setPage(p => {
          const next = p + 1;
          fetchUsers(next);
          return next;
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore, fetchUsers, users.length]);

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
      {/* SCROLLABLE TOP BUTTONS */}
      <div className="bg-[#00A2FF] pt-2 pb-4">
        <div className="px-4 grid grid-cols-2 gap-3 py-4">
          <button onClick={() => router.push('/mystery-note')} className="h-28 bg-white/10 backdrop-blur-md rounded-[2rem] p-5 flex flex-col items-start justify-center text-white border border-white/20 active:scale-95 transition-all relative overflow-hidden group shadow-lg">
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <FileText className="w-5 h-5 mb-2 relative z-10" />
            <p className="text-[12px] font-black uppercase tracking-widest leading-tight relative z-10">Message<br/>Blast</p>
          </button>
          <button onClick={() => router.push('/tasks')} className="h-28 bg-white/10 backdrop-blur-md rounded-[2rem] p-5 flex flex-col items-start justify-center text-white border border-white/20 active:scale-95 transition-all relative overflow-hidden group shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
            <Target className="w-5 h-5 mb-2 relative z-10" />
            <p className="text-[12px] font-black uppercase tracking-widest leading-tight relative z-10">Task<br/>Center</p>
          </button>
        </div>
      </div>

      {/* STICKY TAB BAR */}
      <div className="sticky top-0 z-[60] bg-[#00A2FF] shadow-lg border-none">
        <div className="px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {['recommend', 'nearby'].map((t) => (
              <button 
                key={t} 
                onClick={() => { setPage(0); setUsers([]); setActiveTab(t as any); }} 
                className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em] transition-all relative py-2", 
                  activeTab === t ? "text-white" : "text-white/40"
                )}
              >
                {t}
                {activeTab === t && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full animate-in fade-in" />
                )}
              </button>
            ))}
          </div>
          <button 
            onClick={handleManualRefresh} 
            disabled={loading}
            className="w-9 h-9 flex items-center justify-center text-white/80 active:bg-white/10 rounded-full transition-all"
          >
            <RotateCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <main className="px-4 pt-6 pb-24">
        {loading && users.length === 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-[1/1.3] bg-gray-50 rounded-[2rem] animate-pulse" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="py-40 text-center opacity-40 uppercase font-black text-xs tracking-[0.3em]">No profiles found</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {users.map((u) => {
              // Online threshold: 5 minutes
              const isOnline = new Date(u.updated_at).getTime() > Date.now() - 5 * 60 * 1000;
              return (
                <Card key={u.uid} className="relative overflow-hidden border-none aspect-[1/1.3] rounded-[2rem] shadow-xl active:scale-[0.98] transition-all" onClick={() => router.push(`/users/${u.uid}`)}>
                  <Image src={u.photo_url} alt={u.name} fill className="object-cover" sizes="50vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); router.push(`/chats?startWith=${u.uid}`); }}
                    className="absolute top-4 right-4 bg-[#00A2FF] text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg border border-white/20 active:scale-90 transition-transform z-20"
                  >
                    CHAT
                  </button>

                  {isOnline && (
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
                       <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                       <span className="text-[7px] font-black text-white uppercase tracking-widest">Active</span>
                    </div>
                  )}
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
                </Card>
              )
            })}
          </div>
        )}
        {(loadingMore || (loading && users.length > 0)) && (
          <div className="py-10 flex justify-center w-full">
            <Loader2 className="w-6 h-6 animate-spin text-[#00A2FF]" />
          </div>
        )}
      </main>
    </div>
  )
}
