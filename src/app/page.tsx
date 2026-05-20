"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Root Redirector with Cinematic Splash Screen.
 * Always leads to /welcome to stop auto-login behavior.
 */
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    // Minimum display time for the splash screen vibe (2 seconds)
    // Then always redirect to /welcome to allow for a manual "Enter" action.
    const timer = setTimeout(() => {
      router.replace("/welcome")
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [router])

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
