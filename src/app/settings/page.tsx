"use client"

import { useState } from "react"
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase"
import { useMemoFirebase } from "@/firebase/utils-client"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { deleteUser, signOut } from "firebase/auth"
import { doc, deleteDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, ShieldAlert, Link as LinkIcon, Info, RefreshCw, CreditCard, Ban, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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

interface UserProfile {
  isAdmin?: boolean
}

interface SettingItemProps {
  label: string
  onClick?: () => void
  href?: string
  icon?: React.ReactNode
}

function SettingItem({ label, onClick, href, icon }: SettingItemProps) {
  const content = (
    <div className="flex items-center justify-between py-5 px-6 border-b border-gray-50 active:bg-gray-50 transition-colors cursor-pointer bg-white">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-50">
          {icon}
        </div>
        <span className="text-[15px] font-bold text-black">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300" />
    </div>
  )

  if (href) return <Link href={href}>{content}</Link>
  return <div onClick={onClick}>{content}</div>
}

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser()
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  const profileRef = useMemoFirebase(() => (user?.uid && db) ? doc(db, "users", user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc<UserProfile>(profileRef)

  const handleSignOut = async () => {
    if (!auth) return
    try {
      await signOut(auth)
      window.location.replace("/welcome")
    } catch (error) {
      console.error(error)
    }
  }

  const handleClearCache = async () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const r of regs) await r.unregister()
      }
      toast({ title: "App Reset", description: "Reloading..." })
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== "DELETE") return

    try {
      const uid = user.uid
      const userRef = doc(db!, "users", uid)
      
      await deleteDoc(userRef).catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRef.path,
          operation: 'delete',
        }))
      })

      await deleteUser(user)
      window.location.replace("/welcome")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: error.code === 'auth/requires-recent-login' 
          ? "Please sign out and sign back in before deleting your account." 
          : error.message,
      })
    }
  }

  const settingsList = [
    { label: "Charge settings", href: "/recharge", icon: <CreditCard className="w-4 h-4 text-blue-500" /> },
    { label: "Blocked List", href: "/blocked-list", icon: <Ban className="w-4 h-4 text-red-400" /> },
    { label: "About QIVO", href: "/about", icon: <Info className="w-4 h-4 text-gray-500" /> },
    { label: "Clear Cache", onClick: handleClearCache, icon: <RefreshCw className="w-4 h-4 text-orange-500" /> },
  ]

  return (
    <div className="flex-1 bg-[#F9FAFB] flex flex-col min-h-screen select-none">
      <header className="flex items-center justify-between px-4 h-16 bg-white sticky top-0 z-50 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Settings</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1">
        <div className="flex flex-col mt-4">
          {user?.isAnonymous && (
            <SettingItem label="Secure Account" href="/bind-account" icon={<LinkIcon className="w-4 h-4 text-[#00A2FF]" />} />
          )}
          
          {settingsList.map((item, idx) => (
            <SettingItem key={idx} {...item} />
          ))}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div className="flex items-center justify-between py-5 px-6 border-b border-gray-50 active:bg-gray-50 transition-colors cursor-pointer bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-50">
                    <LogOut className="w-4 h-4 text-gray-400" />
                  </div>
                  <span className="text-[15px] font-bold text-black">Sign Out</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[2.5rem] max-w-[85vw] p-8 border-none select-none">
              <AlertDialogHeader className="items-center text-center">
                <AlertDialogTitle className="text-xl font-bold">Sign Out?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs font-bold uppercase tracking-widest">
                  Are you sure you want to end your session?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-3 mt-6">
                <AlertDialogCancel className="flex-1 h-14 rounded-full border-none bg-gray-50 font-bold uppercase tracking-widest text-[10px]">No</AlertDialogCancel>
                <AlertDialogAction onClick={handleSignOut} className="flex-1 h-14 rounded-full bg-black text-white font-bold uppercase tracking-widest text-[10px]">Yes, Logout</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>

      <footer className="pb-10 pt-20 px-6">
        <div className="flex items-center justify-center gap-4 text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
          <Link href="/privacy">Privacy</Link>
          <span className="opacity-20">•</span>
          <Link href="/terms">Terms</Link>
          {!profile?.isAdmin && (
            <>
              <span className="opacity-20">•</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="hover:text-red-500 transition-colors">Delete Account</button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2.5rem] max-w-[85vw] p-8 border-none select-none">
                  <AlertDialogHeader className="items-center text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
                      <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <AlertDialogTitle className="text-xl font-bold">Delete Account?</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs font-bold pt-2 uppercase tracking-widest leading-relaxed">
                      To confirm, please type <span className="text-red-600 font-black">DELETE</span> below:
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  <div className="py-4">
                    <Input 
                      placeholder="Type DELETE" 
                      value={deleteConfirmText} 
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="rounded-2xl h-14 border-red-100 bg-red-50/30 text-center font-black uppercase tracking-widest"
                    />
                  </div>

                  <AlertDialogFooter className="flex-row gap-3 mt-4">
                    <AlertDialogCancel className="flex-1 h-14 rounded-full border-none bg-gray-50 font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      disabled={deleteConfirmText !== "DELETE"}
                      className="flex-1 h-14 rounded-full bg-red-500 hover:bg-red-600 font-bold uppercase tracking-widest text-[10px] disabled:opacity-30"
                      onClick={handleDeleteAccount}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}
