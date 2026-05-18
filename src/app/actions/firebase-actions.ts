'use server';

import { initializeFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc, 
  serverTimestamp,
  addDoc 
} from 'firebase/firestore';
import { 
  ref, 
  update, 
  increment as rtdbIncrement, 
  set, 
  push 
} from 'firebase/database';

/**
 * Administrative and Coin Actions
 */

export async function awardCoinsAction(callerUid: string, targetMatchFlowId: string, amount: number) {
  const { firestore: db, database: rtdb } = initializeFirebase();
  if (amount < 500) return { success: false, error: "Minimum award amount is 500 coins." };
  
  try {
    const callerSnap = await getDoc(doc(db, "users", callerUid));
    const callerData = callerSnap.data();
    if (!callerData?.isAdmin && !callerData?.isCoinSeller) return { success: false, error: "Unauthorized." };

    const targetQuery = query(collection(db, "users"), where("matchFlowId", "==", targetMatchFlowId.trim()));
    const targetSnap = await getDocs(targetQuery);
    if (targetSnap.empty) return { success: false, error: "User not found." };
    const targetUid = targetSnap.docs[0].id;

    await update(ref(rtdb, `balances/${targetUid}`), {
      coins: rtdbIncrement(amount),
      updatedAt: Date.now()
    });

    await set(push(ref(rtdb, `coin_history/${targetUid}`)), {
      amount,
      type: 'award',
      description: `Awarded by ${callerData.isAdmin ? 'Admin' : 'Seller'}`,
      timestamp: Date.now()
    });

    return { success: true, message: `Awarded ${amount} coins.` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleUserRoleAction(callerUid: string, targetMatchFlowId: string, role: 'isCoinSeller' | 'isAgent', value: boolean) {
  const { firestore: db } = initializeFirebase();
  try {
    const callerSnap = await getDoc(doc(db, "users", callerUid));
    if (!callerSnap.data()?.isAdmin) return { success: false, error: "Unauthorized." };

    const targetQuery = query(collection(db, "users"), where("matchFlowId", "==", targetMatchFlowId.trim()));
    const targetSnap = await getDocs(targetQuery);
    if (targetSnap.empty) return { success: false, error: "User not found." };

    await updateDoc(doc(db, "users", targetSnap.docs[0].id), {
      [role]: value,
      updatedAt: serverTimestamp()
    });
    return { success: true, message: "Role updated." };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Agency and Recruitment Actions
 */

export async function createAgencyAction(agentUid: string, agencyName: string) {
  const { firestore: db } = initializeFirebase();
  try {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    await setDoc(doc(db, "agencies", code), { code, agentUid, name: agencyName, createdAt: serverTimestamp() });
    await updateDoc(doc(db, "users", agentUid), { agencyId: code, agencyStatus: 'approved' });
    return { success: true, code };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function requestWithdrawalAction(uid: string, diamonds: number, amountKes: number, agencyId: string) {
  const { firestore: db, database: rtdb } = initializeFirebase();
  try {
    await update(ref(rtdb, `balances/${uid}`), { diamonds: rtdbIncrement(-diamonds) });
    await addDoc(collection(db, "agencies", agencyId, "withdrawals"), { 
      uid, diamonds, amountKes, status: 'pending', createdAt: serverTimestamp() 
    });
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function updateWithdrawalStatusAction(agentUid: string, agencyId: string, withdrawalId: string, status: 'paid' | 'rejected') {
  const { firestore: db, database: rtdb } = initializeFirebase();
  try {
    const withdrawalRef = doc(db, "agencies", agencyId, "withdrawals", withdrawalId);
    const snap = await getDoc(withdrawalRef);
    const data = snap.data();
    if (status === 'rejected') {
      await update(ref(rtdb, `balances/${data?.uid}`), { diamonds: rtdbIncrement(data?.diamonds) });
    }
    await updateDoc(withdrawalRef, { status, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function joinAgencyAction(userUid: string, agencyCode: string) {
  const { firestore: db } = initializeFirebase();
  try {
    await updateDoc(doc(db, "users", userUid), { agencyId: agencyCode, agencyStatus: 'pending' });
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function reviewRecruitmentAction(agentUid: string, targetUid: string, status: 'approved' | 'rejected') {
  const { firestore: db } = initializeFirebase();
  try {
    await updateDoc(doc(db, "users", targetUid), { agencyStatus: status, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
}