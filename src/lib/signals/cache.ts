import { getAdminApp } from "@/lib/auth/verifyAuth";

export interface SignalApiResponse<T> {
  data: T | null;
  error?: string;
  lastSuccessfulAt?: string;
}

export const PREVIOUS_SIGNAL_ID = "previous";

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

type SignalDocReader = (
  collection: string,
  id: string
) => Promise<unknown | null>;
type SignalDocWriter = (
  collection: string,
  id: string,
  data: Record<string, unknown>
) => Promise<void>;

export async function readSignalDocWithFallback<T>(
  collection: string,
  id: string = todayId(),
  reader: SignalDocReader = readSignalDoc
): Promise<T | null> {
  const current = (await reader(collection, id)) as T | null;
  if (current || id === PREVIOUS_SIGNAL_ID) return current;
  return (await reader(collection, PREVIOUS_SIGNAL_ID)) as T | null;
}

export async function writeSignalDocWithFallback(
  collection: string,
  id: string,
  data: Record<string, unknown>,
  writer: SignalDocWriter = writeSignalDoc
): Promise<void> {
  await writer(collection, id, data);
  if (id !== PREVIOUS_SIGNAL_ID) {
    await writer(collection, PREVIOUS_SIGNAL_ID, data);
  }
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
