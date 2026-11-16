import { getAdminApp } from "@/lib/auth/verifyAuth";
import { FirebaseAdminConfigError } from "@/lib/firebase/admin";
import { jstDateId } from "@/lib/digest/dateId";
import { sanitizeError } from "@/lib/utils/logSanitizer";

export interface SignalApiResponse<T> {
  data: T | null;
  error?: string;
  lastSuccessfulAt?: string;
}

export const PREVIOUS_SIGNAL_ID = "previous";

/** 外部データの取得に失敗したときにクライアントへ返す固定文言 */
export const SIGNAL_FETCH_FAILED_MESSAGE =
  "データを取得できませんでした。時間をおいて再度お試しください。";
/** APIキー未設定など、設定が整っていないときにクライアントへ返す固定文言 */
export const SIGNAL_NOT_CONFIGURED_MESSAGE = "現在このデータは準備中です";

/**
 * シグナル系ルートの失敗をサーバーログに残す（詳細はクライアントに返さない）。
 * error.message には上流のURL・ステータス・"fetch failed" 等が入るため、
 * レスポンスには SIGNAL_FETCH_FAILED_MESSAGE などの固定文言を使うこと。
 */
export function logSignalError(label: string, error: unknown): void {
  console.error(`${label}: ${sanitizeError(error)}`);
}

/** 同時に呼ばれても動的 import を1本にまとめる */
let firestoreModule: Promise<typeof import("firebase-admin/firestore")> | null =
  null;

export async function getSignalsDb() {
  try {
    firestoreModule ??= import("firebase-admin/firestore").catch(error => {
      firestoreModule = null; // 失敗した import を使い回さない
      throw error;
    });
    const { getFirestore } = await firestoreModule;
    return getFirestore(getAdminApp());
  } catch (error) {
    if (error instanceof FirebaseAdminConfigError) {
      console.error(
        "getSignalsDb: Firebase Admin SDKの設定エラーのためシグナルキャッシュを無効化します"
      );
    }
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

/**
 * シグナルの日付ID（JST の YYYY-MM-DD）。
 * UTC の日付だと日本時間 09:00 に日付が切り替わり、朝のブリーフ（JST 06:00 の cron）が
 * 前日扱いの文書に書かれてしまうため、JST に揃える。
 */
export function todayId(date = new Date()): string {
  return jstDateId(date.getTime());
}

/** 日付ID（YYYY-MM-DD）の前日 */
export function previousDayId(dateId: string): string {
  const time = Date.parse(`${dateId}T00:00:00.000Z`);
  return new Date(time - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function ok<T>(data: T | null, lastSuccessfulAt?: string): SignalApiResponse<T> {
  return { data, lastSuccessfulAt };
}

export function fail<T>(error: string, lastSuccessfulAt?: string, data: T | null = null): SignalApiResponse<T> {
  return { data, error, lastSuccessfulAt };
}
