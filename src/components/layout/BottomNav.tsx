"use client"
import { useRouter, usePathname } from "next/navigation"
import { Home, MessageSquare, Compass, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Compass, label: "Explore", path: "/explore" },
    { icon: MessageSquare, label: "Chats", path: "/chats" },
    { icon: User, label: "Profile", path: "/profile" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t flex items-center justify-around px-4 z-50">
      {navItems.map((item) => {
        const isActive = pathname === item.path
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              isActive ? "text-[#00A2FF]" : "text-gray-400"
            )}
          >
            <item.icon className={cn("w-6 h-6", isActive && "fill-current")} />
            <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}