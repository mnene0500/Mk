"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { 
  ChevronLeft, 
  Headphones, 
  MessageSquare, 
  ExternalLink, 
  ShieldCheck, 
  Clock, 
  Gem,
  ArrowRight,
  Zap,
  HelpCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * @fileOverview High-end Customer Support page for QIVO.
 * Provides direct WhatsApp integration and service information.
 */
export default function CustomerSupportPage() {
  const router = useRouter()
  
  // Direct support line for the QIVO team
  const handleWhatsAppChat = () => window.open("https://wa.me/254713934404", "_blank")

  return (
    <div className="flex-1 bg-[#F9FAFB] min-h-screen flex flex-col select-none">
      {/* Cinematic Header */}
      <header className="bg-black h-72 relative px-8 pt-16 overflow-hidden">
        {/* Dynamic design elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00A2FF]/30 rounded-full blur-[120px] -mr-32 -mt-32 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] -ml-24 -mb-24" />
        
        <div className="relative z-10 flex flex-col gap-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()} 
            className="text-white rounded-2xl bg-white/10 backdrop-blur-xl hover:bg-white/20 w-12 h-12 border border-white/5 transition-all active:scale-90"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tighter leading-none">Support<br/>Center</h1>
            <div className="flex items-center gap-2">
              <div className="h-1 w-4 bg-[#00A2FF] rounded-full" />
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Available 24/7 for you</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 -mt-16 relative z-20 space-y-6 pb-24">
        {/* Primary Contact Card */}
        <section className="bg-white rounded-[3rem] p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] border border-white flex flex-col items-center text-center space-y-8">
          <div className="relative">
            <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center relative">
              <Headphones className="w-12 h-12 text-[#00A2FF]" />
            </div>
            <div className="absolute -top-1 -right-1 flex h-6 w-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-6 w-6 bg-green-500 border-4 border-white"></span>
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-black tracking-tight">Direct Assistance</h2>
            <p className="text-sm font-medium text-gray-400 leading-relaxed px-2">
              Connect with our live support agents on WhatsApp for instant resolutions to any issues.
            </p>
          </div>

          <Button 
            onClick={handleWhatsAppChat}
            className="w-full h-20 bg-[#25D366] hover:bg-[#128C7E] rounded-[2rem] text-white font-black uppercase tracking-widest text-xs shadow-2xl shadow-green-200 active:scale-95 transition-all flex items-center justify-center gap-4 group"
          >
            <MessageSquare className="w-6 h-6 fill-current" />
            Chat on WhatsApp
            <ExternalLink className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
          </Button>
        </section>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard 
            icon={Clock} 
            title="Fast Response" 
            desc="Avg. 5 mins" 
            iconClass="text-purple-500 bg-purple-50"
          />
          <StatCard 
            icon={ShieldCheck} 
            title="Encrypted" 
            desc="Safe & Private" 
            iconClass="text-emerald-500 bg-emerald-50"
          />
        </div>

        {/* Help Topics */}
        <section className="space-y-3">
          <div className="px-2 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Common Topics</h3>
            <Zap className="w-3 h-3 text-[#00A2FF]" />
          </div>
          
          <div className="bg-white rounded-[2.5rem] p-2 shadow-sm border border-black/5">
            <TopicItem icon={Gem} label="Diamond Withdrawals" onClick={handleWhatsAppChat} />
            <TopicItem icon={Zap} label="Coin Recharge Issues" onClick={handleWhatsAppChat} />
            <TopicItem icon={HelpCircle} label="Account Recovery" onClick={handleWhatsAppChat} />
          </div>
        </section>

        {/* Premium Badge Section */}
        <section className="bg-gradient-to-br from-gray-900 to-black text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-[#00A2FF]/10 rounded-full blur-3xl group-hover:bg-[#00A2FF]/20 transition-all duration-700" />
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10">
                <Gem className="w-6 h-6 text-[#00A2FF]" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-widest leading-none">Priority<br/>Support</h3>
            </div>
            <p className="text-xs font-medium text-white/50 leading-relaxed">
              Vetted Agency members and high-volume users get access to our dedicated priority queue.
            </p>
            <button 
              onClick={handleWhatsAppChat}
              className="flex items-center gap-2 text-[#00A2FF] text-[10px] font-black uppercase tracking-[0.3em] w-fit pt-2 group-hover:gap-4 transition-all"
            >
              Open Priority Ticket
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="p-12 text-center bg-white border-t border-gray-50">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.5em] mb-2">QIVO Global Support</p>
        <p className="text-[10px] font-bold text-gray-400">Direct Line: +254 713 934 404</p>
      </footer>
    </div>
  )
}

function StatCard({ icon: Icon, title, desc, iconClass }: any) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 flex flex-col gap-5 shadow-sm">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", iconClass)}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="space-y-0.5">
        <h3 className="text-[10px] font-black text-black uppercase tracking-widest">{title}</h3>
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{desc}</p>
      </div>
    </div>
  )
}

function TopicItem({ icon: Icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-5 hover:bg-gray-50 rounded-2xl transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-50 group-hover:bg-white rounded-xl flex items-center justify-center transition-colors">
          <Icon className="w-5 h-5 text-gray-400 group-hover:text-[#00A2FF]" />
        </div>
        <span className="text-xs font-bold text-gray-600">{label}</span>
      </div>
      <ChevronRightCustom className="w-4 h-4 text-gray-300 group-hover:text-black group-hover:translate-x-1 transition-all" />
    </button>
  )
}

function ChevronRightCustom(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}
