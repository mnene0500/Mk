"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { ref, set as rtdbSet, push } from "firebase/database"
import { useFirestore, useUser, useDatabase } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Heart, Loader2, ChevronRight, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

const AFRICAN_COUNTRIES = [
  "Kenya", "Tanzania", "Uganda", "Rwanda", "Burundi", "South Sudan", "Ethiopia", "Somalia", "Eritrea", "Djibouti", "South Africa", "Nigeria", "Ghana", "Egypt"
]

const LOOKING_FOR_OPTIONS = [
  "Serious partner", "Casual friendship", "Networking", "Dating", "Travel buddy"
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [gender, setGender] = useState("")
  const [dob, setDob] = useState("")
  const [country, setCountry] = useState("")
  const [lookingFor, setLookingFor] = useState("")
  const [loading, setLoading] = useState(false)
  
  const { user } = useUser()
  const db = useFirestore()
  const rtdb = useDatabase()
  const router = useRouter()
  const { toast } = useToast()

  const totalSteps = 3

  useEffect(() => {
    if (user?.displayName && !name) {
      setName(user.displayName)
    }
  }, [user, name])

  const maxDate = useMemo(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    return d.toISOString().split('T')[0]
  }, [])

  const generateQivoId = () => {
    const min = 1000000; 
    const max = 999999999; 
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  const handleComplete = async () => {
    if (!user || !db || !rtdb) return
    setLoading(true)

    try {
      const userRef = doc(db, "users", user.uid)
      const userSnap = await getDoc(userRef)
      const existingData = userSnap.data()

      const qId = existingData?.matchFlowId || generateQivoId()
      
      // Bonus: Boys get coins to chat, Girls get diamonds (initial earnings)
      const initialCoins = gender === 'male' ? 150 : 0
      const initialDiamonds = gender === 'female' ? 150 : 0
      const timestamp = Date.now()

      const profilePhoto = user.photoURL || `https://picsum.photos/seed/${user.uid}/400/400`

      const updateData: any = {
        uid: user.uid,
        email: user.email || `anon_${user.uid}@qivo.app`,
        name: name,
        gender,
        dob: dob,
        country,
        lookingFor: lookingFor,
        onboardingComplete: true, // CRITICAL FLAG
        photoURL: profilePhoto,
        updatedAt: serverTimestamp(),
        createdAt: existingData?.createdAt || serverTimestamp(),
        matchFlowId: qId,
        isDeleted: false,
        isVerified: false,
        isAdmin: existingData?.isAdmin || false,
        isCoinSeller: existingData?.isCoinSeller || false,
        isAgent: existingData?.isAgent || false,
        blocking: existingData?.blocking || [],
        blockedBy: existingData?.blockedBy || []
      }

      // 1. Solidify Firestore Profile
      await setDoc(userRef, updateData, { merge: true })
      
      // 2. Initialize Realtime Wallet (only if not existing)
      const balanceRef = ref(rtdb, `balances/${user.uid}`)
      await rtdbSet(balanceRef, {
        coins: initialCoins,
        diamonds: initialDiamonds,
        updatedAt: timestamp,
        isVerified: false
      })

      // 3. Log Bonus
      if (initialCoins > 0) {
        await push(ref(rtdb, `coin_history/${user.uid}`), {
          amount: initialCoins,
          type: 'bonus',
          description: 'Welcome Bonus',
          timestamp: timestamp
        })
      }

      toast({ title: "Setup Complete!" })
      
      // FORCE A SMALL DELAY to let Firebase listeners catch up across the app
      setTimeout(() => {
        router.replace("/home")
      }, 800)
      
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup Failed", description: err.message })
      setLoading(false)
    }
  }

  const canContinue = () => {
    if (step === 1) return !!name && !!gender
    if (step === 2) return !!dob && !!country
    if (step === 3) return !!lookingFor
    return false
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50 to-white -z-10" />
      
      <header className="px-6 pt-12 pb-4 flex flex-col items-center">
        <div className="w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-6">
          <Heart className="w-8 h-8 text-[#00A2FF] fill-current" />
        </div>
        
        <div className="flex gap-1.5 mb-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                step === i + 1 ? "w-8 bg-[#00A2FF]" : "w-1.5 bg-gray-200"
              )} 
            />
          ))}
        </div>
        
        <h1 className="text-2xl font-black text-black tracking-tight mt-4 text-center">
          {step === 1 && "Basic Info"}
          {step === 2 && "Where are you?"}
          {step === 3 && "Preferences"}
        </h1>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
          Step {step} of {totalSteps}
        </p>
      </header>

      <main className="flex-1 px-8 pt-8 pb-20 max-w-md mx-auto w-full space-y-8">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Full Name</Label>
              <Input 
                placeholder="Enter your name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="rounded-2xl h-14 border-gray-100 bg-gray-50 focus:bg-white text-lg font-bold"
              />
              {user?.displayName && (
                <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest ml-1">Imported from Google</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Gender</Label>
              <div className="grid grid-cols-2 gap-4">
                {['male', 'female'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={cn(
                      "h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all",
                      gender === g 
                        ? "border-[#00A2FF] bg-blue-50 text-[#00A2FF] shadow-sm" 
                        : "border-gray-50 bg-gray-50 text-gray-600"
                    )}
                  >
                    <span className="text-2xl">{g === 'male' ? '♂️' : '♀️'}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{g}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Date of Birth</Label>
              <Input 
                type="date" 
                max={maxDate}
                value={dob} 
                onChange={(e) => setDob(e.target.value)} 
                className="rounded-2xl h-14 border-gray-100 bg-gray-50 focus:bg-white text-lg font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Country</Label>
              <Select onValueChange={setCountry} value={country}>
                <SelectTrigger className="rounded-2xl h-14 border-gray-100 bg-gray-50 text-lg font-bold">
                  <SelectValue placeholder="Select Country" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl h-64">
                  {AFRICAN_COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Looking For</Label>
              <div className="grid grid-cols-1 gap-3">
                {LOOKING_FOR_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setLookingFor(opt)}
                    className={cn(
                      "h-16 px-6 rounded-2xl border-2 flex items-center justify-between transition-all",
                      lookingFor === opt 
                        ? "border-[#00A2FF] bg-blue-50 text-[#00A2FF] shadow-sm" 
                        : "border-gray-50 bg-gray-50 text-gray-600"
                    )}
                  >
                    <span className="font-bold text-sm">{opt}</span>
                    {lookingFor === opt && <Heart className="w-4 h-4 fill-current" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 p-8 bg-white/80 backdrop-blur-xl border-t border-gray-50 flex gap-4 max-w-md mx-auto w-full">
        {step > 1 && (
          <Button 
            variant="ghost" 
            onClick={() => setStep(prev => prev - 1)}
            className="w-16 h-16 rounded-2xl bg-gray-50 text-gray-400"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}
        <Button 
          disabled={!canContinue() || loading}
          onClick={() => {
            if (step < totalSteps) setStep(prev => prev + 1)
            else handleComplete()
          }}
          className="flex-1 h-16 rounded-2xl bg-[#00A2FF] hover:bg-[#0081CC] text-white font-black uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Saving Profile...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {step === totalSteps ? "Finish Setup" : "Continue"}
              {step !== totalSteps && <ChevronRight className="w-5 h-5" />}
            </div>
          )}
        </Button>
      </footer>
    </div>
  )
}
