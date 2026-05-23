
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase, base64ToBlob, uploadProfilePhoto, uploadPostPhoto } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, Loader2, Save, Camera, Plus, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Cropper from "react-easy-crop"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"

const AFRICAN_COUNTRIES = [
  "Kenya", "Tanzania", "Uganda", "Rwanda", "Burundi", "South Sudan", "Ethiopia", "Somalia", "Eritrea", "Djibouti", "South Africa", "Nigeria", "Ghana", "Egypt"
]

const LOOKING_FOR_OPTIONS = [
  "Serious partner", "Casual friendship", "Networking", "Dating", "Travel buddy"
]

const EDUCATION_OPTIONS = [
  "High School", "Associate Degree", "Bachelor's Degree", "Master's Degree", "PhD", "Prefer not to say"
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
    dob: "",
    country: "",
    looking_for: "",
    education_level: "",
    photo_url: "",
    additional_photos: [] as string[]
  })

  const [cropOpen, setCropOpen] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [targetPhotoIndex, setTargetPhotoIndex] = useState<number | 'profile'>('profile')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('*').eq('uid', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setFormData({
          name: data.name || "",
          interests: data.interests || "",
          dob: data.dob || "",
          country: data.country || "",
          looking_for: data.looking_for || "",
          education_level: data.education_level || "",
          photo_url: data.photo_url || "",
          additional_photos: data.additional_photos || []
        })
      }
      setLoading(false)
    })
  }, [user])

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setTempImage(reader.result as string)
        setCropOpen(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new (window as any).Image()
      img.addEventListener('load', () => resolve(img))
      img.addEventListener('error', (error: any) => reject(error))
      img.src = imageSrc
    })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return ""
    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  const handleCropSave = async () => {
    if (tempImage && croppedAreaPixels) {
      try {
        const croppedBase64 = await getCroppedImg(tempImage, croppedAreaPixels)
        if (targetPhotoIndex === 'profile') {
          setFormData({ ...formData, photo_url: croppedBase64 })
        } else {
          const newPhotos = [...formData.additional_photos]
          if (typeof targetPhotoIndex === 'number') {
            newPhotos[targetPhotoIndex] = croppedBase64
          } else {
            newPhotos.push(croppedBase64)
          }
          setFormData({ ...formData, additional_photos: newPhotos.slice(0, 4) })
        }
        setCropOpen(false)
        setTempImage(null)
      } catch (e) {
        toast({ variant: "destructive", title: "Cropping failed" })
      }
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const finalFormData = { ...formData };
      
      // 1. Upload Profile Avatar if changed (base64 check)
      if (formData.photo_url.startsWith('data:image')) {
        const { blob } = base64ToBlob(formData.photo_url);
        const uploadedUrl = await uploadProfilePhoto(blob, user.id);
        finalFormData.photo_url = uploadedUrl;
      }

      // 2. Upload Gallery Photos if changed
      const finalGalleryUrls: string[] = [];
      for (const p of formData.additional_photos) {
        if (p.startsWith('data:image')) {
          const { blob } = base64ToBlob(p);
          const uploadedUrl = await uploadPostPhoto(blob, user.id);
          finalGalleryUrls.push(uploadedUrl);
        } else if (p) {
          finalGalleryUrls.push(p);
        }
      }
      finalFormData.additional_photos = finalGalleryUrls;

      // 3. ATOMIC DATABASE UPDATE
      const { error } = await supabase.from('users').update({
        name: finalFormData.name,
        interests: finalFormData.interests,
        dob: finalFormData.dob,
        country: finalFormData.country,
        looking_for: finalFormData.looking_for,
        education_level: finalFormData.education_level,
        photo_url: finalFormData.photo_url,
        additional_photos: finalFormData.additional_photos,
        updated_at: new Date().toISOString()
      }).eq('uid', user.id)
      
      if (error) throw error;

      // 4. Force state update and cache clear
      setFormData(finalFormData);
      sessionStorage.clear();
      
      toast({ title: "Profile Saved", description: "Your photos are now permanent." })
      router.replace('/profile')
    } catch (error: any) {
      console.error("[Profile Save Error]", error.message);
      toast({ variant: "destructive", title: "Save Failed", description: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-[#00A2FF]" /></div>

  const avatarKey = `${formData.photo_url}?t=${Date.now()}`;

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col pb-20">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ChevronLeft className="w-6 h-6 text-black" /></Button>
        <h1 className="text-base font-black text-black">Edit Profile</h1>
        <Button variant="ghost" size="icon" onClick={handleSave} disabled={saving} className="text-[#00A2FF]">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}</Button>
      </header>
      <main className="flex-1 p-6 space-y-8 overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={() => { setTargetPhotoIndex('profile'); fileInputRef.current?.click(); }}>
            <Avatar className="w-28 h-28 border-4 border-gray-50 shadow-xl overflow-hidden">
              <AvatarImage key={avatarKey} src={avatarKey} className="object-cover" />
              <AvatarFallback className="bg-gray-100"><Camera className="w-8 h-8 text-gray-300" /></AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 bg-[#00A2FF] p-2 rounded-full text-white shadow-lg"><Camera className="w-4 h-4" /></div>
          </div>
          <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tap to change avatar</p>
        </div>
        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Gallery (Max 4)</Label>
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="relative aspect-square rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => { setTargetPhotoIndex(i); fileInputRef.current?.click(); }}>
                {formData.additional_photos[i] ? (
                  <>
                    <Image key={`${formData.additional_photos[i]}-${i}`} src={formData.additional_photos[i]} alt={`P${i}`} fill className="object-cover" sizes="25vw" />
                    <button onClick={(e) => { e.stopPropagation(); const n = [...formData.additional_photos]; n.splice(i,1); setFormData({...formData, additional_photos: n}); }} className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white"><X className="w-3 h-3" /></button>
                  </>
                ) : (<Plus className="w-6 h-6 text-gray-300" />)}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Full Name</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold" /></div>
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-gray-400 ml-1">DOB</Label><Input type="date" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold" /></div>
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Bio</Label><Textarea value={formData.interests} onChange={(e) => setFormData({...formData, interests: e.target.value})} className="rounded-2xl min-h-[120px] border-gray-100 bg-gray-50 font-medium" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Country</Label><Select onValueChange={(val) => setFormData({...formData, country: val})} value={formData.country}><SelectTrigger className="rounded-2xl h-14 bg-gray-50"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl">{AFRICAN_COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Education</Label><Select onValueChange={(val) => setFormData({...formData, education_level: val})} value={formData.education_level}><SelectTrigger className="rounded-2xl h-14 bg-gray-50"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl">{EDUCATION_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Looking For</Label><Select onValueChange={(val) => setFormData({...formData, looking_for: val})} value={formData.looking_for}><SelectTrigger className="rounded-2xl h-14 bg-gray-50"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl">{LOOKING_FOR_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </main>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="max-w-md h-[500px] p-0 overflow-hidden rounded-[2.5rem]">
          <DialogHeader className="p-4 border-b"><DialogTitle className="text-center font-black uppercase text-[10px] tracking-widest">Adjust Photo</DialogTitle></DialogHeader>
          <div className="relative flex-1 bg-black h-full min-h-[300px]">{tempImage && (<Cropper image={tempImage} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />)}</div>
          <DialogFooter className="p-4 bg-white"><Button onClick={handleCropSave} className="w-full h-14 rounded-full bg-[#00A2FF] font-bold uppercase tracking-widest">Save Selection</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
