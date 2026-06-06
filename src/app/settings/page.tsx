
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert, 
  Info, 
  CreditCard, 
  LogOut, 
  Trash2, 
  Loader2, 
  ShieldCheck, 
  Moon, 
  Link as LinkIcon, 
  User, 
  Eye, 
  Coins, 
  CheckCircle2,
  ShieldX
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { deleteUserCompletelyAction, activateReadReceiptsAction } from "@/app/actions/matchflow-actions"
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
      "flex items-center justify-between py-4 px-5 active:bg-gray-50 transition-colors cursor-pointer bg-white group",
      !hideBorder && "border-b border-gray-50"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center group-active:scale-90 transition-transform",
          variant === 'destructive' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-black'
        )}>
          {icon}
        </div>
        <span className={cn(
          "text-sm font-black tracking-tight",
          variant === 'destructive' ? 'text-red-500' : 'text-slate-900'
        )}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
         {children}
         {!children && (
           <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
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

      <main className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar pb-40">
        <div className="space-y-3">
          <h2 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Communication</h2>
          <div className="bg-white rounded-[1.5rem] overflow-hidden border border-gray-100 shadow-sm">
            <SettingItem label="Do Not Disturb" icon={<Moon className="w-4 h-4" />}>
              <Switch checked={isDnd} onCheckedChange={toggleDnd} className="scale-75" />
            </SettingItem>
            {profile && !profile.has_read_receipts ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div className="flex items-center justify-between py-4 px-5 active:bg-gray-50 transition-colors cursor-pointer bg-white group hideBorder">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-500">
                        <Eye className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black tracking-tight text-slate-900">Read Receipts</span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-[#00A2FF] text-white text-[7px] font-black uppercase rounded-full">Unlock</span>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2.5rem] p-8 border-none shadow-2xl w-[85vw] max-w-sm">
                  <AlertDialogHeader className="items-center text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                      <Eye className="w-8 h-8 text-[#00A2FF]" />
                    </div>
                    <AlertDialogTitle className="text-xl font-black tracking-tight uppercase">Sent & Seen</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs font-medium text-gray-400 pt-1">Enable real-time message status updates. Pay once and see when your messages are read.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-col gap-3 mt-6">
                    <Button onClick={handleActivateReadReceipts} disabled={isActivating} className="w-full h-14 rounded-xl bg-[#00A2FF] text-white font-black uppercase text-xs">
                      {isActivating ? <Loader2 className="animate-spin" /> : <><Coins className="w-3.5 h-3.5 mr-2" /> Pay 200 Coins</>}
                    </Button>
                    <AlertDialogCancel className="w-full h-12 rounded-xl border-none bg-gray-50 text-gray-400 font-black uppercase text-[10px]">Maybe Later</AlertDialogCancel>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div className="flex items-center justify-between py-4 px-5 bg-white group hideBorder">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50 text-green-500">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-black tracking-tight text-slate-900">Read Receipts</span>
                </div>
                <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Active</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Privacy & Safety</h2>
          <div className="bg-white rounded-[1.5rem] overflow-hidden border border-gray-100 shadow-sm">
            <SettingItem label="Blocked List" href="/blocked-list" icon={<ShieldX className="w-4 h-4" />} hideBorder />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Account</h2>
          <div className="bg-white rounded-[1.5rem] overflow-hidden border border-gray-100 shadow-sm">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div className="flex items-center justify-between py-4 px-5 active:bg-gray-50 transition-colors cursor-pointer bg-white group border-b border-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 text-blue-500">
                      <LinkIcon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-black tracking-tight text-slate-900">Bind Account</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-300" />
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2.5rem] p-8 border-none shadow-2xl w-[85vw] max-w-sm">
                <AlertDialogHeader className="items-center text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4"><User className="w-8 h-8 text-[#00A2FF]" /></div>
                  <AlertDialogTitle className="text-xl font-black tracking-tight uppercase">Linked Account</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs font-medium text-gray-400 pt-1 space-y-3">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center">
                      <span className="text-[8px] font-black uppercase text-gray-400 mb-1">Authenticated via</span>
                      <span className="text-black font-black text-[11px] break-all">{user?.email}</span>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6"><AlertDialogCancel className="w-full h-12 rounded-xl border-none bg-gray-50 text-black font-black uppercase text-[10px]">Close</AlertDialogCancel></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <SettingItem label="Charge Settings" href="/pricing" icon={<CreditCard className="w-4 h-4" />} hideBorder />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">Information</h2>
          <div className="bg-white rounded-[1.5rem] overflow-hidden border border-gray-100 shadow-sm">
            <SettingItem label="About QIVO" href="/about" icon={<Info className="w-4 h-4" />} hideBorder />
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <div className="bg-white rounded-[1.5rem] overflow-hidden border border-gray-100 shadow-sm">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div className="flex items-center justify-between py-4 px-5 active:bg-gray-50 transition-colors cursor-pointer bg-white group border-b border-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 text-slate-500">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-black tracking-tight text-slate-900">Sign Out</span>
                  </div>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2.5rem] p-8 border-none shadow-2xl w-[85vw] max-w-sm">
                <AlertDialogHeader className="items-center text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4"><LogOut className="w-8 h-8 text-[#00A2FF]" /></div>
                  <AlertDialogTitle className="text-xl font-black tracking-tight uppercase">Sign Out?</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs font-medium text-gray-400 pt-1">You will need to re-authenticate to access your profile.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col gap-3 mt-6">
                  <AlertDialogAction onClick={handleSignOut} className="w-full h-14 rounded-xl bg-black text-white font-black uppercase text-xs">Yes, Sign Out</AlertDialogAction>
                  <AlertDialogCancel className="w-full h-12 rounded-xl border-none bg-gray-50 text-gray-400 font-black uppercase text-[10px]">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {!loading && !profile?.is_admin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div className="flex items-center justify-between py-4 px-5 active:bg-red-50/10 transition-colors cursor-pointer bg-white group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black tracking-tight text-red-500">Delete Account</span>
                    </div>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2.5rem] p-8 border-none shadow-2xl w-[85vw] max-w-sm">
                  <AlertDialogHeader className="items-center text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4"><ShieldAlert className="w-8 h-8 text-red-500" /></div>
                    <AlertDialogTitle className="text-xl font-black tracking-tight uppercase">Permanently Delete?</AlertDialogTitle>
                    <AlertDialogDescription className="text-[10px] font-black text-gray-400 pt-1 uppercase tracking-widest">Type <span className="text-red-600">DELETE</span> to confirm.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4"><Input placeholder="Type DELETE" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className="rounded-xl h-14 text-center font-black bg-gray-50 border-gray-100 text-lg uppercase" /></div>
                  <AlertDialogFooter className="flex flex-col gap-3">
                    <AlertDialogAction disabled={deleteConfirmText.toUpperCase() !== "DELETE" || isDeleting} className="w-full h-14 rounded-xl bg-red-500 text-white font-black uppercase text-xs" onClick={handleDeleteAccount}>{isDeleting ? <Loader2 className="animate-spin w-4 h-4" /> : "Delete Everything"}</AlertDialogAction>
                    <AlertDialogCancel className="w-full h-12 rounded-xl border-none bg-gray-50 text-gray-400 font-black uppercase text-[10px]">Cancel</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
