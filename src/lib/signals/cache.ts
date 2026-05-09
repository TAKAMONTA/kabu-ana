import { getAdminApp } from "@/lib/auth/verifyAuth";

export interface SignalApiResponse<T> {
  data: T | null;
  error?: string;
  lastSuccessfulAt?: string;
}

export async function getSignalsDb() {
  try {
    const { getFirestore } = await import("firebase-admin/firestore");
    return getFirestore(getAdminApp());
  } catch {
    return null;
  }
}

export async function readSignalDoc<T>(collection: string, id: string): Promise<T | null> {
  const db = await getSignalsDb();
  if (!db) return null;
  const snapshot = await db.collection(collection).doc(id).get();
  return snapshot.exists ? (snapshot.data() as T) : null;
}

export async function writeSignalDoc(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
  const db = await getSignalsDb();
  if (!db) return;
  const { FieldValue } = await import("firebase-admin/firestore");
  await db.collection(collection).doc(id).set(
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export function todayId(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function ok<T>(data: T | null, lastSuccessfulAt?: string): SignalApiResponse<T> {
  return { data, lastSuccessfulAt };
}

export function fail<T>(error: string, lastSuccessfulAt?: string, data: T | null = null): SignalApiResponse<T> {
  return { data, error, lastSuccessfulAt };
}
