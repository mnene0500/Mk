"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/firebase"

/**
 * Root Redirector with Cinematic Splash Screen.
 * Optimized for speed and features a safety fallback to prevent "Forever Loading".
 */
export default function RootPage() {
  const router = useRouter()
  const { user, loading: authLoading, isInitialized } = useUser()
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  useEffect(() => {
    // 1. Mandatory Branding Delay (600ms)
    const brandingTimer = setTimeout(() => setMinTimeElapsed(true), 600)
    
    // 2. Safety Fallback: If auth takes > 3.5s, force go to Welcome
    // This prevents the app from hanging if Firebase Auth initialization is slow
    const safetyTimer = setTimeout(() => {
      if (!isInitialized || authLoading) {
        console.warn("[QIVO] Auth init taking too long. Using fallback redirect.");
        router.replace("/welcome")
      }
    }, 3500)

    return () => {
      clearTimeout(brandingTimer)
      clearTimeout(safetyTimer)
    }
  }, [isInitialized, authLoading, router])

  useEffect(() => {
    // Only proceed if branding time (600ms) has passed AND auth listener has fired
    if (!minTimeElapsed || !isInitialized || authLoading) return

    if (user) {
      // FAST REDIRECT: Go to Home immediately. 
      // The Home page will handle redirecting to /onboarding if the profile is incomplete.
      router.replace("/home")
    } else {
      // No active session, send to Welcome/Intro
      router.replace("/welcome")
    }
  }, [user, isInitialized, authLoading, router, minTimeElapsed])

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#00A2FF]/20 rounded-full blur-[100px] animate-pulse-slow" />
      
      <div className="relative z-10 flex flex-col items-center gap-6">
        <h1 className="text-7xl font-logo text-white tracking-tight drop-shadow-2xl animate-in fade-in zoom-in-95 duration-700">
          QIVO
        </h1>
      </div>

      {/* Subtle loader at the bottom */}
      <div className="absolute bottom-16 inset-x-0 flex justify-center">
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 bg-[#00A2FF]/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1.5 h-1.5 bg-[#00A2FF]/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1.5 h-1.5 bg-[#00A2FF]/40 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  )
}
