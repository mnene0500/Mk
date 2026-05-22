"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"

/**
 * Root Redirector.
 * Hardened logic gate to ensure zero-latency routing to the correct entry point.
 * Verifies onboarding status BEFORE allowing access to home.
 */
export default function RootPage() {
  const router = useRouter()
  const { user, loading: authLoading, isInitialized } = useUser()

  useEffect(() => {
    if (!isInitialized || authLoading) return

    if (!user) {
      router.replace("/welcome")
      return
    }

    // Secure check for onboarding completion
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('uid', user.id)
        .maybeSingle()
      
      if (data?.onboarding_complete) {
        router.replace("/home")
      } else {
        router.replace("/fastonboard")
      }
    }

    checkOnboarding()
  }, [user, isInitialized, authLoading, router])

  return (
    <div className="fixed inset-0 bg-white" />
  )
}
