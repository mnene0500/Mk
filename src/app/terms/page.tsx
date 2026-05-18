"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

export default function TermsOfServicePage() {
  const router = useRouter()

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      <header className="px-4 h-16 flex items-center border-b sticky top-0 bg-white z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-6 h-6 text-black" />
        </Button>
        <h1 className="text-lg font-bold text-black ml-2">Terms of Service</h1>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-black">1. Acceptance of Terms</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            By accessing or using QIVO, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-black">2. Eligibility</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            You must be at least 18 years of age to create an account on QIVO. By using the service, you represent and warrant that you have the right, authority, and capacity to enter into this agreement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-black">3. User Conduct</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            You are solely responsible for your interactions with other users. You agree to treat others with respect and refrain from harassment, hate speech, or sharing explicit or illegal content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-black">4. Virtual Currency</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            QIVO uses "Coins" and "Diamonds." Coins are purchased and used for interactions. Diamonds are earned through engagement and can be converted to Coins. These virtual currencies have no monetary value outside the app and are non-refundable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-black">5. Account Safety</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            You are responsible for maintaining the confidentiality of your login credentials. We recommend binding your account to an email to prevent loss of data or virtual currency.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-black">6. Termination</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            We reserve the right to terminate or suspend your account at any time, without notice, for conduct that we believe violates these Terms or is harmful to other users of the app.
          </p>
        </section>
      </main>
    </div>
  )
}
