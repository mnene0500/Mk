"use client"
import { useState, useEffect } from 'react'
import { ref, onValue, off } from 'firebase/database'
import { useDatabase } from '@/firebase'

export function useUserPresence(userId?: string) {
  const [presence, setPresence] = useState<{ state: string; lastChanged: number } | null>(null)
  const db = useDatabase()

  useEffect(() => {
    if (!userId) return
    const presenceRef = ref(db, `presence/${userId}`)
    const unsubscribe = onValue(presenceRef, (snap) => {
      if (snap.exists()) {
        setPresence(snap.val())
      } else {
        setPresence({ state: 'offline', lastChanged: Date.now() })
      }
    })
    return () => off(presenceRef, 'value', unsubscribe)
  }, [db, userId])

  return presence
}