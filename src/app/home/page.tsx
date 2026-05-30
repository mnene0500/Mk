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
  uid: string
  name: string
  photo_url: string
  country: string
  gender: string
  dob: string
  is_verified?: boolean
  updated_at: string
}

const PAGE_SIZE = 12;

function calculateAge(dob: string) {
  if (!dob) return 18
  const birthDate = new Date(dob); const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export default function HomePage() {
  const router = useRouter()
  const { user: currentUser, loading: authLoading, isInitialized } = useUser()
  
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const observerTarget = useRef<HTMLDivElement>(null)

  const fetchUsers = useCallback(async (pageNum = 0, isManual = false) => {
    if (!profile) return;
    if (pageNum === 0) setIsRefreshing(true);

    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const oppositeGender = profile.gender === 'male' ? 'female' : 'male';

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('onboarding_complete', true)
        .eq('gender', oppositeGender)
        .is('is_deleted', false)
        .neq('uid', currentUser?.id)
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (data) {
        setUsers(prev => pageNum === 0 ? data : [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
        setPage(pageNum);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUser?.id, profile]);

  useEffect(() => {
    if (isInitialized && currentUser && !profile) {
      supabase.from('users').select('*').eq('uid', currentUser.id).single().then(({ data }) => {
        if (data?.onboarding_complete) setProfile(data);
        else router.replace("/fastonboard");
      });
    }
  }, [isInitialized, currentUser, router, profile]);

  useEffect(() => {
    if (profile && users.length === 0) fetchUsers(0);
  }, [profile, fetchUsers, users.length]);

  return (
    <div className="flex flex-col w-full bg-white select-none">
      <div className="px-4 grid grid-cols-2 gap-3 py-6 bg-[#00A2FF] shrink-0">
        <button onClick={() => router.push('/mystery-note')} className="h-28 bg-white/10 border border-white/20 rounded-2xl p-6 flex flex-col items-start justify-center gap-1 text-white"><FileText className="w-6 h-6" /><p className="text-sm font-black">Message Blast</p></button>
        <button onClick={() => router.push('/tasks')} className="h-28 bg-white/10 border border-white/20 rounded-2xl p-6 flex flex-col items-start justify-center gap-1 text-white"><Target className="w-6 h-6" /><p className="text-sm font-black">Task Center</p></button>
      </div>

      <div className="sticky top-0 z-40 bg-[#00A2FF] px-4 py-2 flex items-center justify-between border-b border-white/10 h-12">
        <span className="text-white font-black text-sm uppercase tracking-widest">Recommended</span>
        <button onClick={() => fetchUsers(0, true)} className={cn("p-2 text-white", isRefreshing && "animate-spin")}><RotateCw className="w-4 h-4" /></button>
      </div>

      <main className="px-4 pt-4 pb-20">
        <div className="grid grid-cols-2 gap-3">
          {users.map((u) => (
            <Card key={u.uid} className="relative overflow-hidden border-none aspect-[1/1.25] rounded-lg shadow-lg" onClick={() => router.push(`/users/${u.uid}`)}>
              <Image src={u.photo_url} alt={u.name} fill className="object-cover" sizes="50vw" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-white">
                <div className="flex items-center gap-1 mb-0.5"><h4 className="font-black text-xs truncate">{u.name}</h4>{u.is_verified && <BadgeCheck className="w-3 h-3 text-[#00A2FF]" />}</div>
                <div className="flex items-center gap-2"><span className="bg-green-600 text-[8px] font-black px-1.5 py-0.5 rounded">{calculateAge(u.dob)}</span><span className="text-[8px] font-bold opacity-70 uppercase truncate">{u.country}</span></div>
              </div>
            </Card>
          ))}
        </div>
        {hasMore && !isRefreshing && <div ref={observerTarget} className="h-20 flex items-center justify-center"><Loader2 className="animate-spin text-[#00A2FF]" /></div>}
      </main>
    </div>
  )
}
