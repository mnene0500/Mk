"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"

/**
 * @fileOverview Redesigned Bottom Navigation to match screenshot exactly.
 */
export function BottomNav() {
  const pathname = usePathname()
  const { user } = useUser()
  const [totalUnread, setTotalUnread] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user?.id || !mounted) return
    
    const fetchUnread = async () => {
      const { data } = await supabase
        .from('chats')
        .select('id, last_message_at, last_seen_at, last_sender_id')
        .contains('participant_ids', [user.id])
      
      if (data) {
        const count = data.reduce((acc, chat) => {
          const userSeenAt = (chat.last_seen_at as Record<string, number>)?.[user.id] || 0;
          const lastMsgAt = chat.last_message_at || 0;
          const isUnread = lastMsgAt > userSeenAt && chat.last_sender_id !== user.id;
          return isUnread ? acc + 1 : acc;
        }, 0);
        setTotalUnread(count);
      }
    }

    fetchUnread()
    const channel = supabase.channel('unread-badge-global')
      .on('postgres_changes', { event: '*', table: 'chats' }, () => fetchUnread())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, mounted])

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (pathname === href) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('qivo-nav-refresh', { detail: { path: href } }));
    }
  }

  const navItems = [
    { 
      label: "HOME", 
      icon: (active: boolean) => (
        <svg className={cn("w-7 h-7", active ? "text-[#00A2FF] fill-[#00A2FF]" : "text-gray-300")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill={active ? "currentColor" : "none"} />
        </svg>
      ), 
      href: "/home" 
    },
    { 
      label: "CHAT", 
      icon: (active: boolean) => (
        <MessageSquare className={cn("w-7 h-7", active ? "text-[#00A2FF]" : "text-gray-300")} strokeWidth={2.5} />
      ), 
      href: "/chats", 
      badge: totalUnread 
    },
    { 
      label: "ME", 
      icon: (active: boolean) => (
        <User className={cn("w-7 h-7", active ? "text-[#00A2FF]" : "text-gray-300")} strokeWidth={2.5} />
      ), 
      href: "/profile" 
    },
  ]

  if (!mounted) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-gray-100 h-20 flex items-center justify-around px-4 pb-[env(safe-area-inset-bottom,8px)] shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(e) => handleNavClick(e, item.href)}
            className="flex flex-col items-center justify-center flex-1 h-full gap-1.5 transition-all"
          >
            <div className="relative flex items-center justify-center">
              {item.icon(isActive)}
              {item.badge > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black min-w-[15px] h-4 rounded-full flex items-center justify-center border-2 border-white">
                  {item.badge > 9 ? '9+' : item.badge}
                </div>
              )}
            </div>
            <span className={cn(
              "text-[10px] font-black tracking-widest transition-colors", 
              isActive ? "text-[#00A2FF]" : "text-gray-300"
            )}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
