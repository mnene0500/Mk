"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Settings, ChevronRight, Copy, Check, BadgeCheck, Headphones, Pencil, Gem, Loader2, Trophy, Users, Briefcase, UserPlus, Wallet, Shield, User, Flag, PlusCircle, History, Zap, Award } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/firebase/auth/use-user"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createAgencyAction, joinAgencyAction } from "@/app/actions/matchflow-actions"
import { useBalance } from "@/lib/providers/BalanceProvider"

export default function MePage() {
  const router = useRouter()
  const { user, loading: authLoading, isInitialized } = useUser()
  const { toast } = useToast()
  const { coins, diamonds } = useBalance();
  
  const [copied, setCopied] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [isReady, setIsReady] = useState(false)
  const [agencyCode, setAgencyCode] = useState("")
  const [agencyName, setAgencyName] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('users')
      .select('uid, name, photo_url, match_flow_id, is_verified, is_admin, is_coin_seller, is_agent, gender, agency_id, agency_status, updated_at')
      .eq('uid', user.id)
      .maybeSingle();
    if (data) setProfile(data)
    setIsReady(true)
  }, [user?.id])

  useEffect(() => {
    if (!user && isInitialized && !authLoading) router.replace("/welcome")
    if (user?.id) fetchProfile()
  }, [user, isInitialized, authLoading, fetchProfile, router])

  const handleJoinAgency = async () => {
    if (!user || !agencyCode) return
    setIsProcessing(true)
    const res = await joinAgencyAction(user.id, agencyCode)
    if (res.success) {
      toast({ title: "Request Sent", description: "Waiting for agent approval." })
      fetchProfile()
    } else {
      toast({ variant: "destructive", title: "Error", description: res.error })
    }
    setIsProcessing(false)
  }

  const handleCreateAgency = async () => {
    if (!user || !agencyName) return
    setIsProcessing(true)
    const res = await createAgencyAction(user.id, agencyName)
    if (res.success) {
      toast({ title: "Agency Created!", description: `Code: ${res.code}` })
      fetchProfile()
    } else {
      toast({ variant: "destructive", title: "Error", description: res.error })
    }
    setIsProcessing(false)
  }

  if (!isReady && (authLoading || !profile)) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-[#00A2FF]" /></div>

  const isAdmin = profile?.is_admin
  const isMerchant = profile?.is_coin_seller || isAdmin
  const isAgent = profile?.is_agent || isAdmin

  return (
    <div className="flex-1 pb-24 bg-[#F8F9FA] min-h-screen relative animate-in fade-in duration-300">
      <div className="absolute top-0 left-0 w-full h-[280px] bg-[#00A2FF]" />
      <div className="relative z-10">
        <header className="pt-12 pb-10 px-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="relative w-28 h-28 rounded-full shadow-2xl overflow-hidden bg-white">
              <Image src={`${profile?.photo_url}?t=${profile?.updated_at || Date.now()}`} alt={profile?.name || "Me"} fill className="object-cover" sizes="112px" />
            </div>
            <button className="absolute bottom-1 right-1 bg-white p-3 rounded-full shadow-xl" onClick={() => router.push('/edit-profile')}><Pencil className="w-4 h-4 text-[#00A2FF]" /></button>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5">{profile?.name} {profile?.is_verified && <BadgeCheck className="w-4 h-4 text-white fill-blue-500" />}</h2>
          <p onClick={() => { navigator.clipboard.writeText(profile?.match_flow_id); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-white/70 font-semibold text-[9px] uppercase tracking-widest mt-1 cursor-pointer">ID: {profile?.match_flow_id} {copied ? <Check className="w-2.5 h-2.5 inline text-green-300" /> : <Copy className="w-2.5 h-2.5 inline opacity-50" />}</p>
        </header>

        <main className="px-6 space-y-6">
          {/* BALANCE CARDS */}
          <div className="grid grid-cols-2 gap-4 -mt-6">
            <Button className="h-24 bg-white rounded-[2rem] shadow-xl flex flex-col items-center justify-center text-[#00A2FF]" onClick={() => router.push('/recharge')}>
              <div className="flex items-center gap-2"><PlusCircle className="w-5 h-5" /><span className="text-lg font-black">{coins}</span></div>
              <span className="text-[8px] font-black uppercase opacity-60">Coins</span>
            </Button>
            <Button className="h-24 bg-white rounded-[2rem] shadow-xl flex flex-col items-center justify-center text-black" onClick={() => router.push("/income")}>
              <div className="flex items-center gap-2"><Gem className="w-5 h-5 text-blue-500" /><span className="text-lg font-black">{diamonds.toFixed(0)}</span></div>
              <span className="text-[8px] font-black uppercase opacity-60">Diamonds</span>
            </Button>
          </div>

          {/* MERCHANT CONSOLE */}
          {isMerchant && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Merchant Console</h3>
              <div className="bg-white rounded-3xl p-2 shadow-sm border border-black/5 flex flex-col overflow-hidden">
                <Button variant="ghost" className="h-16 justify-between px-5 rounded-none" onClick={() => router.push('/award-coins')}>
                  <div className="flex items-center gap-4">
                    <div className="bg-yellow-50 p-2.5 rounded-xl"><Award className="w-5 h-5 text-yellow-600" /></div>
                    <span className="font-semibold text-xs text-black">Coin Center (Award)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Button>
              </div>
            </section>
          )}

          {/* AGENT / AGENCY CONSOLE */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Agency Console</h3>
            <div className="bg-white rounded-3xl p-2 shadow-sm border border-black/5 flex flex-col overflow-hidden">
              {isAgent && (
                <Button variant="ghost" className="h-16 justify-between px-5 rounded-none border-b border-gray-50" onClick={() => router.push('/agency-manage')}>
                  <div className="flex items-center gap-4">
                    <div className="bg-purple-50 p-2.5 rounded-xl"><Briefcase className="w-5 h-5 text-purple-600" /></div>
                    <span className="font-semibold text-xs text-black">Agency Center</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Button>
              )}
              
              <Button variant="ghost" className="h-16 justify-between px-5 rounded-none border-b border-gray-50" onClick={() => router.push('/agency-wallet')}>
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-50 p-2.5 rounded-xl"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                  <span className="font-semibold text-xs text-black">Agency Wallet</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </Button>

              {!profile?.agency_id ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="h-16 justify-between px-5 rounded-none">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-50 p-2.5 rounded-xl"><UserPlus className="w-5 h-5 text-blue-600" /></div>
                        <span className="font-semibold text-xs text-black">Join Agency Program</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2rem] p-8">
                    <DialogHeader><DialogTitle className="text-xl font-bold">Join Agency</DialogTitle><DialogDescription className="text-xs">Enter a code or apply to be an agent.</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><label className="text-[10px] font-black uppercase text-gray-400">Join via Code</label><Input placeholder="5-digit code" value={agencyCode} onChange={(e) => setAgencyCode(e.target.value)} className="rounded-2xl h-12" /></div>
                      <Button onClick={handleJoinAgency} disabled={isProcessing || !agencyCode} className="w-full h-12 rounded-full bg-[#00A2FF]">Join Now</Button>
                      <div className="relative py-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-[8px] font-bold uppercase"><span className="bg-white px-2 text-gray-400">OR</span></div></div>
                      <div className="space-y-2"><label className="text-[10px] font-black uppercase text-gray-400">Apply to be Agent</label><Input placeholder="Agency Name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="rounded-2xl h-12" /></div>
                      <Button onClick={handleCreateAgency} disabled={isProcessing || !agencyName} variant="outline" className="w-full h-12 rounded-full">Apply for Agent Role</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="h-16 flex items-center justify-between px-5">
                   <div className="flex items-center gap-4">
                     <div className="bg-blue-50 p-2.5 rounded-xl"><Briefcase className="w-5 h-5 text-blue-600" /></div>
                     <div className="flex flex-col">
                        <span className="font-semibold text-xs text-black">Member Status</span>
                        <span className="text-[9px] font-bold text-[#00A2FF] uppercase">{profile.agency_status}</span>
                     </div>
                   </div>
                   <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full border">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">ID: {profile.agency_id}</span>
                   </div>
                </div>
              )}
            </div>
          </section>

          {/* ADMIN CONSOLE */}
          {isAdmin && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Admin Console</h3>
              <div className="bg-white rounded-3xl p-2 shadow-sm border border-black/5 flex flex-col overflow-hidden">
                <Button variant="ghost" className="h-16 justify-between px-5 rounded-none border-b border-gray-50" asChild>
                  <Link href="/manage-roles">
                    <div className="flex items-center gap-4">
                      <div className="bg-indigo-50 p-2.5 rounded-xl"><Shield className="w-5 h-5 text-indigo-600" /></div>
                      <span className="font-semibold text-xs text-black">Authority Manager</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </Link>
                </Button>
                <Button variant="ghost" className="h-16 justify-between px-5 rounded-none" asChild>
                  <Link href="/manage-reports">
                    <div className="flex items-center gap-4">
                      <div className="bg-red-50 p-2.5 rounded-xl"><Flag className="w-5 h-5 text-red-600" /></div>
                      <span className="font-semibold text-xs text-black">Report Queue</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </Link>
                </Button>
              </div>
            </section>
          )}

          {/* SETTINGS GROUP */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Account & Support</h3>
            <div className="bg-white rounded-3xl p-2 shadow-sm border border-black/5 flex flex-col overflow-hidden">
              <Button variant="ghost" className="h-16 justify-between px-5 rounded-none border-b border-gray-50" asChild>
                <Link href="/support"><div className="flex items-center gap-4"><div className="bg-blue-50 p-2.5 rounded-xl"><Headphones className="w-5 h-5 text-blue-600" /></div><span className="font-semibold text-xs text-black">Support Center</span></div><ChevronRight className="w-4 h-4 text-gray-300" /></Link>
              </Button>
              <Button variant="ghost" className="h-16 justify-between px-5 rounded-none" asChild>
                <Link href="/settings"><div className="flex items-center gap-4"><div className="bg-gray-50 p-2.5 rounded-xl"><Settings className="w-5 h-5 text-gray-600" /></div><span className="font-semibold text-xs text-black">Settings</span></div><ChevronRight className="w-4 h-4 text-gray-300" /></Link>
              </Button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
