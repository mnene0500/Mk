"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { useFirestore, useUser } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, Loader2, Save, Camera, Plus, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Cropper from "react-easy-crop"
import imageCompression from "browser-image-compression"
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
  const db = useFirestore()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    name: "",
    interests: "",
    dob: "",
    country: "",
    lookingFor: "",
    educationLevel: "",
    photoURL: "",
    additionalPhotos: [] as string[]
  })

  // Cropping State
  const [cropOpen, setCropOpen] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [targetPhotoIndex, setTargetPhotoIndex] = useState<number | 'profile'>('profile')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user || !db) return
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, "users", user.uid)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          setFormData({
            name: data.name || "",
            interests: data.interests || "",
            dob: data.dob || "",
            country: data.country || "",
            lookingFor: data.lookingFor || "",
            educationLevel: data.educationLevel || "",
            photoURL: data.photoURL || "",
            additionalPhotos: data.additionalPhotos || []
          })
        }
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [user, db])

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
    return canvas.toDataURL('image/jpeg')
  }

  const handleCropSave = async () => {
    if (tempImage && croppedAreaPixels) {
      try {
        const croppedBase64 = await getCroppedImg(tempImage, croppedAreaPixels)
        if (targetPhotoIndex === 'profile') {
          // Sync new profile photo to gallery if space exists
          const newGallery = [...formData.additionalPhotos];
          if (newGallery.length < 4 && !newGallery.includes(croppedBase64)) {
             newGallery.push(croppedBase64);
          }
          setFormData({ ...formData, photoURL: croppedBase64, additionalPhotos: newGallery })
        } else {
          const newPhotos = [...formData.additionalPhotos]
          if (typeof targetPhotoIndex === 'number') {
            newPhotos[targetPhotoIndex] = croppedBase64
          } else {
            newPhotos.push(croppedBase64)
          }
          setFormData({ ...formData, additionalPhotos: newPhotos })
        }
        setCropOpen(false)
        setTempImage(null)
      } catch (e) {
        toast({ variant: "destructive", title: "Cropping failed" })
      }
    }
  }

  const handleSave = async () => {
    if (!user || !db) return
    setSaving(true)
    try {
      await updateDoc(doc(db, "users", user.uid), {
        ...formData,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Profile Updated" })
      router.back()
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update profile." })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-[#00A2FF]" /></div>

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col pb-20">
      <header className="px-4 h-16 flex items-center justify-between border-b sticky top-0 bg-white z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-base font-black text-black">Edit Profile</h1>
        <Button variant="ghost" size="icon" onClick={handleSave} disabled={saving} className="text-[#00A2FF]">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        </Button>
      </header>

      <main className="flex-1 p-6 space-y-8 overflow-y-auto">
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={() => { setTargetPhotoIndex('profile'); fileInputRef.current?.click(); }}>
            <Avatar className="w-28 h-28 border-4 border-gray-50 shadow-xl">
              <AvatarImage src={formData.photoURL} className="object-cover" />
              <AvatarFallback className="bg-gray-100"><Camera className="w-8 h-8 text-gray-300" /></AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 bg-[#00A2FF] p-2 rounded-full text-white shadow-lg">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profile Photo</p>
        </div>

        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Additional Photos (Max 4)</Label>
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i} 
                className="relative aspect-square rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer"
                onClick={() => { setTargetPhotoIndex(i); fileInputRef.current?.click(); }}
              >
                {formData.additionalPhotos[i] ? (
                  <>
                    <Image src={formData.additionalPhotos[i]} alt={`Photo ${i}`} fill className="object-cover" />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newPhotos = [...formData.additionalPhotos];
                        newPhotos.splice(i, 1);
                        setFormData({ ...formData, additionalPhotos: newPhotos });
                      }}
                      className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <Plus className="w-6 h-6 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Full Name</Label>
            <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">About Me</Label>
            <Textarea value={formData.interests} onChange={(e) => setFormData({...formData, interests: e.target.value})} className="rounded-2xl min-h-[120px] border-gray-100 bg-gray-50 font-medium" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Country</Label>
              <Select onValueChange={(val) => setFormData({...formData, country: val})} value={formData.country}>
                <SelectTrigger className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="rounded-2xl">{AFRICAN_COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Education</Label>
              <Select onValueChange={(val) => setFormData({...formData, educationLevel: val})} value={formData.educationLevel}>
                <SelectTrigger className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="rounded-2xl">{EDUCATION_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Looking For</Label>
            <Select onValueChange={(val) => setFormData({...formData, lookingFor: val})} value={formData.lookingFor}>
              <SelectTrigger className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent className="rounded-2xl">{LOOKING_FOR_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </main>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />

      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="max-w-md h-[500px] p-0 overflow-hidden rounded-[2.5rem]">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-center font-black uppercase text-[10px] tracking-widest">Adjust Photo</DialogTitle>
          </DialogHeader>
          <div className="relative flex-1 bg-black h-full min-h-[300px]">
            {tempImage && (
              <Cropper
                image={tempImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <DialogFooter className="p-4 bg-white">
            <Button onClick={handleCropSave} className="w-full h-14 rounded-full bg-[#00A2FF] font-bold uppercase tracking-widest">Save Selection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
