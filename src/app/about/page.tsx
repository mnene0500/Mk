"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Heart, ShieldCheck, Zap, Globe } from "lucide-react"

export default function AboutPage() {
  const router = useRouter()

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center border-b sticky top-0 bg-white z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest ml-2">About QIVO</h1>
      </header>

      <main className="flex-1 p-8 flex flex-col items-center space-y-12">
        <div className="flex flex-col items-center text-center space-y-4 pt-10">
          <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center shadow-xl border border-blue-100">
            <Heart className="w-12 h-12 text-[#00A2FF] fill-current" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-black tracking-tighter uppercase italic">QIVO <span className="text-[#00A2FF]">Social</span></h2>
            <p className="text-[10px] text-gray-400 font-black tracking-widest uppercase bg-gray-50 px-3 py-1 rounded-full">v1.2.6 Production</p>
          </div>
        </div>

        <div className="space-y-8 text-center max-w-sm">
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            QIVO is a premium social ecosystem engineered for high-fidelity human connections. We bridge the gap between digital interaction and real-world chemistry.
          </p>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-5 bg-gray-50 rounded-3xl space-y-2 border border-black/5">
                <ShieldCheck className="w-6 h-6 text-green-500 mx-auto" />
                <p className="text-[9px] font-black uppercase text-black tracking-widest">Verified Identity</p>
             </div>
             <div className="p-5 bg-gray-50 rounded-3xl space-y-2 border border-black/5">
                <Zap className="w-6 h-6 text-yellow-500 mx-auto" />
                <p className="text-[9px] font-black uppercase text-black tracking-widest">Instant Reach</p>
             </div>
          </div>

          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            Based in Nairobi, Kenya, we are committed to building Africa's most trusted and vibrant social community, where safety and meaningful engagement come first.
          </p>
        </div>

        <div className="pt-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
             <Globe className="w-4 h-4 text-gray-300" />
             <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Global Node: Nairobi</span>
          </div>
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">© 2024 QIVO Global Platform</p>
        </div>
      </main>
    </div>
  )
}
