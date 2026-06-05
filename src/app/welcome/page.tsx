
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mail, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

/**
 * @fileOverview Cinematic Welcome Page v2.1.
 * Refined branding and restored video background.
 */
export default function WelcomePage() {
  const [loading, setLoading] = useState(false)
  const { user, loading: authLoading, isInitialized } = useUser()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (isInitialized && !authLoading && user) router.replace("/")
  }, [user, isInitialized, authLoading, router])

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      })
      if (error) throw error
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
      setLoading(false)
    }
  }

  if (!isInitialized || user) return <div className="fixed inset-0 bg-white" />

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* RESTORED VIDEO BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-full object-cover opacity-60 grayscale-[20%]"
        >
          <source src="https://assets.mixkit.co/videos/preview/mixkit-people-dancing-at-a-party-with-strobe-lights-4008-large.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="relative z-20 h-full flex flex-col px-8 pt-24 pb-16 justify-between items-center text-center">
        <div className="space-y-4 pt-20">
          {/* REDUCED FONT SIZE */}
          <h1 className="text-6xl font-logo font-black text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] tracking-tight">QIVO</h1>
          <div className="flex items-center justify-center gap-3">
             <div className="h-[1px] w-6 bg-white/20" />
             <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
             <div className="h-[1px] w-6 bg-white/20" />
          </div>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <Button 
              disabled={loading}
              onClick={() => router.push("/auth")}
              className="w-full h-20 rounded-[2.5rem] bg-white text-black hover:bg-white/90 font-black text-xs tracking-[0.2em] uppercase shadow-[0_20px_50px_rgba(255,255,255,0.1)] active:scale-95 transition-all"
            >
              <Mail className="w-5 h-5 mr-3 text-blue-500" /> Continue with Email
            </Button>

            <Button 
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full h-20 rounded-[2.5rem] bg-white/10 backdrop-blur-2xl border border-white/20 text-white hover:bg-white/20 font-black text-xs tracking-[0.2em] uppercase active:scale-95 transition-all"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>
          </div>

          <div className="pt-6">
            <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] leading-relaxed max-w-[280px] mx-auto">
              18+ Only. By entering, you agree to our <Link href="/terms" className="text-white/60 underline">Terms</Link> & <Link href="/privacy" className="text-white/60 underline">Privacy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
