"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser, useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

/**
 * Root Redirector with Cinematic Splash Screen.
 * Checks auth status and redirects automatically if a session exists.
 * Optimized for fast transitions.
 */
export default function RootPage() {
  const router = useRouter()
  const { user, loading: authLoading, isInitialized } = useUser()
  const db = useFirestore()
  const { data: profile, loading: profileLoading } = useDoc<any>(user?.uid && db ? doc(db, "users", user.uid) : null)
  
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  // Ensure splash is visible for branding, but not for too long
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Only proceed if minimum splash time (1s) has passed AND auth listener has fired
    if (!minTimeElapsed || !isInitialized || authLoading) return

    if (user) {
      // If user is logged in, we must wait for the profile to know where to send them
      if (profileLoading) return 

      if (profile) {
        if (profile.onboardingComplete) {
          router.replace("/home")
        } else {
          // Send to correct onboarding flow
          router.replace(user.isAnonymous ? "/fastonboard" : "/onboarding")
        }
      } else {
        // User exists in Auth but no Firestore record yet
        router.replace("/onboarding")
      }
    } else {
      // No active session, send to Welcome/Intro
      router.replace("/welcome")
    }
  }, [user, isInitialized, authLoading, profile, profileLoading, router, minTimeElapsed])

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#00A2FF]/20 rounded-full blur-[100px] animate-pulse-slow" />
      
      <div className="relative z-10 flex flex-col items-center gap-6">
        <h1 className="text-7xl font-logo text-white tracking-tight drop-shadow-2xl animate-in fade-in zoom-in-95 duration-1000">
          QIVO
        </h1>
      </div>

      {/* Subtle loader at the bottom */}
      <div className="absolute bottom-16 inset-x-0 flex justify-center">
        <div className="flex gap-1.5">
          <div className="w-1 h-1 bg-[#00A2FF] rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1 h-1 bg-[#00A2FF] rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1 h-1 bg-[#00A2FF] rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  )
}
