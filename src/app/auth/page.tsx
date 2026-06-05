
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, Mail, Loader2, ShieldCheck, Lock, AtSign, Eye, EyeOff } from "lucide-react"

/**
 * @fileOverview Unified Auth Page with Password Visibility and Manual Control.
 */
export default function UnifiedAuthPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [view, setView] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)
  
  const router = useRouter()
  const { toast } = useToast()

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
    if (!email || !password) {
      toast({ variant: "destructive", title: "Required", description: "Email and password are required." })
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      
      toast({ title: "Welcome Back!" })
      router.replace("/")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Login failed", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setSocialLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
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
        toast({ title: "Account Created", description: "Welcome! Let's set up your profile." })
        router.replace("/fastonboard")
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration failed", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 bg-white min-h-screen select-none overflow-y-auto no-scrollbar">
      <header className="flex items-center justify-between h-14 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-gray-50">
          <ChevronLeft className="w-5 h-5 text-black" />
        </Button>
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-blue-500 rounded-lg rotate-3" />
           <span className="font-logo text-xl text-[#00A2FF]">Qivo</span>
        </div>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full space-y-10">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-black tracking-tight">
            {view === 'login' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="text-sm text-gray-400 font-medium">
            {view === 'login' ? 'Connect with your community' : 'Join thousands of amazing people'}
          </p>
        </div>

        <div className="space-y-6">
          <Button 
            disabled={socialLoading}
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full rounded-2xl h-16 text-sm font-black border-2 border-gray-100 text-black hover:bg-gray-50 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm"
          >
            {socialLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Google
          </Button>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink mx-4 text-[10px] font-black text-gray-300 uppercase tracking-widest">Or Secure Email</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Email Address</Label>
                <div className="relative group">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#00A2FF] transition-colors" />
                  <Input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="rounded-2xl h-16 pl-12 border-gray-100 bg-gray-50 focus:bg-white text-sm font-bold transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-[#00A2FF] transition-colors" />
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="rounded-2xl h-16 pl-12 pr-12 border-gray-100 bg-gray-50 focus:bg-white text-sm font-bold transition-all" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {view === 'register' && (
                  <div className="w-full h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-[#00A2FF] transition-all duration-500" style={{ width: `${passwordStrength}%` }} />
                  </div>
                )}
              </div>
            </div>

            {/* MANUAL SUBMIT ONLY */}
            <Button 
              type="submit" 
              disabled={loading || socialLoading} 
              className="w-full rounded-2xl h-16 text-sm font-black bg-black text-white hover:bg-zinc-800 shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>{view === 'login' ? <Mail className="w-5 h-5 text-blue-400" /> : <ShieldCheck className="w-5 h-5 text-green-400" />} {view === 'login' ? 'Sign In' : 'Continue'}</>
              )}
            </Button>

            <Button 
              type="button" 
              variant="ghost" 
              disabled={loading || socialLoading} 
              onClick={() => setView(view === 'login' ? 'register' : 'login')} 
              className="w-full h-12 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:bg-transparent hover:text-black transition-colors"
            >
              {view === 'login' ? "New here? Create account" : "Have an account? Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
