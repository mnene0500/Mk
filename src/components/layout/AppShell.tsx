"use client"

import { usePathname } from "next/navigation"
import { BottomNav } from "./BottomNav"

const HIDE_NAV_PATHS = [
  '/',
  '/welcome',
  '/auth',
  '/fastonboard',
  '/onboarding',
  '/verify-identity'
]

/**
 * @fileOverview Global App Shell that keeps the BottomNav persistent and stable.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Logic to hide nav on specific screens (e.g., auth, splash, onboarding, calls)
  const isCall = pathname?.startsWith('/call/')
  const isHidden = HIDE_NAV_PATHS.includes(pathname || "") || isCall

  return (
    <div className="flex-1 flex flex-col relative min-h-screen overflow-x-hidden">
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      {!isHidden && <BottomNav />}
    </div>
  )
}
