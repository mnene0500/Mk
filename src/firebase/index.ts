
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { firebaseConfig } from './config';

/**
 * Idempotent initialization of Firebase services.
 * Returns null for services if the configuration is missing to prevent hard crashes.
 * This is safe to use in both Client Components and Server Actions.
 */
export function initializeFirebase() {
  const apiKey = firebaseConfig.apiKey || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY : undefined);
  const isConfigValid = !!(apiKey && apiKey !== 'undefined' && apiKey !== '');
  
  const nullResult = { 
    firebaseApp: null, 
    firestore: null, 
    auth: null, 
    database: null 
  };

  if (!isConfigValid) {
    return nullResult;
  }

  try {
    let app: FirebaseApp;
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    
    const firestore = getFirestore(app);
    const auth = getAuth(app);
    const database = getDatabase(app);

    return { firebaseApp: app, firestore, auth, database };
  } catch (err: any) {
    console.warn("[Firebase Init Warning]:", err.message);
    return nullResult;
  }
}

// Re-exporting hooks for a clean central API
export { useUser } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useFirestore, useAuth, useDatabase } from './provider';
export { useMemoFirebase } from './utils-client';
