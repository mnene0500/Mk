
"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, Mail, Loader2, ShieldCheck, RefreshCw } from "lucide-react"

/**
 * @fileOverview Unified Auth page for Email, OTP Verification, and Google Login.
 * Features a secure code entry flow before onboarding.
 */
export default function UnifiedAuthPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [view, setView] = useState<'login' | 'register' | 'verify'>('login')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const passwordStrength = useMemo(() => {
    if (!password) return 0
    let strength = 0
    if (password.length >= 8) strength += 1
    if (/[a-z]/.test(password)) strength += 1
    if (/[A-Z]/.test(password)) strength += 1
    if (/[0-9]/.test(password)) strength += 1
    if (/[^A-Za-z0-9]/.test(password)) strength += 1
    return (strength / 5) * 100
  }, [password])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push("/home")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Login failed", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setSocialLoading(true)
    try {
      const redirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/home` 
        : 'https://qivo-gamma.vercel.app/home';

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      })
      if (error) throw error
    } catch (error: any) {
      toast({ variant: "destructive", title: "Sign-In Error", description: error.message })
      setSocialLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    if (passwordStrength < 40) {
      toast({ variant: "destructive", title: "Weak Password", description: "Please use a stronger password." })
      return
    }

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError
      
      if (data.user) {
        toast({ title: "Code Sent", description: "Please check your email for the verification code." })
        setView('verify')
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration failed", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode || otpCode.length < 6) return
    
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup'
      })
      
      if (error) throw error
      
      toast({ title: "Email Verified", description: "Welcome to QIVO!" })
      router.push("/fastonboard")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Verification failed", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })
      if (error) throw error
      setResendCooldown(60)
      toast({ title: "New Code Sent", description: "Check your inbox again." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Resend failed", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 space-y-10 bg-white min-h-screen select-none relative">
      <header className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => view === 'verify' ? setView('register') : router.push("/")} 
          className="rounded-full"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h2 className="text-xl font-bold text-[#00A2FF] flex-1 text-center pr-10 uppercase tracking-tighter">QIVO Access</h2>
      </header>

      <div className="flex-1 flex flex-col justify-center space-y-8 max-w-sm mx-auto w-full">
        {view === 'verify' ? (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto">
                <ShieldCheck className="w-10 h-10 text-[#00A2FF]" />
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-black text-black tracking-tight">Verify Email</h1>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Enter the 6-digit code sent to {email}</p>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Verification Code</Label>
                <Input 
                  type="text" 
                  maxLength={6}
                  placeholder="000000" 
                  value={otpCode} 
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} 
                  className="rounded-2xl h-16 text-center text-3xl font-black tracking-[0.5em] border-gray-100 bg-gray-50 text-black" 
                />
              </div>

              <div className="space-y-4">
                <Button type="submit" disabled={loading || otpCode.length < 6} className="w-full rounded-full h-16 text-base font-bold bg-[#00A2FF] hover:bg-[#0081CC] shadow-xl shadow-blue-100">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Continue"}
                </Button>

                <Button 
                  type="button" 
                  variant="ghost" 
                  disabled={loading || resendCooldown > 0} 
                  onClick={handleResendCode}
                  className="w-full h-10 text-[10px] font-black text-[#00A2FF] uppercase tracking-widest hover:bg-transparent"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-black text-black tracking-tight">
                {view === 'login' ? 'Welcome' : 'Join QIVO'}
              </h1>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                {view === 'login' ? 'Sign in to your account' : 'Start your journey today'}
              </p>
            </div>

            <div className="space-y-4">
              <Button 
                disabled={socialLoading}
                onClick={handleGoogleLogin}
                variant="outline"
                className="w-full rounded-full h-14 text-base font-bold border-2 border-gray-100 text-black hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                {socialLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink mx-4 text-[10px] font-black text-gray-300 uppercase">Or use Email</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>
            </div>

            <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[10px] font-black uppercase text-gray-400 ml-1">Email Address</Label>
                  <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold text-sm text-black" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase text-gray-400 ml-1">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold text-sm text-black" />
                </div>
                {view === 'register' && (
                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#00A2FF] transition-all" style={{ width: `${passwordStrength}%` }} />
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4">
                <Button type="submit" disabled={loading || socialLoading} className="w-full rounded-full h-14 text-base font-bold bg-[#00A2FF] hover:bg-[#0081CC] shadow-xl shadow-blue-100 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>{view === 'login' ? <Mail className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />} {view === 'login' ? 'Login' : 'Register'}</>
                  )}
                </Button>

                <Button type="button" variant="ghost" disabled={loading || socialLoading} onClick={() => setView(view === 'login' ? 'register' : 'login')} className="w-full h-10 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-transparent">
                  {view === 'login' ? "Don't have an account? Create one" : "Already have an account? Login"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
