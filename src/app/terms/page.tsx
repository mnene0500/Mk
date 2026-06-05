"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Scale } from "lucide-react"

export default function TermsOfServicePage() {
  const router = useRouter()

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center border-b sticky top-0 bg-white z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest ml-2">Terms of Service</h1>
      </header>

      <main className="flex-1 p-8 space-y-8 overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-black/5">
              <Scale className="w-6 h-6 text-black" />
           </div>
           <div>
             <h2 className="text-xl font-black uppercase tracking-tight">Legal Protocol</h2>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Effective Jan 1, 2024</p>
           </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-[#00A2FF] pl-3">1. Binding Agreement</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            By accessing QIVO, you enter a binding legal contract. You agree to utilize the platform exclusively for genuine social networking and abide by all local and international laws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-[#00A2FF] pl-3">2. Virtual Assets</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            Coins and Diamonds are digital tokens with no intrinsic monetary value. They are non-refundable and non-transferable outside the QIVO ecosystem. QIVO reserves the right to manage and regulate these assets.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-[#00A2FF] pl-3">3. Interaction Ethics</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            We enforce a Zero-Tolerance Policy for harassment, fraud, and explicit content. Violations will result in immediate permanent suspension and forfeiture of all virtual balances.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-[#00A2FF] pl-3">4. Profile Integrity</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            Users must be 18+ years of age. Misrepresentation of identity or age is a primary violation. AI verification is mandatory for several features to ensure a trusted community.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-black uppercase tracking-widest border-l-4 border-[#00A2FF] pl-3">5. Termination</h2>
          <p className="text-[13px] text-gray-600 font-bold leading-relaxed">
            QIVO reserves the unilateral right to terminate accounts that compromise platform stability or user safety. Terminated users lose all access to data and virtual currency.
          </p>
        </section>

        <div className="pt-10 border-t border-gray-50 text-center opacity-30">
          <p className="text-[9px] font-black uppercase tracking-widest">Governed by Laws of the Republic of Kenya</p>
        </div>
      </main>
    </div>
  )
}
