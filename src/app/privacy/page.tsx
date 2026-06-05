"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ShieldAlert } from "lucide-react"

export default function PrivacyPolicyPage() {
  const router = useRouter()

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center border-b sticky top-0 bg-white z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest ml-2">Privacy Policy</h1>
      </header>

      <main className="flex-1 p-8 space-y-8 overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100">
              <ShieldAlert className="w-6 h-6 text-[#00A2FF]" />
           </div>
           <div>
             <h2 className="text-xl font-black uppercase tracking-tight">Data Protection</h2>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Version 2.0 Compliance</p>
           </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-black pl-3">1. Data Collection</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            We collect profile identifiers, biometric data for AI verification, and interaction metadata. This information is strictly used to facilitate connections and secure the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-black pl-3">2. Processing & Storage</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            Your data is stored in encrypted cloud environments. Real-time messages are end-to-end transmitted and stored securely. We do not sell user data to third-party advertisers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-black pl-3">3. Premium Features</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            Features like Visitor Tracking and Read Receipts process specific metadata (timestamps and view events). Activation of these features constitutes consent for the specific processing of this data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-black pl-3">4. Security Measures</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            We utilize AI analysis to detect fraudulent patterns and identity theft. Biometric data is used solely for the "Verified" badge process and is not shared.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-black pl-3">5. User Control</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            You maintain full control over your data. You may request permanent deletion of your profile and all associated metadata at any time through the Application Settings.
          </p>
        </section>

        <div className="pt-10 border-t border-gray-50 text-center opacity-30">
          <p className="text-[9px] font-black uppercase tracking-widest">QIVO High-Security Social Node</p>
        </div>
      </main>
    </div>
  )
}
