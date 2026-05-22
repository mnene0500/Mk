"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { BottomNav } from "./BottomNav"
import { Suspense } from "react"

/**
 * List of paths where the Bottom Navigation is allowed.
 */
const ALLOWED_NAV_PATHS = [
  '/home',
  '/chats',
  '/profile'
]

/**
 * Internal Shell component that handles navigation visibility logic.
 */
function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // Check if we are in a specific conversation detail view
  const isChatDetail = pathname === '/chats' && searchParams.has('startWith')
  
  // Show nav only if on allowed paths AND not in a detailed sub-view (like a specific chat)
  const isVisible = ALLOWED_NAV_PATHS.includes(pathname || "") && !isChatDetail

  return (
    <div className="flex-1 flex flex-col relative min-h-screen overflow-x-hidden">
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      {isVisible && <BottomNav />}
    </div>
  )
}

/**
 * @fileOverview Global App Shell that keeps the BottomNav persistent and stable.
 * Uses Suspense to safely access search params during client-side transitions.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-1 bg-white" />}>
      <ShellContent>
        {children}
      </ShellContent>
    </Suspense>
  )
}
