
"use client"

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * @fileOverview Pure Supabase Auth Hook.
 * Manages user identity exclusively via Supabase with enhanced refresh token error handling.
 */
export function useUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // 1. Get initial Supabase session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Auth initialization error:", error.message);
        // FORCE CLEANUP ON REFRESH TOKEN FAILURE
        if (error.message.includes("Refresh Token") || error.status === 400) {
          localStorage.clear();
          sessionStorage.clear();
          supabase.auth.signOut().then(() => window.location.replace("/welcome"));
          return;
        }
      }
      setUser(session?.user || null);
      setLoading(false);
      setIsInitialized(true);
    });

    // 2. Listen for Auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (session?.user) {
        setUser(session.user);
      } else if (event === 'TOKEN_REFRESHED' && !session) {
        setUser(null);
        window.location.replace("/welcome");
      }
      
      setLoading(false);
      setIsInitialized(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, isInitialized };
}
