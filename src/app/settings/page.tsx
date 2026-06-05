"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, ShieldAlert, Info, RefreshCw, CreditCard, LogOut, Trash2, Loader2, Ban, ShieldCheck, Moon, Link as LinkIcon, User, Eye, EyeOff, Coins, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { deleteUserCompletelyAction, activateReadReceiptsAction, activateVisitorTrackingAction } from "@/app/actions/matchflow-actions"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

interface SettingItemProps {
  label: string
  onClick?: () => void
  href?: string
  icon: React.ReactNode
  variant?: 'default' | 'destructive'
  hideBorder?: boolean
  children?: React.ReactNode
}

function SettingItem({ label, onClick, href, icon, variant = 'default', hideBorder, children }: SettingItemProps) {
  const content = (
    <div className={cn(
      "flex items-center justify-between py-5 px-6 active:bg-gray-50 transition-colors cursor-pointer bg-white group",
      !hideBorder && "border-b border-gray-50"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-11 h-11 rounded-2xl flex items-center justify-center group-active:scale-90 transition-transform",
          variant === 'destructive' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-black'
        )}>
          {icon}
        </div>
        <span className={cn(
          "text-[15px] font-black tracking-tight",
          variant === 'destructive' ? 'text-red-500' : 'text-slate-900'
        )}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
         {children}
         {!children && (
           <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-4 h-4 text-gray-300" />
           </div>
         )}
      </div>
    </div>
  )

  if (href) return <Link href={href} className="block">{content}</Link>
  return <div onClick={onClick}>{content}</div>
}

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useUser()
  
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDnd, setIsDnd] = useState(false)
  const [isActivating, setIsActivating] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    const fetchProfile = async () => {
      const { data } = await supabase.from('users').select('*').eq('uid', user.id).single()
      if (data) {
        setProfile(data)
        setIsDnd(!!data.is_dnd)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [user?.id])

  const toggleDnd = async (val: boolean) => {
    if (!user) return
    setIsDnd(val)
    const { error } = await supabase.from('users').update({ is_dnd: val }).eq('uid', user.id)
    if (error) {
      setIsDnd(!val)
      toast({ variant: "destructive", title: "Sync failed" })
    } else {
      toast({ title: val ? "DND Activated" : "DND Deactivated" })
    }
  }

  const handleActivateReadReceipts = async () => {
    if (!user) return
    setIsActivating(true)
    const res = await activateReadReceiptsAction(user.id)
    if (res.success) {
      toast({ title: "Read Receipts Activated!" })
      setProfile({ ...profile, has_read_receipts: true })
    } else {
      toast({ variant: "destructive", title: "Activation Failed", description: res.error === 'insufficient_funds' ? "You need 200 coins." : "Error occurred." })
    }
    setIsActivating(false)
  }

  const handleActivateVisitors = async () => {
    if (!user) return
    setIsActivating(true)
    const res = await activateVisitorTrackingAction(user.id)
    if (res.success) {
      toast({ title: "Visitor Tracking Activated!" })
      setProfile({ ...profile, has_visitor_tracking: true })
    } else {
      toast({ variant: "destructive", title: "Activation Failed", description: res.error === 'insufficient_funds' ? "You need 400 coins." : "Error occurred." })
    }
    setIsActivating(false)
  }

  const handleSignOut = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      await supabase.auth.signOut()
      window.location.replace("/welcome")
    } catch (error) {
      console.error(error)
    }
  }

  const handleClearCache = async () => {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (!key.includes('auth-token')) {
          localStorage.removeItem(key);
        }
      }
      sessionStorage.clear()
      toast({ title: "App refreshed", description: "Storage cleared successfully." })
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText.toUpperCase() !== "DELETE") return

    setIsDeleting(true)
    try {
      const res = await deleteUserCompletelyAction(user.id);
      if (res.success) {
        localStorage.clear();
        sessionStorage.clear();
        await supabase.auth.signOut();
        window.location.replace("/welcome");
        toast({ title: "Account deleted" });
      } else {
        throw new Error(res.error);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Deletion failed", description: error.message });
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex-1 bg-[#F8FAFC] flex flex-col min-h-screen select-none">
      <header className="flex items-center justify-between px-6 h-16 bg-white sticky top-0 z-50 border-b shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-gray-50">
          <ChevronLeft className="w-5 h-5 text-black" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-[0.2em]">Application</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-6 space-y-8 overflow-y-auto no-scrollbar pb-12">
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Communication</h2>
          <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm">
            <SettingItem label="Do Not Disturb" icon={<Moon className="w-5 h-5" />}>
              <Switch checked={isDnd} onCheckedChange={toggleDnd} />
            </SettingItem>
            {profile && !profile.has_read_receipts ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div className="flex items-center justify-between py-5 px-6 active:bg-gray-50 transition-colors cursor-pointer bg-white group hideBorder">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-500">
                        <Eye className="w-5 h-5" />
                      </div>
                      <span className="text-[15px] font-black tracking-tight text-slate-900">Read Receipts</span>
                    </div>
                    <span className="px-3 py-1 bg-[#00A2FF] text-white text-[8px] font-black uppercase rounded-full">Unlock</span>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[3rem] p-10 border-none shadow-2xl">
                  <AlertDialogHeader className="items-center text-center">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                      <Eye className="w-10 h-10 text-[#00A2FF]" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black tracking-tight uppercase">Sent & Seen</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium text-gray-400 pt-2">Enable real-time message status updates. Pay once and see when your messages are delivered and read.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-col gap-4 mt-10">
                    <Button onClick={handleActivateReadReceipts} disabled={isActivating} className="w-full h-16 rounded-2xl bg-[#00A2FF] text-white font-black uppercase tracking-widest text-sm shadow-xl">
                      {isActivating ? <Loader2 className="animate-spin" /> : <><Coins className="w-4 h-4 mr-2" /> Pay 200 Coins</>}
                    </Button>
                    <AlertDialogCancel className="w-full h-14 rounded-2xl border-none bg-gray-50 text-gray-400 font-black uppercase tracking-widest text-xs">Maybe Later</AlertDialogCancel>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div className="flex items-center justify-between py-5 px-6 bg-white group hideBorder">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-green-50 text-green-500">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-[15px] font-black tracking-tight text-slate-900">Read Receipts</span>
                </div>
                <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Active</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Premium Features</h2>
          <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm">
            {profile && !profile.has_visitor_tracking ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div className="flex items-center justify-between py-5 px-6 active:bg-gray-50 transition-colors cursor-pointer bg-white group hideBorder">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-purple-50 text-purple-500">
                        <Zap className="w-5 h-5" />
                      </div>
                      <span className="text-[15px] font-black tracking-tight text-slate-900">Profile Visitors</span>
                    </div>
                    <span className="px-3 py-1 bg-purple-500 text-white text-[8px] font-black uppercase rounded-full">Unlock</span>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[3rem] p-10 border-none shadow-2xl">
                  <AlertDialogHeader className="items-center text-center">
                    <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-6">
                      <Zap className="w-10 h-10 text-purple-500" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black tracking-tight uppercase">Who Visited?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium text-gray-400 pt-2">See exactly who has been checking out your profile. Get notified about your admirers with a one-time activation.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-col gap-4 mt-10">
                    <Button onClick={handleActivateVisitors} disabled={isActivating} className="w-full h-16 rounded-2xl bg-purple-600 text-white font-black uppercase tracking-widest text-sm shadow-xl">
                      {isActivating ? <Loader2 className="animate-spin" /> : <><Coins className="w-4 h-4 mr-2" /> Pay 400 Coins</>}
                    </Button>
                    <AlertDialogCancel className="w-full h-14 rounded-2xl border-none bg-gray-50 text-gray-400 font-black uppercase tracking-widest text-xs">Maybe Later</AlertDialogCancel>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div className="flex items-center justify-between py-5 px-6 bg-white group hideBorder">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-green-50 text-green-500">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-[15px] font-black tracking-tight text-slate-900">Visitor Tracking</span>
                </div>
                <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Active</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Account Management</h2>
          <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div className="flex items-center justify-between py-5 px-6 active:bg-gray-50 transition-colors cursor-pointer bg-white group border-b border-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gray-50 text-blue-500 group-active:scale-90 transition-transform">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <span className="text-[15px] font-black tracking-tight text-slate-900">Bind Account</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[3rem] p-10 border-none shadow-2xl">
                <AlertDialogHeader className="items-center text-center">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                    <User className="w-10 h-10 text-[#00A2FF]" />
                  </div>
                  <AlertDialogTitle className="text-2xl font-black tracking-tight uppercase">Linked Account</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium text-gray-400 pt-2 space-y-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center">
                      <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Authenticated via</span>
                      <span className="text-black font-black break-all">{user?.email}</span>
                      <div className="mt-2 px-3 py-1 bg-[#00A2FF]/10 text-[#00A2FF] text-[9px] font-black uppercase rounded-full border border-[#00A2FF]/20">
                        {user?.app_metadata?.provider === 'google' ? 'Google Social' : 'Secure Email'}
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8">
                  <AlertDialogCancel className="w-full h-16 rounded-2xl border-none bg-gray-50 text-black font-black uppercase tracking-widest text-sm">Close</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <SettingItem label="Charge Settings" href="/pricing" icon={<CreditCard className="w-5 h-5" />} hideBorder />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Privacy & Security</h2>
          <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm">
            <SettingItem label="Blocked Users" href="/blocked-list" icon={<Ban className="w-5 h-5" />} />
            <SettingItem label="Clear Local Cache" onClick={handleClearCache} icon={<RefreshCw className="w-5 h-5" />} hideBorder />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Information</h2>
          <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm">
            <SettingItem label="About Qivo" href="/about" icon={<Info className="w-5 h-5" />} />
            <SettingItem label="Safety Center" href="/support" icon={<ShieldCheck className="w-5 h-5" />} hideBorder />
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div className="flex items-center justify-between py-5 px-6 active:bg-gray-50 transition-colors cursor-pointer bg-white group border-b border-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gray-50 text-slate-500 group-active:scale-90 transition-transform">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span className="text-[15px] font-black tracking-tight text-slate-900">Sign Out</span>
                  </div>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[3rem] p-10 border-none shadow-2xl">
                <AlertDialogHeader className="items-center text-center">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                    <LogOut className="w-10 h-10 text-[#00A2FF]" />
                  </div>
                  <AlertDialogTitle className="text-2xl font-black tracking-tight uppercase">Sign Out?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium text-gray-400 pt-2">You will need to re-authenticate to access your profile.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col gap-4 mt-10">
                  <AlertDialogAction onClick={handleSignOut} className="w-full h-16 rounded-2xl bg-black text-white font-black uppercase tracking-widest text-sm shadow-xl">Yes, Sign Out</AlertDialogAction>
                  <AlertDialogCancel className="w-full h-16 rounded-2xl border-none bg-gray-50 text-gray-400 font-black uppercase tracking-widest text-sm">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {!loading && !profile?.is_admin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div className="flex items-center justify-between py-5 px-6 active:bg-red-50/10 transition-colors cursor-pointer bg-white group">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-red-50 text-red-500 group-active:scale-90 transition-transform">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <span className="text-[15px] font-black tracking-tight text-red-500">Delete Account</span>
                    </div>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[3rem] p-10 border-none shadow-2xl">
                  <AlertDialogHeader className="items-center text-center">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                      <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black tracking-tight uppercase">Permanently Delete?</AlertDialogTitle>
                    <AlertDialogDescription className="text-[11px] font-black text-gray-400 pt-2 uppercase tracking-[0.2em] leading-relaxed">
                      All coins, diamonds, and history will be lost forever. Type <span className="text-red-600">DELETE</span> to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-8">
                    <Input placeholder="Type DELETE" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className="rounded-2xl h-16 text-center font-black bg-gray-50 border-gray-100 text-xl tracking-[0.3em] uppercase" />
                  </div>
                  <AlertDialogFooter className="flex flex-col gap-4">
                    <AlertDialogAction disabled={deleteConfirmText.toUpperCase() !== "DELETE" || isDeleting} className="w-full h-16 rounded-2xl bg-red-500 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-red-100" onClick={handleDeleteAccount}>
                      {isDeleting ? <Loader2 className="animate-spin w-5 h-5" /> : "Delete Everything"}
                    </AlertDialogAction>
                    <AlertDialogCancel className="w-full h-16 rounded-2xl border-none bg-gray-50 text-gray-400 font-black uppercase tracking-widest text-sm">Cancel</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="pt-10 text-center space-y-2 opacity-30">
           <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400">Qivo Native v1.2.6</p>
           <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">Nairobi, Kenya</p>
        </div>
      </main>
    </div>
  )
}
