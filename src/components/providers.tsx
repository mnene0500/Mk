'use client';

import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { usePresence } from '@/hooks/use-presence';
import { InstallPrompt } from '@/components/layout/InstallPrompt';
import { CallManager } from '@/components/CallManager';

/**
 * Handles global user presence heartbeat.
 */
function PresenceManager({ children }: { children: React.ReactNode }) {
  usePresence();
  return <>{children}</>;
}

/**
 * Root providers wrapper for the application.
 * Supabase handles auth and database via the single client in @/lib/supabase.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PresenceManager>
      <div className="native-page-transition flex-1 flex flex-col">
        {children}
      </div>
      <Toaster />
      <InstallPrompt />
      <CallManager />
    </PresenceManager>
  );
}
