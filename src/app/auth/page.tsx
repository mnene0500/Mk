"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { useAuth, useFirestore } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, Mail, UserPlus, Loader2, ShieldCheck, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"

export default function UnifiedAuthPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const auth = useAuth()
  const db = useFirestore()

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

  const strengthColor = useMemo(() => {
    if (passwordStrength < 40) return "bg-red-500"
    if (passwordStrength < 80) return "bg-yellow-500"
    return "bg-green-500"
  }, [passwordStrength])

  const strengthText = useMemo(() => {
    if (!password) return ""
    if (passwordStrength < 40) return "Weak"
    if (passwordStrength < 80) return "Fair"
    return "Strong"
  }, [passwordStrength, password])

  const generateQivoId = () => {
    return Math.floor(1000000 + Math.random() * 900000000).toString();
  }

  const handleAuthError = (error: any, type: 'Login' | 'Registration') => {
    console.error(`[${type} Error]:`, error.code, error.message);
    
    let description = error.message;
    if (error.code === 'auth/network-request-failed') {
      description = "Network error. Please ensure this domain is added to 'Authorized Domains' in Firebase Console Settings.";
    } else if (error.code === 'auth/operation-not-allowed') {
      description = "Email/Password sign-in is not enabled in your Firebase Console.";
    }

    toast({
      variant: "destructive",
      title: `${type} failed`,
      description: description,
    })
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      const userRef = doc(db, "users", user.uid)
      const userSnap = await getDoc(userRef)
      
      if (userSnap.exists() && userSnap.data().onboardingComplete) {
        router.push("/home")
      } else {
        router.push("/onboarding")
      }
    } catch (error: any) {
      handleAuthError(error, 'Login')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!email || !password) {
      toast({ variant: "destructive", title: "Error", description: "Email and password are required." })
      return
    }
    if (passwordStrength < 40) {
      toast({ variant: "destructive", title: "Weak Password", description: "Please use a stronger password." })
      return
    }

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      const userData = {
        uid: user.uid,
        email: user.email,
        matchFlowId: generateQivoId(), // Stored as matchFlowId for schema compatibility
        onboardingComplete: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await setDoc(doc(db, "users", user.uid), userData, { merge: true })
      router.push("/onboarding")
    } catch (error: any) {
      handleAuthError(error, 'Registration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 space-y-10 bg-white min-h-screen select-none">
      <header className="flex items-center">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h2 className="text-xl font-bold text-[#00A2FF] flex-1 text-center pr-10 uppercase tracking-tighter">QIVO Access</h2>
      </header>

      <div className="flex-1 flex flex-col justify-center space-y-8 max-w-sm mx-auto w-full">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-black tracking-tight">Welcome</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Login or Join QIVO</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-black uppercase text-gray-400 ml-1">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="your@email.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold text-sm text-black"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-black uppercase text-gray-400 ml-1">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold text-sm text-black"
              />
              {password && (
                <div className="px-1 pt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Strength: {strengthText}</span>
                    {passwordStrength >= 80 ? <ShieldCheck className="w-3 h-3 text-green-500" /> : <ShieldAlert className="w-3 h-3 text-red-400" />}
                  </div>
                  <Progress value={passwordStrength} className="h-1" indicatorClassName={strengthColor} />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full rounded-full h-14 text-base font-bold bg-[#00A2FF] hover:bg-[#0081CC] shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Mail className="w-5 h-5" /> Login</>}
            </Button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-100"></div>
              <span className="flex-shrink mx-4 text-[10px] font-black text-gray-300 uppercase">New User?</span>
              <div className="flex-grow border-t border-gray-100"></div>
            </div>

            <Button 
              type="button"
              variant="outline"
              disabled={loading} 
              onClick={handleRegister}
              className="w-full rounded-full h-14 text-base font-bold border-2 border-gray-100 text-black hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-5 h-5" /> Create Account</>}
            </Button>
          </div>
        </form>

        <p className="text-[10px] text-center text-gray-400 font-medium px-8 leading-relaxed">
          By continuing, you agree to QIVO's <Link href="/terms" className="underline font-bold text-gray-500">Terms</Link> and <Link href="/privacy" className="underline font-bold text-gray-500">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
