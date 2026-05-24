"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Users, Loader2, UserPlus, UserMinus, Search, ShieldCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { toggleUserRoleAction } from "@/app/actions/matchflow-actions"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/firebase/auth/use-user"

interface TargetUser {
  uid: string
  name: string
  match_flow_id: string
  is_coin_seller: boolean
  is_agent: boolean
  is_admin: boolean
}

export default function ManageRolesPage() {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  const [targetId, setTargetId] = useState("")
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!targetId.trim()) return
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from("users")
        .select('uid, name, match_flow_id, is_coin_seller, is_agent, is_admin')
        .eq("match_flow_id", targetId.trim())
        .maybeSingle()
      
      if (data) {
        setTargetUser(data as any)
      } else {
        setTargetUser(null)
        toast({ variant: "destructive", title: "User not found" })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Search Error", description: err.message })
    } finally {
      setSearching(false)
    }
  }

  const handleRoleUpdate = async (role: 'is_coin_seller' | 'is_agent' | 'is_admin', value: boolean) => {
    if (!user || !targetUser) return
    setLoading(true)
    try {
      const result = await toggleUserRoleAction(user.id, targetUser.match_flow_id, role, value)
      if (result.success) {
        toast({ title: "Authority Updated", description: result.message })
        setTargetUser(prev => prev ? { ...prev, [role]: value } : null)
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col select-none">
      <header className="px-4 h-16 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ChevronLeft className="w-6 h-6 text-black" /></Button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Authority Manager</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 p-8 flex flex-col items-center space-y-10">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto">
            <Users className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-black text-black tracking-tight uppercase">Search by Numeric ID</h2>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="flex gap-2">
            <Input 
              placeholder="QIVO Numeric ID" 
              value={targetId} 
              onChange={(e) => setTargetId(e.target.value)} 
              className="rounded-2xl h-14 border-gray-100 bg-gray-50 font-bold" 
            />
            <Button onClick={handleSearch} disabled={searching} className="h-14 w-14 rounded-2xl bg-black">
              {searching ? <Loader2 className="animate-spin text-white" /> : <Search className="w-5 h-5 text-white" />}
            </Button>
          </div>

          {targetUser && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-3xl text-center space-y-1">
                <p className="text-sm font-black text-indigo-900">{targetUser.name}</p>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">ID: {targetUser.match_flow_id}</p>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-2xl border flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <ShieldCheck className="w-5 h-5 text-indigo-600" />
                     <span className="text-[10px] font-black uppercase text-gray-500">System Admin</span>
                   </div>
                   <Button 
                    onClick={() => handleRoleUpdate('is_admin', !targetUser.is_admin)} 
                    disabled={loading}
                    variant={targetUser.is_admin ? "destructive" : "default"}
                    className="h-10 px-6 rounded-full text-[10px] font-black uppercase tracking-widest"
                   >
                     {targetUser.is_admin ? "Demote" : "Promote"}
                   </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-center text-gray-400 uppercase tracking-widest">Merchant</p>
                    {targetUser.is_coin_seller ? (
                      <Button onClick={() => handleRoleUpdate('is_coin_seller', false)} disabled={loading} className="w-full h-14 rounded-2xl bg-red-50 text-red-600 border border-red-100 font-black text-[10px] uppercase gap-2">
                        <UserMinus className="w-4 h-4" /> Revoke
                      </Button>
                    ) : (
                      <Button onClick={() => handleRoleUpdate('is_coin_seller', true)} disabled={loading} className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase gap-2 shadow-lg shadow-blue-100">
                        <UserPlus className="w-4 h-4" /> Appoint
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-center text-gray-400 uppercase tracking-widest">Agency Leader</p>
                    {targetUser.is_agent ? (
                      <Button onClick={() => handleRoleUpdate('is_agent', false)} disabled={loading} className="w-full h-14 rounded-2xl bg-red-50 text-red-600 border border-red-100 font-black text-[10px] uppercase gap-2">
                        <UserMinus className="w-4 h-4" /> Revoke
                      </Button>
                    ) : (
                      <Button onClick={() => handleRoleUpdate('is_agent', true)} disabled={loading} className="w-full h-14 rounded-2xl bg-purple-600 text-white font-black text-[10px] uppercase gap-2 shadow-lg shadow-purple-100">
                        <UserPlus className="w-4 h-4" /> Appoint
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}