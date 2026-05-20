
"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { collection, query, where, limit, doc, getDocs } from "firebase/firestore"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { BottomNav } from "@/components/layout/BottomNav"
import { Target, RotateCw, FileText, ChevronDown, BadgeCheck, Loader2, Sparkles } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface UserProfile {
  id: string
  uid: string
  name: string
  photoURL: string
  country: string
  gender: string
  dob: string
  onboardingComplete: boolean
  updatedAt?: any
  isVerified?: boolean
  blocking?: string[]
  blockedBy?: string[]
}

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
  const db = useFirestore()
  
  const [isMounted, setIsMounted] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [displayLimit, setDisplayLimit] = useState(12)
  const [activeTab, setActiveTab] = useState<'Recommend' | 'Nearby'>('Recommend')

  const currentUserProfileRef = useMemoFirebase(() => 
    currentUser?.uid && db ? doc(db, "users", currentUser.uid) : null, 
  [db, currentUser?.uid])
  
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(currentUserProfileRef)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const fetchUsers = useCallback(async (isManual = false) => {
    if (!db || !profile) return
    if (isManual) setIsRefreshing(true)
    
    try {
      const q = query(
        collection(db, "users"), 
        where("onboardingComplete", "==", true),
        limit(24)
      )
      
      const snap = await getDocs(q)
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile))
      const blockedList = [...(profile.blocking || []), ...(profile.blockedBy || [])]
      
      const filtered = fetched.filter(u => {
        if (u.uid === currentUser?.uid) return false
        if (blockedList.includes(u.uid)) return false
        const myGender = profile.gender?.toLowerCase()
        const targetGender = u.gender?.toLowerCase()
        if (myGender === 'male') return targetGender === 'female'
        if (myGender === 'female') return targetGender === 'male'
        return true
      })

      const sorted = filtered.sort(() => Math.random() - 0.5)
      setUsers(sorted)
    } catch (err) {
      console.error("[Home Fetch Error]:", err)
    } finally {
      setIsRefreshing(false)
      setInitialLoading(false)
    }
  }, [db, profile, currentUser?.uid])

  useEffect(() => {
    if (isInitialized && !authLoading && !profileLoading && db) {
      if (!profile || profile.onboardingComplete !== true) {
        router.replace("/onboarding")
        return
      }
      if (users.length === 0) fetchUsers()
    }
  }, [isInitialized, authLoading, profileLoading, profile, db, fetchUsers, users.length, router])

  const handleRefresh = () => {
    fetchUsers(true)
    setDisplayLimit(12)
  }

  const filteredUsers = useMemo(() => {
    if (activeTab === 'Nearby' && profile) {
      return users.filter(u => u.country === profile.country)
    }
    return users
  }, [users, activeTab, profile])

  const paginatedUsers = useMemo(() => filteredUsers.slice(0, displayLimit), [filteredUsers, displayLimit])
  const hasMore = paginatedUsers.length < filteredUsers.length

  if (!isMounted || authLoading || profileLoading || (isInitialized && !profile)) {
    return (
      <div className="flex-1 bg-white min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#00A2FF] w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="flex-1 pb-24 bg-[#F9FAFB] min-h-screen relative select-none">
      <div className="absolute top-0 left-0 right-0 z-0 flex flex-col">
        <div className="h-[72px] bg-[#00A2FF] relative overflow-hidden">
          <div className="absolute -right-4 -top-10 rotate-[-12deg] opacity-30 select-none pointer-events-none">
            <span className="text-8xl font-logo text-white whitespace-nowrap">QIVO</span>
          </div>
        </div>
        <div className="h-[120px] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.03)]" />
      </div>
      
      <div className="relative z-10 pt-0">
        <div className="px-4 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-4">
            <div onClick={() => router.push('/mystery-note')} className="bg-gradient-to-br from-[#00A2FF] to-[#0081CC] p-4 flex flex-col justify-between h-28 rounded-2xl shadow-lg cursor-pointer active:scale-95 transition-transform">
              <div className="bg-white/30 p-2 rounded-2xl w-fit"><FileText className="w-5 h-5 text-white" /></div>
              <div className="space-y-0.5"><h3 className="text-white font-semibold text-sm">Mystery Note</h3><p className="text-white/80 text-[8px] font-bold uppercase tracking-widest">Send a note</p></div>
            </div>
            <div onClick={() => router.push('/tasks')} className="bg-gradient-to-br from-[#A88CFF] to-[#7B61FF] p-4 flex flex-col justify-between h-28 rounded-2xl shadow-lg cursor-pointer active:scale-95 transition-transform">
              <div className="bg-white/30 p-2 rounded-2xl w-fit"><Target className="w-5 h-5 text-white" /></div>
              <div className="space-y-0.5"><h3 className="text-white font-semibold text-sm">Task Center</h3><p className="text-white/80 text-[8px] font-bold uppercase tracking-widest">Earn rewards</p></div>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-40 bg-[#F9FAFB]/90 backdrop-blur-md px-5 pt-3 pb-3 border-b border-black/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button onClick={() => setActiveTab('Recommend')} className={cn("text-sm font-semibold", activeTab === 'Recommend' ? "text-[#00A2FF]" : "text-gray-400")}>Recommend</button>
              <button onClick={() => setActiveTab('Nearby')} className={cn("text-sm font-semibold", activeTab === 'Nearby' ? "text-[#00A2FF]" : "text-gray-400")}>Nearby</button>
            </div>
            <button onClick={handleRefresh} disabled={isRefreshing} className={cn("p-1.5 text-[#00A2FF]", isRefreshing && "animate-spin opacity-50")}><RotateCw className="w-5 h-5" /></button>
          </div>
        </div>

        <main className="px-4 pt-3 relative">
          {initialLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="aspect-[1/1.2] bg-white animate-pulse rounded-2xl border" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {paginatedUsers.map((user) => (
                <Card key={user.uid} className="relative overflow-hidden border-none aspect-[1/1.2] rounded-2xl shadow-xl bg-white" onClick={() => router.push(`/users/${user.uid}`)}>
                  <Image src={user.photoURL} alt={user.name} fill className="object-cover" />
                  <div className="absolute top-2.5 right-2.5 bg-[#00A2FF] px-4 py-1.5 rounded-full z-30 text-white font-bold text-[12px] uppercase" onClick={(e) => { e.stopPropagation(); router.push(`/chats?startWith=${user.uid}`); }}>CHAT</div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <div className="flex items-center gap-1.5"><h4 className="text-white font-bold text-sm truncate">{user.name}</h4>{user.isVerified && <BadgeCheck className="w-4 h-4 text-[#00A2FF] fill-white" />}</div>
                    <div className="flex items-center gap-1.5 mt-1"><span className="bg-[#006400] text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full">{calculateAge(user.dob)}</span><span className="bg-white/10 backdrop-blur-md px-2.5 py-0.5 rounded-full text-white font-medium text-[10px] border border-white/20">{user.country || "KE"}</span></div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {hasMore && <div className="flex justify-center pb-8 pt-4"><Button variant="ghost" className="text-gray-400 text-[9px] uppercase tracking-widest gap-2" onClick={() => setDisplayLimit(prev => prev + 12)}><ChevronDown className="w-3.5 h-3.5" />Show more</Button></div>}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
