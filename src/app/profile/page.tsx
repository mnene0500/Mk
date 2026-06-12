"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Settings, ChevronRight, Copy, Check, BadgeCheck, Headphones, Pencil, Gem, Award, Briefcase, UserPlus, Wallet, Shield, PlusCircle, UserCheck, Flag, Gamepad2, Coins, Users, UserX } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/firebase/auth/use-user"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createAgencyAction, joinAgencyAction, leaveAgencyAction } from "@/app/actions/matchflow-actions"
import { useBalance } from "@/lib/providers/BalanceProvider"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

let cachedProfile: any = null;

export default function MePage() {
  const router = useRouter()
  const { user, loading: authLoading, isInitialized } = useUser()
  const { toast } = useToast()
  const { coins, diamonds } = useBalance();
  
  const [idCopied, setIdCopied] = useState(false)
  const [profile, setProfile] = useState<any>(cachedProfile)
  const [agencyCode, setAgencyCode] = useState("")
  const [agencyName, setAgencyName] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const { data } = await supabase.from('users').select('*').eq('uid', user.id).maybeSingle();
      if (data) {
        setProfile(data)
        cachedProfile = data
      }
    } catch (e) {
      console.error("Profile load error")
    }
  }, [user?.id])

  useEffect(() => {
    if (isInitialized && !authLoading && !user) {
        router.replace("/welcome")
        return
    }
    if (user?.id) {
        fetchProfile()
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
      toast({ title: "Request Sent" });
      fetchProfile()
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
      toast({ title: "Left Agency" });
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
      toast({ title: "Agency Created!" });
      fetchProfile()
    } else {
      toast({ variant: "destructive", title: "Error", description: res.error })
    }
    setIsProcessing(false)
  }

  if (authLoading || !isInitialized) return null;

  const isAdmin = !!profile?.is_admin
  const isMerchant = !!(profile?.is_coin_seller || isAdmin)
  const isAgent = !!profile?.is_agent
  const isVerified = !!profile?.is_verified
  
  const isEligibleForAgency = profile?.gender === 'female' && profile?.country === 'Kenya' && isVerified
  const isAgencyMember = profile?.agency_status === 'approved'
  
  const displayPhoto = profile?.photo_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
  const cacheBust = profile?.updated_at ? new Date(profile.updated_at).getTime() : Date.now()

  return (
    <div className="flex-1 pb-24 bg-[#F8FAFC] min-h-screen relative select-none animate-in fade-in duration-300">
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-[#8B0000] to-[#5a0000]" />
      
      <div className="relative z-10">
        <header className="pt-12 pb-8 px-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="relative w-28 h-28 rounded-full overflow-hidden bg-white/20 backdrop-blur-xl p-1 shadow-2xl">
              <div className="w-full h-full rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {displayPhoto ? (
                  <Image src={`${displayPhoto}?t=${cacheBust}`} alt={profile?.name || "Me"} fill className="object-cover" sizes="112px" priority />
                ) : (
                  <Users className="w-10 h-10 text-gray-300" />
                )}
              </div>
            </div>
            <button 
              className="absolute -bottom-0.5 right-1.5 bg-white p-2 rounded-full shadow-xl active:scale-90 transition-transform border border-gray-50" 
              onClick={() => router.push('/edit-profile')}
            >
              <Pencil className="w-3.5 h-3.5 text-[#8B0000]" />
            </button>
          </div>
          
          <div className="space-y-0.5">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              {profile?.name || "User"} 
              {isVerified && <BadgeCheck className="w-4 h-4 text-white fill-[#8B0000]" />}
              {isAdmin && <Shield className="w-4 h-4 text-red-200 fill-current" />}
            </h2>
            <button 
              onClick={() => copyToClipboard(profile?.match_flow_id, setIdCopied)} 
              className="px-3 py-1 bg-black/10 backdrop-blur-md rounded-full text-white/80 font-black text-[9px] tracking-[0.15em] uppercase active:opacity-50 transition-all flex items-center gap-1.5 mx-auto border border-white/10"
            >
              ID: {profile?.match_flow_id || "---"} 
              {idCopied ? <Check className="w-2.5 h-2.5 text-green-300" /> : <Copy className="w-2.5 h-2.5 opacity-50" />}
            </button>
          </div>
        </header>

        <main className="px-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 -mt-4">
            <button 
              className="group relative h-28 bg-white rounded-[2rem] shadow-lg flex flex-col items-center justify-center overflow-hidden border border-white active:scale-95 transition-all"
              onClick={() => router.push('/recharge')}
            >
              <div className="absolute top-0 right-0 w-12 h-12 bg-[#8B0000]/5 rounded-bl-[2rem]" />
              <div className="flex items-center gap-2 mb-0.5">
                <div className="p-1.5 bg-red-50 rounded-lg group-hover:bg-[#8B0000] group-hover:text-white transition-colors">
                  <Coins className="w-4 h-4 text-[#8B0000] group-hover:text-white" />
                </div>
                <span className="text-xl font-black text-black tracking-tighter">{coins.toLocaleString()}</span>
              </div>
              <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Coins</span>
            </button>
            
            <button 
              className="group relative h-28 bg-white rounded-[2rem] shadow-lg flex flex-col items-center justify-center overflow-hidden border border-white active:scale-95 transition-all"
              onClick={() => router.push("/income")}
            >
              <div className="absolute top-0 right-0 w-12 h-12 bg-red-500/5 rounded-bl-[2rem]" />
              <div className="flex items-center gap-2 mb-0.5">
                <div className="p-1.5 bg-red-50 rounded-lg group-hover:bg-red-800 group-hover:text-white transition-colors">
                  <Gem className="w-4 h-4 text-red-800 group-hover:text-white" />
                </div>
                <span className="text-xl font-black text-black tracking-tighter">{Number(diamonds || 0).toFixed(0)}</span>
              </div>
              <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Diamonds</span>
            </button>
          </div>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2 uppercase">Entertainment</h3>
            <div className="bg-white rounded-[1.5rem] p-1.5 shadow-sm border border-slate-200/60 overflow-hidden">
              <Button variant="ghost" className="h-16 w-full justify-between px-4 rounded-none group" onClick={() => router.push('/game-center')}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Gamepad2 className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex flex-col items-start">
                     <span className="font-black text-xs tracking-tight text-slate-900">Game Center</span>
                     <span className="text-[9px] font-bold text-amber-500 uppercase">Win coins while playing</span>
                  </div>
                </div>
                <div className="w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                </div>
              </Button>
            </div>
          </section>

          {(isAdmin || isMerchant || isAgent || !isVerified) && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2 uppercase">Console</h3>
              <div className="bg-white rounded-[1.5rem] p-1.5 shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
                {isAdmin && (
                  <>
                    <RoleAction icon={Shield} color="bg-red-50 text-red-900" label="Authority Manager" href="/manage-roles" />
                    <RoleAction icon={UserX} color="bg-red-50 text-red-600" label="Account Control" href="/manage-roles?tab=search" />
                    <RoleAction icon={Flag} color="bg-orange-50 text-orange-600" label="Report Queue" href="/manage-reports" />
                  </>
                )}
                {isMerchant && <RoleAction icon={Award} color="bg-yellow-50 text-yellow-600" label="Award Coins" href="/award-coins" />}
                {isAgent && profile?.agency_id && <RoleAction icon={Briefcase} color="bg-red-50 text-red-800" label="Agency Center" href="/agency-manage" />}
                {!isVerified && <RoleAction icon={UserCheck} color="bg-red-50 text-[#8B0000]" label="Verify Identity" href="/verify-identity" subtitle="Get Trusted Badge" />}
              </div>
            </section>
          )}

          {isEligibleForAgency && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2 uppercase">Agency</h3>
              <div className="bg-white rounded-[1.5rem] p-1.5 shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
                {isAgencyMember ? (
                  <>
                    <RoleAction icon={Wallet} color="bg-emerald-50 text-emerald-600" label="Agency Wallet" href="/agency-wallet" />
                    <div className="h-16 flex items-center justify-between px-4 border-t border-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center"><Briefcase className="w-5 h-5 text-slate-400" /></div>
                        <div className="flex flex-col"><span className="font-black text-xs text-slate-900 uppercase">{isAgent ? "Agency Leader" : "Member"}</span><span className="text-[8px] font-bold text-[#8B0000] uppercase">{profile.agency_status}</span></div>
                      </div>
                      {!isAgent && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-8 rounded-xl text-red-500 font-black text-[9px] bg-red-50 px-4 uppercase">Leave</Button></AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2.5rem] p-8 border-none shadow-2xl w-[85vw] max-w-sm"><AlertDialogHeader><AlertDialogTitle className="font-black text-center uppercase tracking-tight text-lg">Leave Agency?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter className="gap-2 mt-4"><AlertDialogCancel className="h-12 rounded-xl font-black text-[10px] uppercase border-none bg-slate-50">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleLeaveAgency} className="h-12 rounded-xl bg-red-500 font-black text-[10px] uppercase shadow-lg shadow-red-100">Leave</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="h-16 justify-between px-4 rounded-none group">
                        <div className="flex items-center gap-4"><div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><UserPlus className="w-5 h-5 text-red-900" /></div><span className="font-black text-xs tracking-tight text-slate-900">Join Agency</span></div>
                        <div className="w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center"><ChevronRight className="w-3.5 h-3.5 text-slate-300" /></div>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] p-8 border-none shadow-2xl w-[90vw] max-w-sm"><DialogHeader><DialogTitle className="text-xl font-black tracking-tight uppercase text-center">Agency Portal</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Invite Code</label><Input placeholder="5-digit code" value={agencyCode} onChange={(e) => setAgencyCode(e.target.value)} className="rounded-xl h-14 font-black text-lg text-center border-slate-100 bg-slate-50" /></div><Button onClick={handleJoinAgency} disabled={isProcessing || !agencyCode} className="w-full h-14 rounded-xl bg-[#8B0000] font-black text-xs tracking-[0.1em] uppercase">Join Now</Button>{isAgent && !profile?.agency_id && (<div className="pt-6 border-t mt-4 space-y-4"><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Establish New Agency</label><Input placeholder="Agency Name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="rounded-xl h-12 font-bold border-slate-100 bg-slate-50" /></div><Button onClick={handleCreateAgency} disabled={isProcessing || !agencyName} variant="outline" className="w-full h-14 rounded-xl border-red-200 text-red-900 font-black text-xs uppercase">Create Agency</Button></div>)}</div></DialogContent>
                  </Dialog>
                )}
              </div>
            </section>
          )}

          <section className="space-y-3 pb-20">
            <h3 className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2 uppercase">Account</h3>
            <div className="bg-white rounded-[1.5rem] p-1.5 shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
              <RoleAction icon={Headphones} color="bg-red-50 text-red-800" label="Support Center" href="/support" />
              <RoleAction icon={Settings} color="bg-slate-50 text-slate-600" label="Settings" href="/settings" hideBorder />
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function RoleAction({ icon: Icon, color, label, href, subtitle, hideBorder }: { icon: any, color: string, label: string, href: string, subtitle?: string, hideBorder?: boolean }) {
  const router = useRouter()
  return (
    <Button 
      variant="ghost" 
      className={cn(
        "h-16 justify-between px-4 rounded-none group",
        !hideBorder && "border-b border-slate-50"
      )} 
      onClick={() => router.push(href)}
    >
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col items-start">
          <span className="font-black text-xs tracking-tight text-slate-900">{label}</span>
          {subtitle && <span className="text-[8px] font-bold text-[#8B0000] uppercase">{subtitle}</span>}
        </div>
      </div>
      <div className="w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center">
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
      </div>
    </Button>
  )
}
