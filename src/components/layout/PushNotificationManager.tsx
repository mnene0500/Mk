
"use client"

import { useEffect } from "react"
import { useUser } from "@/firebase/auth/use-user"
import { savePushSubscriptionAction } from "@/app/actions/matchflow-actions"

/**
 * @fileOverview Manages PWA Web Push subscriptions and permissions.
 * Optimized: Explicitly handles permission lifecycle and background registration.
 */
export function PushNotificationManager() {
  const { user } = useUser()

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return
    }

    const initPush = async () => {
      try {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        
        if (Notification.permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        
        if (!vapidPublicKey) {
          console.warn("[Push Manager]: NEXT_PUBLIC_VAPID_PUBLIC_KEY missing.");
          return;
        }

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          });
        }

        const subJson = subscription.toJSON();
        if (subJson.endpoint) {
          await savePushSubscriptionAction(user.id, subJson.endpoint, subJson);
        }
      } catch (err) {
        console.error("[Push Manager]: Registration failed:", err);
      }
    }

    initPush();
  }, [user?.id]);

  return null;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
