"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Camera, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Sparkles, UserX } from "lucide-react"
import { verifyIdentity } from "@/ai/flows/verify-identity-flow"
import { useToast } from "@/hooks/use-toast"
import { checkIdentityDuplicateAction } from "@/app/actions/matchflow-actions"
import Image from "next/image"
import imageCompression from "browser-image-compression"

export default function VerifyIdentityPage() {
  const router = useRouter()
  const { user, loading: authLoading, isInitialized } = useUser()
  const { toast } = useToast()
  
  const [step, setStep] = useState<'instructions' | 'capture' | 'analyzing' | 'result'>('instructions')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user?.id) return
    supabase.from('users').select('*').eq('uid', user.id).single().then(({ data }) => {
      setProfile(data)
      setProfileLoading(false)
    })
  }, [user?.id])

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true }
        const compressedFile = await imageCompression(file, options)
        const reader = new FileReader()
        reader.onloadend = () => { setCapturedImage(reader.result as string); setStep('capture'); }
        reader.readAsDataURL(compressedFile)
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "Failed to process image." })
      }
    }
  }

  const runVerification = async () => {
    if (!capturedImage || !profile?.photo_url || !user?.id) return
    setLoading(true)
    setStep('analyzing')
    
    try {
      // Step 1: Check for unique identity lock
      const dupRes = await checkIdentityDuplicateAction(user.id);
      if (!dupRes.success) {
        setDuplicateId(dupRes.matchFlowId);
        setIsSuccess(false);
        setStep('result');
        return;
      }

      // Step 2: Run AI Verification
      const result = await verifyIdentity({ profilePhotoUrl: profile.photo_url, selfieDataUri: capturedImage })
      if (result.isMatch && result.confidence >= 0.7) {
        await supabase.from('users').update({ is_verified: true, updated_at: new Date().toISOString() }).eq('uid', user.id)
        setIsSuccess(true)
      } else {
        setIsSuccess(false)
      }
      setStep('result')
    } catch (error) {
      toast({ variant: "destructive", title: "Verification Error", description: "Analysis failed. Please try again with better lighting." })
      setStep('instructions')
    } finally {
      setLoading(false)
    }
  }

  const isPageLoading = authLoading || !isInitialized || profileLoading

  if (isPageLoading) return <div className="flex-1 bg-white min-h-screen flex flex-col items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#00A2FF]" /></div>
  if (!user) { router.replace("/welcome"); return null; }

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ChevronLeft className="w-6 h-6 text-black" /></Button>
        <h1 className="text-sm font-bold text-black uppercase tracking-widest">Verify Identity</h1>
        <div className="w-10" />
      </header>
      <main className="flex-1 flex flex-col p-8">
        {profile?.is_verified ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-10 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-50 rounded-[2.5rem] flex items-center justify-center text-green-500"><CheckCircle2 className="w-16 h-16" /></div>
            <div className="text-center space-y-3"><h2 className="text-2xl font-bold text-black tracking-tight">Verified!</h2><p className="text-sm font-medium text-gray-500 px-8 leading-relaxed">Your identity has been confirmed. You now have the verified badge on your profile.</p></div>
            <Button className="w-full h-16 rounded-full bg-[#00A2FF] text-white font-bold uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all mt-auto" onClick={() => router.push('/profile')}>Back to Profile</Button>
          </div>
        ) : (
          <>
            {step === 'instructions' && (
              <div className="flex-1 flex flex-col space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col items-center text-center space-y-6 pt-10">
                  <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center"><ShieldCheck className="w-12 h-12 text-[#00A2FF]" /></div>
                  <div className="space-y-2"><h2 className="text-2xl font-bold text-black tracking-tight">AI Verification</h2><p className="text-sm font-medium text-gray-400 px-4">Instant identity check to ensure community trust.</p></div>
                </div>
                <div className="space-y-4">{[{ title: "Good Lighting", desc: "Face must be clearly visible.", icon: Sparkles }, { title: "Face Centered", desc: "Hold your phone at eye level.", icon: Camera }, { title: "Unique Profile", desc: "One identity per person policy.", icon: ShieldCheck }].map((item, i) => (<div key={i} className="flex gap-4 items-center bg-gray-50 p-5 rounded-3xl border border-gray-100/50"><div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm"><item.icon className="w-5 h-5 text-[#00A2FF]" /></div><div><p className="text-xs font-bold text-black uppercase tracking-tight">{item.title}</p><p className="text-[10px] font-bold text-gray-400 mt-0.5">{item.desc}</p></div></div>))}</div>
                <Button className="w-full h-16 rounded-full bg-[#00A2FF] text-white font-bold uppercase tracking-widest text-sm shadow-xl mt-auto active:scale-95 transition-all" onClick={() => fileInputRef.current?.click()}>Start Verification</Button>
                <input type="file" accept="image/*" capture="user" className="hidden" ref={fileInputRef} onChange={handleCapture} />
              </div>
            )}
            {step === 'capture' && capturedImage && (
              <div className="flex-1 flex flex-col space-y-8 animate-in zoom-in-95 duration-300">
                <h2 className="text-sm font-bold text-gray-400 text-center uppercase tracking-widest pt-4">Review Photo</h2>
                <div className="relative aspect-[3/4] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white bg-gray-100">
                  <Image src={capturedImage} alt="Selfie" fill className="object-cover" sizes="(max-width: 768px) 100vw, 400px" />
                </div>
                <div className="flex flex-col gap-4 mt-auto">
                  <Button className="w-full h-16 rounded-full bg-[#00A2FF] text-white font-bold uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all" onClick={runVerification} disabled={loading}>Submit for Analysis</Button>
                  <Button variant="ghost" className="font-bold text-gray-400 uppercase text-[10px] tracking-widest hover:bg-transparent" onClick={() => fileInputRef.current?.click()}>Retake Photo</Button>
                </div>
              </div>
            )}
            {step === 'analyzing' && <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500"><div className="relative"><div className="w-32 h-32 border-4 border-[#00A2FF]/10 rounded-full animate-spin border-t-[#00A2FF]" /><div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-10 h-10 text-[#00A2FF] animate-spin" /></div></div><div className="text-center space-y-2"><h3 className="text-xl font-bold text-black tracking-tight">AI Analyzing...</h3><p className="text-sm font-medium text-gray-400">Verifying features and uniqueness</p></div></div>}
            {step === 'result' && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-10 animate-in zoom-in-95 duration-500">
                {isSuccess ? (<><div className="w-24 h-24 bg-green-50 rounded-[2.5rem] flex items-center justify-center text-green-500"><CheckCircle2 className="w-16 h-16" /></div><div className="text-center space-y-3"><h2 className="text-2xl font-bold text-black tracking-tight">Verified!</h2><p className="text-sm font-medium text-gray-500 px-8 leading-relaxed">Your identity has been confirmed. You now have the verified badge on your profile.</p></div><Button className="w-full h-16 rounded-full bg-[#00A2FF] text-white font-bold uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all mt-auto" onClick={() => router.push('/profile')}>Back to Profile</Button></>) : (
                  duplicateId ? (
                    <><div className="w-24 h-24 bg-red-50 rounded-[2.5rem] flex items-center justify-center text-red-500"><UserX className="w-16 h-16" /></div><div className="text-center space-y-3"><h2 className="text-2xl font-bold text-black tracking-tight">Security Alert</h2><p className="text-sm font-medium text-gray-500 px-8 leading-relaxed">This identity is already verified in another account with ID <span className="font-black text-black">#{duplicateId}</span>. Please delete that account first to verify this one.</p></div><Button className="w-full h-16 rounded-full bg-[#00A2FF] text-white font-bold uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all mt-auto" onClick={() => router.push('/profile')}>Back to Profile</Button></>
                  ) : (
                    <><div className="w-24 h-24 bg-red-50 rounded-[2.5rem] flex items-center justify-center text-red-500"><AlertCircle className="w-16 h-16" /></div><div className="text-center space-y-3"><h2 className="text-2xl font-bold text-black tracking-tight">Verification Failed</h2><p className="text-sm font-medium text-gray-500 px-8 leading-relaxed">The AI couldn't confirm a match. Please ensure your lighting is good and your profile photo is clear.</p></div><Button className="w-full h-16 rounded-full bg-[#00A2FF] text-white font-bold uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all mt-auto" onClick={() => setStep('instructions')}>Try Again</Button></>
                  )
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
