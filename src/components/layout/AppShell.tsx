
"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { BottomNav } from "./BottomNav"
import { Suspense, useRef, useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useUser } from "@/firebase/auth/use-user"

/**
 * @fileOverview Viewport-Centric App Shell.
 * Optimized for hydration safety and scroll persistence.
 */

let scrollCache: Record<string, number> = {};

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const mainRef = useRef<HTMLElement>(null)
  
  // HYDRATION SAFETY FLAG
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const isChatDetail = pathname === '/chats' && searchParams.has('startWith')
  const isCall = pathname?.startsWith('/call/')
  const isWelcome = pathname === '/welcome'
  const isAuth = pathname === '/auth'
  const isSplash = pathname === '/'
  const isFastOnboard = pathname === '/fastonboard'

  const showNav = useMemo(() => {
    if (!mounted || !user) return false;
    const navRoutes = ['/home', '/chats', '/profile'];
    return navRoutes.includes(pathname || "") && !isChatDetail && !isCall && !isWelcome && !isAuth && !isSplash && !isFastOnboard;
  }, [mounted, user, pathname, isChatDetail, isCall, isWelcome, isAuth, isSplash, isFastOnboard]);

  // RESTORE SCROLL
  useEffect(() => {
    if (mainRef.current && mounted) {
      const savedPosition = scrollCache[pathname || ''] || 0;
      mainRef.current.scrollTop = savedPosition;
    }
  }, [pathname, mounted])

  // SAVE SCROLL ON LEAVE
  useEffect(() => {
    const currentMain = mainRef.current;
    if (!currentMain || !pathname) return;

    const handleScroll = () => {
      scrollCache[pathname] = currentMain.scrollTop;
    }

    currentMain.addEventListener('scroll', handleScroll);
    return () => {
      currentMain.removeEventListener('scroll', handleScroll);
    }
  }, [pathname])

  // LISTEN FOR GLOBAL REFRESH EVENT (Scroll to Top)
  useEffect(() => {
    const handleRefresh = (e: any) => {
      if (e.detail.path === pathname && mainRef.current) {
        mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        scrollCache[pathname] = 0;
      }
    }
    window.addEventListener('qivo-nav-refresh', handleRefresh);
    return () => window.removeEventListener('qivo-nav-refresh', handleRefresh);
  }, [pathname])

  // STABLE CONTAINER: Keep classes consistent between server/client to prevent hydration mismatches
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-white relative">
      <main 
        ref={mainRef}
        className={cn(
          "flex-1 w-full overflow-y-auto overflow-x-hidden relative z-0 no-scrollbar pb-[env(safe-area-inset-bottom)]",
          showNav ? "pb-16" : "pb-0"
        )}
      >
        <div className={cn("min-h-full flex flex-col", !mounted && "invisible")}>
           {children}
        </div>
      </main>
      
      {mounted && showNav && <BottomNav />}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-1 bg-white h-screen" />}>
      <ShellContent>
        {children}
      </ShellContent>
    </Suspense>
  )
}
