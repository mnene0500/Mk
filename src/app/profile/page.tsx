"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Settings, ChevronRight, Copy, Check, BadgeCheck, Headphones, Pencil, Gem, Loader2, Award, Briefcase, UserPlus, Wallet, Shield, PlusCircle, LogOut, Flag, UserCheck } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/firebase/auth/use-user"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createAgencyAction, joinAgencyAction, leaveAgencyAction } from "@/app/actions/matchflow-actions"
import { useBalance } from "@/lib/providers/BalanceProvider"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

/**
 * @fileOverview Me Page with Flat Design (No avatar border) and Owner Console.
 */
export default function MePage() {
  const router = useRouter()
  const { user, loading: authLoading, isInitialized } = useUser()
  const { toast } = useToast()
  const { coins, diamonds } = useBalance();
  
  const [idCopied, setIdCopied] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [isReady, setIsReady] = useState(false)
  const [agencyCode, setAgencyCode] = useState("")
  const [agencyName, setAgencyName] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const fetchGuard = useRef(false)

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await supabase.from('users').select('*').eq('uid', user.id).maybeSingle();
      if (data) setProfile(data)
    } catch (e) {
      console.error("Profile load error")
    } finally {
      setIsReady(true)
    }
  }, [user?.id])

  useEffect(() => {
    if (isInitialized && !authLoading && !user) {
        router.replace("/welcome")
        return
    }
    if (user?.id && !fetchGuard.current) {
        fetchProfile()
        fetchGuard.current = true
    }
  }, [user, isInitialized, authLoading, fetchProfile, router])

  const copyToClipboard = (text: string, setCopied: (val: boolean) => void) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied" });
    setTimeout(() => setCopied(false), 2000);
  }

  const handleJoinAgency = async () => {
    if (!user || !agencyCode) return
    setIsProcessing(true)
    const res = await joinAgencyAction(user.id, agencyCode)
    if (res.success) {
      toast({ title: "Request Sent" }); fetchProfile()
    } else {
      toast({ variant: "destructive", title: "Error", description: res.error })
    }
    setIsProcessing(false)
  }

  const handleLeaveAgency = async () => {
    if (!user) return
    setIsProcessing(true)
    const res = await leaveAgencyAction(user.id)
    if (res.success) {
      toast({ title: "Left Agency" }); fetchProfile()
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
      toast({ title: "Agency Created!" }); fetchProfile()
    } else {
      toast({ variant: "destructive", title: "Error", description: res.error })
    }
    setIsProcessing(false)
  }

  if (!isReady || authLoading) return (
    <div className="fixed inset-0 bg-white flex items-center justify-center select-none z-[9999]">
       <h1 className="text-7xl font-logo font-black text-[#00A2FF] tracking-tight animate-pulse">QIVO</h1>
    </div>
  );

  const isOwner = profile?.is_owner === true
  const isMerchant = profile?.is_coin_seller === true || isOwner
  const isAgent = profile?.is_agent === true
  const isFemale = profile?.gender === 'female'
  const isAgencyMember = profile?.agency_status === 'approved'
  const isVerified = profile?.is_verified === true
  
  const displayPhoto = profile?.photo_url || "https://picsum.photos/seed/qivo/400/400"
  const cacheBust = profile?.updated_at ? new Date(profile.updated_at).getTime() : Date.now()

  return (
    <div className="flex-1 pb-24 bg-[#F8F9FA] min-h-screen relative animate-in fade-in duration-300 select-none">
      <div className="absolute top-0 left-0 w-full h-[280px] bg-[#00A2FF]" />
      <div className="relative z-10">
        <header className="pt-12 pb-10 px-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="relative w-28 h-28 rounded-full overflow-hidden bg-white shadow-xl border-none">
              <Image src={`${displayPhoto}?t=${cacheBust}`} alt={profile?.name || "Me"} fill className="object-cover" sizes="112px" />
            </div>
            <button className="absolute bottom-1 right-1 bg-white p-2.5 rounded-full shadow-lg active:scale-90 transition-transform" onClick={() => router.push('/edit-profile')}>
              <Pencil className="w-4 h-4 text-[#00A2FF]" />
            </button>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
            {profile?.name || "User"} {isVerified && <BadgeCheck className="w-4 h-4 text-white fill-blue-500" />}
          </h2>
          <p onClick={() => copyToClipboard(profile?.match_flow_id, setIdCopied)} className="text-white/70 font-semibold text-[9px] uppercase tracking-widest mt-1 cursor-pointer active:opacity-50 transition-opacity">
            ID: {profile?.match_flow_id || "---"} {idCopied ? <Check className="w-2.5 h-2.5 inline text-green-300" /> : <Copy className="w-2.5 h-2.5 inline opacity-50" />}
          </p>
        </header>

        <main className="px-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 -mt-6">
            <Button className="h-24 bg-white rounded-[2rem] shadow-xl flex flex-col items-center justify-center text-[#00A2FF] active:scale-95 transition-transform" onClick={() => router.push('/recharge')}>
              <div className="flex items-center gap-2"><PlusCircle className="w-5 h-5" /><span className="text-lg font-black">{coins}</span></div>
              <span className="text-[8px] font-black uppercase opacity-60">Coins</span>
            </Button>
            <Button className="h-24 bg-white rounded-[2rem] shadow-xl flex flex-col items-center justify-center text-black active:scale-95 transition-transform" onClick={() => router.push("/income")}>
              <div className="flex items-center gap-2"><Gem className="w-5 h-5 text-blue-500" /><span className="text-lg font-black">{diamonds.toFixed(0)}</span></div>
              <span className="text-[8px] font-black uppercase opacity-60">Diamonds</span>
            </Button>
          </div>

          {!isVerified && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Identity Trust</h3>
              <div className="bg-white rounded-3xl p-2 shadow-sm border border-black/5 overflow-hidden">
                <Button variant="ghost" className="h-16 w-full justify-between px-5 rounded-none" onClick={() => router.push('/verify-identity')}>
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-2.5 rounded-xl"><UserCheck className="w-5 h-5 text-[#00A2FF]" /></div>
                    <div className="flex flex-col items-start">
                       <span className="font-semibold text-xs text-black">Verify My Face</span>
                       <span className="text-[8px] font-bold text-[#00A2FF] uppercase tracking-tighter">Get Trusted Badge</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Button>
              </div>
            </section>
          )}

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

          {isFemale && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Agency Program</h3>
              <div className="bg-white rounded-3xl p-2 shadow-sm border border-black/5 flex flex-col overflow-hidden">
                {isAgent && profile?.agency_id && (
                  <Button variant="ghost" className="h-16 justify-between px-5 rounded-none border-b border-gray-50" onClick={() => router.push('/agency-manage')}>
                    <div className="flex items-center gap-4">
                      <div className="bg-purple-50 p-2.5 rounded-xl"><Briefcase className="w-5 h-5 text-purple-600" /></div>
                      <span className="font-semibold text-xs text-black">Agency Center</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </Button>
                )}
                
                {isAgencyMember && (
                  <Button variant="ghost" className="h-16 justify-between px-5 rounded-none border-b border-gray-50" onClick={() => router.push('/agency-wallet')}>
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-50 p-2.5 rounded-xl"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                      <span className="font-semibold text-xs text-black">Agency Wallet</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </Button>
                )}

                {!profile?.agency_id ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="h-16 justify-between px-5 rounded-none">
                        <div className="flex items-center gap-4">
                          <div className="bg-blue-50 p-2.5 rounded-xl"><UserPlus className="w-5 h-5 text-blue-600" /></div>
                          <span className="font-semibold text-xs text-black">Join Recruitment Agency</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] p-8">
                      <DialogHeader><DialogTitle className="text-xl font-bold">Agency Access</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-400">Join via Code</label>
                          <Input placeholder="5-digit code" value={agencyCode} onChange={(e) => setAgencyCode(e.target.value)} className="rounded-2xl h-12" />
                        </div>
                        <Button onClick={handleJoinAgency} disabled={isProcessing || !agencyCode} className="w-full h-12 rounded-full bg-[#00A2FF]">Join Now</Button>
                        {isAgent && !profile?.agency_id && (
                          <div className="pt-4 border-t mt-4 space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-gray-400">Agency Name</label>
                              <Input placeholder="Enter agency name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="rounded-2xl h-12" />
                            </div>
                            <Button onClick={handleCreateAgency} disabled={isProcessing || !agencyName} variant="outline" className="w-full h-12 rounded-full border-purple-200 text-purple-600">Create Agency</Button>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <div className="h-16 flex items-center justify-between px-5">
                     <div className="flex items-center gap-4">
                       <div className="bg-blue-50 p-2.5 rounded-xl"><Briefcase className="w-5 h-5 text-blue-600" /></div>
                       <div className="flex flex-col"><span className="font-semibold text-xs text-black">{isAgent ? "Leader" : "Member"}</span><span className="text-[9px] font-bold text-[#00A2FF] uppercase">{profile.agency_status}</span></div>
                     </div>
                     {!isAgent && (
                       <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-8 rounded-full text-red-500 text-[9px] font-black uppercase tracking-widest bg-red-50 px-4">Leave</Button></AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2rem] p-8 border-none"><AlertDialogHeader><AlertDialogTitle>Leave Agency?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter className="gap-3 mt-6"><AlertDialogCancel className="h-12 rounded-full">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleLeaveAgency} className="h-12 rounded-full bg-red-500">Leave</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                       </AlertDialog>
                     )}
                  </div>
                )}
              </div>
            </section>
          )}

          {isOwner && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Owner Console</h3>
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

          <section className="space-y-3 pb-10">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Account & Support</h3>
            <div className="bg-white rounded-3xl p-2 shadow-sm border border-black/5 flex flex-col overflow-hidden">
              <Button variant="ghost" className="h-16 justify-between px-5 rounded-none border-b border-gray-50" asChild>
                <Link href="/support">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-2.5 rounded-xl"><Headphones className="w-5 h-5 text-blue-600" /></div>
                    <span className="font-semibold text-xs text-black">Support Center</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Link>
              </Button>
              <Button variant="ghost" className="h-16 justify-between px-5 rounded-none" asChild>
                <Link href="/settings">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-50 p-2.5 rounded-xl"><Settings className="w-5 h-5 text-gray-600" /></div>
                    <span className="font-semibold text-xs text-black">Settings</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Link>
              </Button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}