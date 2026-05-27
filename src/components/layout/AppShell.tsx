"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { BottomNav } from "./BottomNav"
import { Suspense } from "react"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Signaling Shell.
 * Optimized for native feel and fixed navigation.
 */
function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const isChatDetail = pathname === '/chats' && searchParams.has('startWith')
  const isVisible = ['/home', '/chats', '/profile'].includes(pathname || "") && !isChatDetail

  return (
    <div className="flex-1 flex flex-col relative min-h-screen overflow-x-hidden bg-white">
      {/* WRAP CHILDREN IN TRANSITION CONTAINER INDEPENDENT OF FIXED NAV */}
      <main className={cn(
        "flex-1 flex flex-col relative z-0",
        "native-page-transition"
      )}>
        {children}
      </main>
      
      {isVisible && (
        <div className="relative z-[100]">
          <BottomNav />
        </div>
      )}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-1 bg-white" />}>
      <ShellContent>
        {children}
      </ShellContent>
    </Suspense>
  )
}