"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, MessageSquare, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"

/**
 * @fileOverview High-fidelity Fixed Bottom Navigation.
 * Truly fixed at the bottom with high z-index and optimized layering.
 */
export function BottomNav() {
  const pathname = usePathname()
  const { user } = useUser()
  const [totalUnread, setTotalUnread] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    
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
  }, [user?.id])

  const navItems = [
    { label: "Home", icon: Home, href: "/home" },
    { label: "Chat", icon: MessageSquare, href: "/chats", badge: totalUnread },
    { label: "Me", icon: User, href: "/profile" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-xl border-t h-16 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.06)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href === '/chats' && pathname === '/chats')
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all relative",
              isActive ? "text-[#00A2FF]" : "text-gray-300"
            )}
          >
            <div className={cn(
              "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
              isActive && "bg-blue-50"
            )}>
              <item.icon className={cn("w-6 h-6", isActive ? "text-[#00A2FF] fill-current" : "text-gray-400")} />
              {item.badge !== undefined && item.badge > 0 && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-in zoom-in">
                  {item.badge > 9 ? '9+' : item.badge}
                </div>
              )}
            </div>
            <span className={cn("text-[9px] font-black uppercase tracking-tight", isActive ? "opacity-100" : "opacity-60")}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}