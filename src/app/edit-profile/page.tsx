"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase, base64ToBlob, uploadProfilePhoto, uploadPostPhoto } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, Loader2, Camera, Plus, X, MapPin, Calendar, Heart, GraduationCap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Cropper from "react-easy-crop"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"

const AFRICAN_COUNTRIES = [
  "Kenya", "Tanzania", "Uganda", "Rwanda", "Burundi", "South Sudan", "Ethiopia", "Somalia", "Eritrea", "Djibouti", "South Africa", "Nigeria", "Ghana", "Egypt"
]

const LOOKING_FOR_OPTIONS = [
  "Serious Partner", "Casual Friendship", "Networking", "Dating", "Travel Buddy"
]

const EDUCATION_LEVELS = [
  "High School", "Diploma", "Bachelor's Degree", "Master's Degree", "Doctorate", "Other"
]

export default function EditProfilePage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ 
    name: "", 
    interests: "", 
    photo_url: "", 
    additional_photos: [] as string[],
    country: "",
    dob: "",
    looking_for: "",
    education_level: ""
  })

  const [cropOpen, setCropOpen] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 }); 
  const [zoom, setZoom] = useState(1); 
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [targetPhotoIndex, setTargetPhotoIndex] = useState<number | 'profile'>('profile')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user?.id) {
      supabase.from('users').select('*').eq('uid', user.id).single().then(({ data }) => {
        if (data) {
          setFormData({ 
            name: data.name || "", 
            interests: data.interests || "", 
            photo_url: data.photo_url || "", 
            additional_photos: data.additional_photos || [],
            country: data.country || "",
            dob: data.dob || "",
            looking_for: data.looking_for || "",
            education_level: data.education_level || ""
          })
        }
        setLoading(false)
      })
    }
  }, [user?.id])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader(); reader.onload = () => {
      const res = reader.result as string;
      if (targetPhotoIndex === 'profile') { 
        setTempImage(res); 
        setCropOpen(true); 
      } else { 
        const n = [...formData.additional_photos]; 
        n.push(res); 
        setFormData({ ...formData, additional_photos: n.slice(0, 4) }); 
      }
    }; reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!user?.id) return

    if (!formData.interests || formData.interests.trim().length < 5) {
      toast({ variant: "destructive", title: "Bio Compulsory", description: "Please write a short bio about yourself." });
      return;
    }

    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Name Required" });
      return;
    }

    setSaving(true)
    try {
      let finalPhotoUrl = formData.photo_url;
      if (formData.photo_url.startsWith('data:image')) {
        const { blob } = base64ToBlob(formData.photo_url);
        finalPhotoUrl = await uploadProfilePhoto(blob, user.id);
      }
      
      const finalGallery = await Promise.all(formData.additional_photos.map(async (p) => {
        if (p.startsWith('data:image')) { 
          const { blob } = base64ToBlob(p); 
          return uploadPostPhoto(blob, user.id); 
        }
        return p;
      }))

      const { error } = await supabase.from('users').update({ 
        name: formData.name, 
        interests: formData.interests, 
        photo_url: finalPhotoUrl, 
        additional_photos: finalGallery,
        country: formData.country,
        dob: formData.dob,
        looking_for: formData.looking_for,
        education_level: formData.education_level,
        updated_at: new Date().toISOString() 
      }).eq('uid', user.id)

      if (error) throw error

      toast({ title: "Profile Updated" }); 
      router.replace('/profile')
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Failed", description: e.message }); 
      setSaving(false); 
    }
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-[#00A2FF] w-8 h-8" /></div>

  return (
    <div className="flex flex-col min-h-full bg-white relative select-none">
      <header className="px-6 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-[60]">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-gray-50 active:scale-90 transition-transform">
          <ChevronLeft className="w-5 h-5 text-black" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-[0.2em]">Profile Editor</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-8 space-y-10 pb-40 overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={() => { setTargetPhotoIndex('profile'); fileInputRef.current?.click(); }}>
            <div className="w-36 h-36 rounded-[3rem] bg-gray-50 border-4 border-white shadow-2xl overflow-hidden relative transition-transform group-active:scale-95 duration-500">
              <Avatar className="w-full h-full rounded-none">
                <AvatarImage src={formData.photo_url} className="object-cover" />
                <AvatarFallback className="bg-gray-100"><Camera className="w-12 h-12 text-gray-200" /></AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#00A2FF] p-3.5 rounded-3xl text-white shadow-2xl border-4 border-white active:scale-90 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-[10px] font-black text-gray-300 uppercase tracking-[0.4em]">Update Avatar</p>
        </div>

        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Visual Gallery (Max 4)</Label>
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="relative aspect-square rounded-[1.2rem] bg-gray-50 border-2 border-dashed border-gray-100 flex items-center justify-center overflow-hidden cursor-pointer active:scale-95 transition-all shadow-inner" onClick={() => { setTargetPhotoIndex(i); fileInputRef.current?.click(); }}>
                {formData.additional_photos[i] ? (
                  <>
                    <Image src={formData.additional_photos[i]} alt="P" fill className="object-cover" sizes="20vw" />
                    <button onClick={(e) => { e.stopPropagation(); const n = [...formData.additional_photos]; n.splice(i,1); setFormData({...formData, additional_photos: n}); }} className="absolute top-1 right-1 bg-black/50 p-1.5 rounded-full text-white backdrop-blur-md"><X className="w-2.5 h-2.5" /></button>
                  </>
                ) : (<Plus className="w-5 h-5 text-gray-200" />)}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Public Name</Label>
            <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="rounded-2xl h-16 border-gray-50 bg-gray-50 font-black text-sm px-6 transition-all focus:bg-white focus:border-[#00A2FF]" />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center ml-1">
              <Label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">About Me</Label>
              <span className="text-[8px] font-black text-[#00A2FF] uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">Required</span>
            </div>
            <textarea 
              value={formData.interests} 
              onChange={(e) => setFormData({...formData, interests: e.target.value})} 
              placeholder="Share your story..."
              className="w-full rounded-[2rem] min-h-[140px] border border-gray-50 bg-gray-50 font-bold text-sm p-6 outline-none focus:bg-white focus:border-[#00A2FF] transition-all resize-none shadow-inner" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[#00A2FF]"/> Birthday</Label>
              <Input type="date" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} className="rounded-2xl h-16 border-gray-50 bg-gray-50 font-black text-sm px-4" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#00A2FF]"/> Origin</Label>
              <Select onValueChange={(v) => setFormData({...formData, country: v})} value={formData.country}>
                <SelectTrigger className="rounded-2xl h-16 border-gray-50 bg-gray-50 font-black text-sm px-4">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  {AFRICAN_COUNTRIES.map((c) => <SelectItem key={c} value={c} className="font-black text-xs uppercase py-3">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5 text-[#00A2FF]"/> Education</Label>
              <Select onValueChange={(v) => setFormData({...formData, education_level: v})} value={formData.education_level}>
                <SelectTrigger className="rounded-2xl h-16 border-gray-50 bg-gray-50 font-black text-sm px-6 transition-all focus:bg-white">
                  <SelectValue placeholder="Degree Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  {EDUCATION_LEVELS.map((level) => <SelectItem key={level} value={level} className="font-black text-xs uppercase py-3">{level}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-[#00A2FF]"/> Looking For</Label>
              <Select onValueChange={(v) => setFormData({...formData, looking_for: v})} value={formData.looking_for}>
                <SelectTrigger className="rounded-2xl h-16 border-gray-50 bg-gray-50 font-black text-sm px-6 transition-all focus:bg-white">
                  <SelectValue placeholder="What's your goal?" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  {LOOKING_FOR_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className="font-black text-xs uppercase py-3">{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 inset-x-0 p-8 bg-white/90 backdrop-blur-xl border-t border-gray-50 z-[60] pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-10px_30px_rgba(0,0,0,0.04)]">
        <Button 
          onClick={handleSave} 
          disabled={saving} 
          className="w-full h-16 rounded-2xl bg-black text-white font-black uppercase tracking-[0.2em] text-sm shadow-xl active:scale-95 transition-all"
        >
          {saving ? <Loader2 className="animate-spin w-5 h-5" /> : "Save Profile"}
        </Button>
      </footer>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="max-w-md h-[500px] p-0 overflow-hidden rounded-[3rem] border-none bg-black shadow-2xl">
          <DialogHeader className="p-6 border-b border-white/5 bg-black text-center shrink-0">
             <DialogTitle className="font-black uppercase text-[10px] tracking-[0.4em] text-white">Adjust Avatar</DialogTitle>
          </DialogHeader>
          <div className="relative flex-1 bg-black h-full min-h-[300px]">
            {tempImage && (<Cropper image={tempImage} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={(_, p) => setCroppedAreaPixels(p)} onZoomChange={setZoom} />)}
          </div>
          <DialogFooter className="p-8 bg-black">
            <Button onClick={async () => {
              const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const img = new (window as any).Image(); img.src = tempImage;
              await new Promise(r => img.onload = r); canvas.width = (croppedAreaPixels as any).width; canvas.height = (croppedAreaPixels as any).height;
              ctx?.drawImage(img, (croppedAreaPixels as any).x, (croppedAreaPixels as any).y, (croppedAreaPixels as any).width, (croppedAreaPixels as any).height, 0, 0, canvas.width, canvas.height);
              setFormData({ ...formData, photo_url: canvas.toDataURL('image/jpeg', 0.85) }); setCropOpen(false);
            }} className="w-full h-16 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] shadow-xl">Apply View</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
