"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * @fileOverview Redirects users away from the PesaPal admin diagnostic page.
 */
export default function PesaPalAdminPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.push("/home")
  }, [router])

  return null
}