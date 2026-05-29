
"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Check, X, Loader2, User, Users, Briefcase, Banknote, MessageSquare, Copy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { reviewRecruitmentAction, updateWithdrawalStatusAction } from "@/app/actions/matchflow-actions"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface UserProfile {
  uid: string
  name: string
  photo_url: string
  agency_id?: string
  agency_status?: string
  is_agent?: boolean
}

interface WithdrawalRequest {
  id: string
  user_id: string
  diamonds: number
  amount_kes: number
  mpesa_number: string
  status: string
  timestamp: number
}

const PAGE_SIZE = 15;

export default function AgencyManagePage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  
  const [activeTab, setActiveTab] = useState<'members' | 'withdrawals' | 'recruitment'>('members')
  const [isProcessing, setIsProcessing] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [applicants, setApplicants] = useState<UserProfile[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  
  const [memberPage, setMemberPage] = useState(0)
  const [hasMoreMembers, setHasMoreMembers] = useState(true)
  const [payoutPage, setPayoutPage] = useState(0)
  const [hasMorePayouts, setHasMorePayouts] = useState(true)
  
  const observerTarget = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (isRefresh = true) => {
    if (!user?.id) return
    if (isRefresh) setLoading(true)

    const { data: p } = await supabase.from('users').select('*').eq('uid', user.id).single()
    if (p) {
      setProfile(p)
      const aid = p.agency_id
      if (aid) {
        if (activeTab === 'recruitment') {
          const { data } = await supabase.from('users').select('*').eq('agency_id', aid).eq('agency_status', 'pending')
          setApplicants(data || [])
        } else if (activeTab === 'members') {
          const from = memberPage * PAGE_SIZE
          const to = from + PAGE_SIZE - 1
          const { data } = await supabase.from('users').select('*').eq('agency_id', aid).eq('agency_status', 'approved').range(from, to)
          if (data) {
            setMembers(prev => isRefresh ? data : [...prev, ...data])
            setHasMoreMembers(data.length === PAGE_SIZE)
          }
        } else if (activeTab === 'withdrawals') {
          const from = payoutPage * PAGE_SIZE
          const to = from + PAGE_SIZE - 1
          const { data } = await supabase.from('withdrawals').select('*').eq('agency_id', aid).eq('status', 'pending').order('timestamp', { ascending: false }).range(from, to)
          if (data) {
            setWithdrawals(prev => isRefresh ? (data as any) : [...prev, ...(data as any)])
            setHasMorePayouts(data.length === PAGE_SIZE)
          }
        }
      }
    }
    setLoading(false)
  }, [user?.id, activeTab, memberPage, payoutPage])

  useEffect(() => {
    fetchData(true)
  }, [activeTab])

  useEffect(() => {
    if (!hasMoreMembers && activeTab === 'members') return
    if (!hasMorePayouts && activeTab === 'withdrawals') return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading) {
        if (activeTab === 'members') setMemberPage(p => p + 1)
        if (activeTab === 'withdrawals') setPayoutPage(p => p + 1)
      }
    }, { threshold: 0.1 })

    if (observerTarget.current) observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [activeTab, hasMoreMembers, hasMorePayouts, loading])

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: `${label} Copied` })
  }

  const handleReview = async (applicantUid: string, status: 'approved' | 'rejected') => {
    if (!user) return
    setIsProcessing(true)
    try {
      const res = await reviewRecruitmentAction(applicantUid, status)
      if (res.success) {
        toast({ title: status === 'approved' ? "Member Approved" : "Applicant Rejected" })
        fetchData(true) 
      } else {
        toast({ variant: "destructive", title: "Error", description: res.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "System Error" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleWithdrawalReview = async (requestId: string, status: 'paid' | 'rejected') => {
    if (!user || !profile?.agency_id) return
    setIsProcessing(true)
    try {
      const res = await updateWithdrawalStatusAction(requestId, status)
      if (res.success) {
        toast({ title: `Payout marked as ${status}` })
        fetchData(true)
      } else {
        toast({ variant: "destructive", title: "Error", description: res.error })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "System Error" })
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading && memberPage === 0 && payoutPage === 0) return <div className="flex-1 flex items-center justify-center bg-white min-h-screen"><Loader2 className="animate-spin text-[#00A2FF]" /></div>

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ChevronLeft className="w-6 h-6 text-black" /></Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Agency Center</h1>
        <div className="w-10" />
      </header>

      <div className="flex border-b sticky top-16 bg-white z-40">
        {[{ id: 'members', label: 'Members', icon: Users }, { id: 'withdrawals', label: 'Payouts', icon: Banknote }, { id: 'recruitment', label: 'Requests', icon: Briefcase }].map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setMemberPage(0); setPayoutPage(0); }} className={cn("flex-1 py-4 flex flex-col items-center gap-1 border-b-2 transition-all", activeTab === tab.id ? "border-[#00A2FF] text-[#00A2FF]" : "border-transparent text-gray-400")}>
            <tab.icon className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </div>

      <main className="flex-1 p-6 pb-20">
        {activeTab === 'recruitment' && (
          <div className="space-y-4">
            {applicants.length === 0 ? <div className="p-12 text-center text-gray-300 text-xs font-bold uppercase tracking-widest">No pending applications</div> : applicants.map(app => (
              <div key={app.uid} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3"><Avatar className="w-10 h-10"><AvatarImage src={app.photo_url} /><AvatarFallback><User /></AvatarFallback></Avatar><span className="font-bold text-sm">{app.name}</span></div>
                <div className="flex gap-2">
                  <Button size="icon" disabled={isProcessing} onClick={() => handleReview(app.uid, 'approved')} className="bg-green-500 rounded-full h-9 w-9 shadow-lg shadow-green-100"><Check className="w-4 h-4 text-white" /></Button>
                  <Button size="icon" disabled={isProcessing} onClick={() => handleReview(app.uid, 'rejected')} variant="outline" className="border-red-200 text-red-500 rounded-full h-9 w-9"><X className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase text-gray-400 tracking-widest px-1">Agency Agent</h2>
            <div className="flex items-center gap-3 p-4 bg-[#00A2FF]/5 border border-[#00A2FF]/10 rounded-2xl">
              <Avatar className="w-12 h-12 border-2 border-[#00A2FF]"><AvatarImage src={profile?.photo_url} /><AvatarFallback><User /></AvatarFallback></Avatar>
              <div className="flex-1"><span className="font-bold text-sm block">{profile?.name} (You)</span><span className="text-[9px] font-bold text-[#00A2FF] uppercase tracking-widest">Agency Owner</span></div>
            </div>
            <h2 className="text-[10px] font-bold uppercase text-gray-400 tracking-widest px-1 mt-6">Team Members</h2>
            <div className="space-y-3">
              {members.length === 0 ? <div className="p-12 text-center text-gray-300 text-xs font-bold uppercase tracking-widest">No members yet</div> : members.map(member => (
                <div key={member.uid} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-black/5">
                  <div className="flex items-center gap-3"><Avatar className="w-10 h-10 border border-white"><AvatarImage src={member.photo_url} /><AvatarFallback><User /></AvatarFallback></Avatar><span className="font-bold text-sm text-black">{member.name}</span></div>
                  <Button size="icon" variant="ghost" onClick={() => router.push(`/chats?startWith=${member.uid}`)} className="rounded-full bg-white shadow-sm text-[#00A2FF] border border-blue-50"><MessageSquare className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
            <div ref={observerTarget} className="h-10" />
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            {withdrawals.length === 0 ? <div className="p-12 text-center text-gray-300 text-xs font-bold uppercase tracking-widest">No pending payouts</div> : withdrawals.map(req => (
              <div key={req.id} className="p-5 bg-white border rounded-2xl shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-start">
                  <div><h4 className="font-bold text-sm">UID: {req.user_id.slice(0, 8)}...</h4><p className="text-[10px] font-bold text-gray-400 uppercase">Requested: {format(req.timestamp, "MMM d, HH:mm")}</p></div>
                  <div className="text-right cursor-pointer" onClick={() => handleCopy(req.amount_kes.toString(), "Amount")}>
                    <p className="text-lg font-black text-green-600 flex items-center gap-1.5 justify-end">Ksh {req.amount_kes} <Copy className="w-3 h-3 opacity-30" /></p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{req.diamonds} Diamonds</p>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-xl border flex items-center justify-between cursor-pointer active:bg-gray-100 transition-colors" onClick={() => handleCopy(req.mpesa_number, "M-Pesa Number")}>
                  <div><p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Destination M-Pesa</p><p className="text-sm font-black text-black tracking-widest">{req.mpesa_number || "---"}</p></div>
                  <Copy className="w-4 h-4 text-[#00A2FF]" />
                </div>

                <div className="flex gap-2">
                  <Button disabled={isProcessing} onClick={() => handleWithdrawalReview(req.id, 'paid')} className="flex-1 bg-green-600 text-white font-bold h-12 rounded-full uppercase tracking-widest text-[10px] shadow-lg shadow-green-100">Paid</Button>
                  <Button disabled={isProcessing} onClick={() => handleWithdrawalReview(req.id, 'rejected')} variant="outline" className="flex-1 border-red-200 text-red-500 font-bold h-12 rounded-full uppercase tracking-widest text-[10px]">Reject</Button>
                </div>
              </div>
            ))}
            <div ref={observerTarget} className="h-10" />
          </div>
        )}
      </main>
    </div>
  )
}
