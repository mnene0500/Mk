
"use client"

import { useMemo, use, useState, useEffect, useRef } from "react"
import { supabase, base64ToBlob, uploadPostPhoto } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { 
  ChevronLeft, 
  MessageSquare, 
  MoreHorizontal, 
  BadgeCheck,
  Ban,
  Flag,
  X,
  GraduationCap,
  Heart,
  Globe,
  Copy,
  Check,
  LayoutGrid,
  Loader2,
  Quote,
  Sparkles,
  MapPin,
  Image as ImageIcon,
  Send
} from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useUserPresence } from "@/hooks/use-presence"
import { useUser } from "@/firebase/auth/use-user"
import { submitReportAction } from "@/app/actions/matchflow-actions"
import imageCompression from "browser-image-compression"

interface UserProfile {
  uid: string
  name: string
  photo_url: string
  additional_photos?: string[]
  country: string
  gender: string
  dob: string
  interests?: string
  match_flow_id?: string
  is_verified?: boolean
  blocking?: string[]
  education_level?: string
  looking_for?: string
}

const REPORT_REASONS = [
  "Inappropriate Behavior",
  "Fake Profile / Scammer",
  "Harassment",
  "Explicit Content",
  "Underage User",
  "Other"
]

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const router = useRouter()
  const { user: currentUser } = useUser()
  const { toast } = useToast()
  const presence = useUserPresence(userId)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPhotoOpen, setIsPhotoOpen] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // REPORT STATE
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [reportText, setReportDescription] = useState("")
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [submittingReport, setSubmittingReport] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!currentUser?.id) return
    Promise.all([
      supabase.from('users').select('*').eq('uid', userId).single(),
      supabase.from('users').select('blocking, blocked_by').eq('uid', currentUser.id).single()
    ]).then(([{ data: target }, { data: me }]) => {
      if (target) setProfile(target)
      if (me) setMyProfile(me)
      setLoading(false)
    })
  }, [userId, currentUser?.id])

  const calculateAge = (dob: string) => {
    if (!dob) return "21"
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
    return age
  }

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (profile?.match_flow_id) {
      navigator.clipboard.writeText(profile.match_flow_id)
      setCopied(true)
      toast({ title: "ID Copied" })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleBlock = async () => {
    if (!currentUser || !profile) return
    const { data: myData } = await supabase.from('users').select('blocking').eq('uid', currentUser.id).single()
    const myBlocking = Array.from(new Set([...(myData?.blocking || []), profile.uid]))
    await supabase.from('users').update({ blocking: myBlocking }).eq('uid', currentUser.id)
    
    const { data: targetData } = await supabase.from('users').select('blocked_by').eq('uid', profile.uid).single()
    const targetBlockedBy = Array.from(new Set([...(targetData?.blocked_by || []), currentUser.id]))
    await supabase.from('users').update({ blocked_by: targetBlockedBy }).eq('uid', profile.uid)
    
    toast({ title: "User Blocked" })
    router.push("/home")
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const options = { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true }
        const compressed = await imageCompression(file, options)
        const reader = new FileReader()
        reader.onloadend = () => setProofImage(reader.result as string)
        reader.readAsDataURL(compressed)
      } catch (err) {
        toast({ variant: "destructive", title: "Error selecting image" })
      }
    }
  }

  const handleSubmitReport = async () => {
    if (!currentUser || !profile || !reportReason || !reportText) return
    setSubmittingReport(true)
    try {
      let proofUrl = ""
      if (proofImage) {
        const { blob } = base64ToBlob(proofImage);
        proofUrl = await uploadPostPhoto(blob, currentUser.id, 'reports');
      }

      const res = await submitReportAction(currentUser.id, profile.uid, reportReason, reportText, proofUrl)
      if (res.success) {
        toast({ title: "Report Submitted", description: "Our team will review your proof shortly." })
        setReportOpen(false)
        handleBlock()
      } else {
        throw new Error(res.error)
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: err.message })
    } finally {
      setSubmittingReport(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-white"><Loader2 className="animate-spin text-[#00A2FF]" /></div>

  if (!profile) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8 text-center space-y-4">
      <div className="bg-gray-100 p-6 rounded-full"><Ban className="w-10 h-10 text-gray-400" /></div>
      <h2 className="text-xl font-bold text-black">Profile Not Found</h2>
      <Button onClick={() => router.back()} variant="outline" className="rounded-full">Go Back</Button>
    </div>
  )

  const isBlocked = myProfile && (
    (myProfile.blocking || []).includes(profile.uid) || 
    (myProfile.blocked_by || []).includes(profile.uid)
  );

  const age = calculateAge(profile.dob)
  const allPhotos = Array.from(new Set([profile.photo_url, ...(profile.additional_photos || [])].filter(Boolean)));

  return (
    <div className="flex-1 bg-[#F9FAFB] flex flex-col min-h-screen pb-40 select-none overflow-x-hidden">
      <div className="relative h-[60vh] w-full cursor-pointer overflow-hidden group" onClick={() => { setSelectedPhoto(profile.photo_url); setIsPhotoOpen(true); }}>
        <Image src={profile.photo_url || ""} alt={profile.name} fill className="object-cover animate-in fade-in zoom-in-105 duration-1000" priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F9FAFB] via-transparent to-black/30" />
        <div className="absolute top-12 inset-x-0 px-6 flex justify-between items-center z-20" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white/10 backdrop-blur-xl text-white w-12 h-12 border border-white/20 shadow-2xl active:scale-90 transition-all hover:bg-white/20"><ChevronLeft className="w-7 h-7" /></Button>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full bg-white/10 backdrop-blur-xl text-white w-12 h-12 border border-white/20 shadow-2xl active:scale-90 transition-all hover:bg-white/20"><MoreHorizontal className="w-7 h-7" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-[2rem] min-w-[180px] p-2 border-none shadow-2xl">
                <DropdownMenuItem onClick={handleBlock} className="rounded-2xl h-12 text-red-500 font-bold gap-3 px-4"><Ban className="w-5 h-5" /> Block User</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReportOpen(true)} className="rounded-2xl h-12 font-bold gap-3 px-4"><Flag className="w-5 h-5 text-gray-400" /> Report Violation</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {presence?.state === 'online' && !isBlocked && (
          <div className="absolute bottom-16 left-8 bg-green-500/90 backdrop-blur-md text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 animate-in slide-in-from-left-4 duration-500"><div className="w-2 h-2 bg-white rounded-full animate-pulse" />Live Online</div>
        )}
      </div>

      <div className="relative z-10 bg-white px-8 -mt-10 rounded-t-[3rem] pt-12 space-y-12 shadow-[0_-25px_60px_rgba(0,0,0,0.08)] pb-10">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black text-black tracking-tighter leading-none">{profile.name}</h1>
              {profile.is_verified && <div className="bg-[#00A2FF]/10 p-1.5 rounded-full"><BadgeCheck className="w-6 h-6 text-[#00A2FF] fill-white" /></div>}
            </div>
            <div className="flex items-center gap-2 text-gray-400"><div className="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full border border-gray-100"><MapPin className="w-3 h-3 text-[#00A2FF]" /><span className="text-[10px] font-black uppercase tracking-widest">{profile.country || "GLOBAL"}</span></div></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-black text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center gap-2"><span>{profile.gender === 'female' ? '♀' : '♂'}</span><span>{age} Years</span></div>
            <button onClick={handleCopyId} className="bg-gray-50 hover:bg-gray-100 text-gray-500 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-gray-100 flex items-center gap-2 active:scale-95 transition-all">ID: {profile.match_flow_id || "---"}{copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 opacity-40" />}</button>
          </div>
        </div>
        {profile.interests && (
          <section className="space-y-4">
             <div className="flex items-center gap-2 text-gray-900"><Quote className="w-4 h-4 text-[#00A2FF] rotate-180" /><span className="text-[11px] font-black uppercase tracking-[0.2em]">Bio & Interests</span></div>
             <div className="bg-gray-50/70 p-8 rounded-[2.5rem] border border-black/5 relative overflow-hidden"><Quote className="absolute -right-4 -bottom-4 w-24 h-24 text-black/5 pointer-events-none" /><p className="text-base font-medium text-gray-700 leading-relaxed italic relative z-10 select-text">"{profile.interests}"</p></div>
          </section>
        )}
        {allPhotos.length > 1 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2 text-gray-900"><LayoutGrid className="w-4 h-4 text-[#00A2FF]" /><span className="text-[11px] font-black uppercase tracking-[0.2em]">Visual Gallery</span></div><span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{allPhotos.length} Photos</span></div>
            <div className="grid grid-cols-4 gap-3">
              {allPhotos.map((url, i) => (
                <div key={url} className="relative aspect-square rounded-[1.5rem] overflow-hidden cursor-pointer border-2 border-gray-100 shadow-sm active:scale-95 transition-all" onClick={() => { setSelectedPhoto(url); setIsPhotoOpen(true); }}><Image src={url} alt={`Photo ${i}`} fill className="object-cover" sizes="25vw" /></div>
              ))}
            </div>
          </section>
        )}
        <div className="grid grid-cols-1 gap-4 pb-12">
          <DetailItem icon={Globe} label="Region" value={profile.country || "Not specified"} color="bg-emerald-50 text-emerald-600" />
          <DetailItem icon={GraduationCap} label="Academic" value={profile.education_level || "Not specified"} color="bg-purple-50 text-purple-600" />
          <DetailItem icon={Heart} label="Intentions" value={profile.looking_for || "Exploring"} color="bg-rose-50 text-rose-600" />
        </div>
      </div>

      {isPhotoOpen && selectedPhoto && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-300" onClick={() => setIsPhotoOpen(false)}><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsPhotoOpen(false); }} className="absolute top-12 right-6 rounded-full bg-white/10 text-white w-14 h-14 z-[110] hover:bg-white/20 transition-all"><X className="w-8 h-8 stroke-[3]" /></Button><div className="relative w-full h-full p-4 flex items-center justify-center"><Image src={selectedPhoto} alt="Full screen" fill className="object-contain" priority sizes="100vw" /></div></div>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-[90vw] p-8 space-y-6">
          <DialogHeader className="items-center text-center"><div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2"><Flag className="w-8 h-8 text-red-500" /></div><DialogTitle className="text-xl font-bold">Report Profile</DialogTitle><DialogDescription className="text-xs font-bold uppercase tracking-widest text-gray-400">Help keep QIVO safe</DialogDescription></DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Reason for Report</label>
              <Select onValueChange={setReportReason} value={reportReason}><SelectTrigger className="h-14 rounded-2xl bg-gray-50 border-gray-100"><SelectValue placeholder="Select a reason" /></SelectTrigger><SelectContent className="rounded-2xl">{REPORT_REASONS.map(r => <SelectItem key={r} value={r} className="font-bold">{r}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Proof Description</label>
              <Textarea placeholder="Tell us what happened..." value={reportText} onChange={(e) => setReportDescription(e.target.value)} className="rounded-2xl min-h-[100px] bg-gray-50 border-gray-100 font-medium" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Photo Evidence</label>
              {proofImage ? (<div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-gray-100 group"><Image src={proofImage} alt="Proof" fill className="object-cover" /><button onClick={() => setProofImage(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full backdrop-blur-md"><X className="w-4 h-4" /></button></div>) : (<Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full h-24 rounded-2xl border-dashed border-2 border-gray-200 flex flex-col gap-2 hover:bg-gray-50"><ImageIcon className="w-6 h-6 text-gray-300" /><span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Select from Gallery</span></Button>)}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
          </div>
          <Button onClick={handleSubmitReport} disabled={submittingReport || !reportReason || !reportText} className="w-full h-16 rounded-full bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest shadow-xl shadow-red-100 transition-all active:scale-95">{submittingReport ? <Loader2 className="animate-spin" /> : <div className="flex items-center gap-2"><Send className="w-5 h-5" /> Submit Report</div>}</Button>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-0 inset-x-0 p-8 bg-gradient-to-t from-white via-white/95 to-transparent z-50">
        <Button disabled={isBlocked} className={cn("w-full h-20 rounded-[2.5rem] text-white text-base font-black flex items-center justify-center gap-4 shadow-[0_20px_50px_rgba(0,162,255,0.3)] uppercase tracking-[0.2em] active:scale-95 transition-all", isBlocked ? "bg-gray-200 shadow-none cursor-not-allowed text-gray-400" : "bg-[#00A2FF] hover:bg-[#0081CC] border-none")} onClick={() => router.push(`/chats?startWith=${profile.uid}`)}>{isBlocked ? <><Ban className="w-6 h-6" /> Blocked</> : <><MessageSquare className="w-6 h-6 fill-white" />Send Message</>}</Button>
      </div>
    </div>
  )
}

function DetailItem({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="flex items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-black/[0.03] shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("w-14 h-14 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-inner", color)}><Icon className="w-7 h-7" /></div>
      <div className="min-w-0"><p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{label}</p><p className="text-[15px] font-black text-black truncate tracking-tight">{value}</p></div>
    </div>
  )
}
