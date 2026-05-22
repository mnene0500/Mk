
"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { BottomNav } from "@/components/layout/BottomNav"
import { Target, RotateCw, FileText, BadgeCheck, Loader2, Sparkles } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/auth/use-user"

interface UserProfile {
  uid: string
  name: string
  photo_url: string
  country: string
  gender: string
  dob: string
  onboarding_complete: boolean
  is_verified?: boolean
  is_deleted?: boolean
}

/**
 * GLOBAL PERSISTENCE CACHE
 */
let globalUserCache: UserProfile[] = [];
let globalScrollY = 0;

function calculateAge(dob: string) {
  if (!dob) return 22
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

export default function HomePage() {
  const router = useRouter()
  const { user: currentUser, loading: authLoading, isInitialized } = useUser()
  
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [users, setUsers] = useState<UserProfile[]>(globalUserCache)
  const [initialLoading, setInitialLoading] = useState(globalUserCache.length === 0)
  const [activeTab, setActiveTab] = useState<'Recommend' | 'Nearby'>('Recommend')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [statusChecked, setStatusChecked] = useState(false)

  // MANDATORY SECURITY & ONBOARDING GATE
  useEffect(() => {
    if (!isInitialized || authLoading) return;
    
    if (!currentUser) { 
      router.replace("/welcome"); 
      return; 
    }

    const checkProfile = async () => {
      const { data } = await supabase
        .from('users')
        .select('onboarding_complete, country, gender')
        .eq('uid', currentUser.id)
        .maybeSingle();
      
      if (!data || !data.onboarding_complete) { 
        router.replace("/fastonboard"); 
        return; 
      }

      setProfile(data as any);
      setStatusChecked(true);
    };

    checkProfile();
  }, [isInitialized, currentUser, authLoading, router])

  useEffect(() => {
    if (!statusChecked) return;
    if (!initialLoading) {
      setTimeout(() => window.scrollTo({ top: globalScrollY, behavior: 'instant' }), 50);
    }
    const handleScroll = () => { globalScrollY = window.scrollY }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [initialLoading, statusChecked])

  const fetchUsers = useCallback(async (isManual = false) => {
    if (!profile?.gender) return;
    
    if (isManual) {
      setIsRefreshing(true);
      globalScrollY = 0;
    } else if (users.length === 0) {
      setInitialLoading(true);
    }

    try {
      const oppositeGender = profile.gender === 'male' ? 'female' : 'male';
      
      const { data } = await supabase
        .from('users')
        .select('uid, name, photo_url, country, dob, is_verified, onboarding_complete, is_deleted, gender')
        .eq('onboarding_complete', true)
        .eq('gender', oppositeGender)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .limit(60);

      if (data) {
        const filtered = (data as UserProfile[]).filter(u => u.uid !== currentUser?.id)
        const shuffled = filtered.sort(() => Math.random() - 0.5)
        setUsers(shuffled)
        globalUserCache = shuffled
      }
    } catch (err) {
      console.error("Discovery fetch failed:", err);
    } finally {
      setIsRefreshing(false)
      setInitialLoading(false)
    }
  }, [currentUser?.id, profile?.gender, users.length])

  useEffect(() => {
    if (statusChecked && profile && users.length === 0) {
      fetchUsers();
    }
  }, [statusChecked, profile, users.length, fetchUsers])

  const filteredUsers = useMemo(() => {
    if (activeTab === 'Nearby' && profile) return users.filter(u => u.country === profile.country)
    return users
  }, [users, activeTab, profile])

  // Solid background while checking status to prevent Home blink
  if (!statusChecked) {
    return <div className="fixed inset-0 bg-white" />
  }

  if (initialLoading && users.length === 0) {
    return (
      <div className="flex-1 bg-white min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#00A2FF] w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="flex-1 pb-24 bg-[#F9FAFB] min-h-screen relative select-none animate-in fade-in duration-300">
      {/* MINIMAL HEADER - LOGO REMOVED */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b shadow-sm h-16 flex items-center justify-between px-6">
        <div />
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-blue-100" />
        </div>
      </header>

      <div className="px-4 pt-6 space-y-6">
        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-2 gap-4">
          <div onClick={() => router.push('/mystery-note')} className="bg-gradient-to-br from-[#00A2FF] to-[#0081CC] p-4 flex flex-col justify-between h-28 rounded-2xl shadow-lg cursor-pointer active:scale-95 transition-transform">
            <FileText className="w-5 h-5 text-white" />
            <h3 className="text-white font-black text-xs uppercase">Mystery Note</h3>
          </div>
          <div onClick={() => router.push('/tasks')} className="bg-gradient-to-br from-[#A88CFF] to-[#7B61FF] p-4 flex flex-col justify-between h-28 rounded-2xl shadow-lg cursor-pointer active:scale-95 transition-transform">
            <Target className="w-5 h-5 text-white" />
            <h3 className="text-white font-black text-xs uppercase">Task Center</h3>
          </div>
        </div>

        {/* FEED SELECTOR WITH REFRESH NEXT TO NEARBY */}
        <div className="flex items-center gap-6 pb-2 border-b border-black/5 relative">
          <button 
            onClick={() => setActiveTab('Recommend')} 
            className={cn(
              "text-xs font-black uppercase tracking-[0.2em] transition-colors", 
              activeTab === 'Recommend' ? "text-[#00A2FF]" : "text-gray-300"
            )}
          >
            Recommend
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('Nearby')} 
              className={cn(
                "text-xs font-black uppercase tracking-[0.2em] transition-colors", 
                activeTab === 'Nearby' ? "text-[#00A2FF]" : "text-gray-300"
              )}
            >
              Nearby
            </button>
            <button 
              onClick={() => fetchUsers(true)} 
              disabled={isRefreshing}
              className={cn(
                "p-1 text-[#00A2FF] transition-transform active:scale-90", 
                isRefreshing && "animate-spin"
              )}
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MAIN FEED */}
        <main>
          {filteredUsers.length === 0 ? (
            <div className="py-20 text-center opacity-40">
               <RotateCw className="w-10 h-10 mx-auto text-gray-300 mb-4" />
               <p className="text-[10px] font-black uppercase tracking-widest">Finding matches...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredUsers.map((u) => (
                <Card 
                  key={u.uid} 
                  className="relative overflow-hidden border-none aspect-[1/1.25] rounded-[2rem] shadow-xl bg-white group active:scale-95 transition-all"
                  onClick={() => router.push(`/users/${u.uid}`)}
                >
                  <Image 
                    src={u.photo_url || `https://picsum.photos/seed/${u.uid}/400/500`} 
                    alt={u.name} 
                    fill 
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
                  
                  {/* BRANDED CHAT BUTTON */}
                  <div 
                    onClick={(e) => { e.stopPropagation(); router.push(`/chats?startWith=${u.uid}`); }}
                    className="absolute top-3 right-3 px-5 h-9 bg-[#00A2FF] rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all z-20 hover:bg-[#0081CC] border border-white/20"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">Chat</span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-sm truncate">{u.name}</h4>
                      {u.is_verified && <BadgeCheck className="w-4 h-4 text-[#00A2FF] fill-white" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="bg-[#006400] text-white font-black text-[9px] px-2 py-0.5 rounded-lg">{calculateAge(u.dob)}</span>
                      <span className="text-white/60 text-[9px] font-bold uppercase tracking-tighter truncate">{u.country}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
