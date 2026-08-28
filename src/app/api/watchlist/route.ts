import { NextRequest, NextResponse } from "next/server";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAdminApp, isAuthError, verifyAuth } from "@/lib/auth/verifyAuth";
import { normalizeWatchlistCode } from "@/lib/watchlist/codes";
import { canAddMore, FREE_WATCHLIST_LIMIT } from "@/lib/watchlist/limits";

export const dynamic =
  process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

/** 銘柄名の最大長 */
const MAX_NAME_LENGTH = 100;

/** 上限到達をトランザクションの外へ伝えるための番兵 */
class WatchlistLimitError extends Error {}

/**
 * uid から有料判定を行う。
 * uid を受け取る共通関数が無いため、signals/claude-brief と同じ判定をここで行う。
 * 判定できない場合は無料扱い（fail-closed）。
 */
async function isPremiumUser(
  db: ReturnType<typeof getFirestore>,
  uid: string
): Promise<boolean> {
  try {
    const snapshot = await db.collection("subscriptions").doc(uid).get();
    const data = snapshot.data();
    if (!data) return false;
    const active = data.status === "active" || data.status === "trial";
    const notExpired =
      !data.expiryDate || data.expiryDate.toDate() > new Date();
    return active && notExpired;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  const authResult = await verifyAuth(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "銘柄コードと銘柄名が必要です" },
      { status: 400 }
    );
  }

  const code = normalizeWatchlistCode((body as Record<string, unknown>).code);
  const rawName = (body as Record<string, unknown>).name;
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (!code || !name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: "銘柄コードと銘柄名が必要です" },
      { status: 400 }
    );
  }

  try {
    const db = getFirestore(getAdminApp());
    const watchlistRef = db
      .doc(`users/${authResult.uid}`)
      .collection("watchlist");
    const premium = await isPremiumUser(db, authResult.uid);

    // 「存在確認 → 件数 → 書き込み」を1つのトランザクションで行う。
    // 分けて書くと、同時に2回押した無料ユーザーが上限を超えられる。
    await db.runTransaction(async tx => {
      const docRef = watchlistRef.doc(code);
      const existing = await tx.get(docRef);

      if (existing.exists) {
        // 既存の更新は件数が増えないので上限判定をしない。
        // addedAt を書き換えると一覧の並び順が変わるため merge で名前だけ更新する。
        tx.set(docRef, { code, name }, { merge: true });
        return;
      }

      const all = await tx.get(watchlistRef);
      if (!canAddMore(all.size, premium)) {
        throw new WatchlistLimitError();
      }
      tx.set(docRef, {
        code,
        name,
        addedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof WatchlistLimitError) {
      return NextResponse.json(
        {
          error: `無料プランは${FREE_WATCHLIST_LIMIT}銘柄までです`,
          code: "limit_reached",
        },
        { status: 403 }
      );
    }
    console.error(
      "watchlist POST に失敗しました",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "ウォッチリストの更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json({ status: "static_export" });
  }

  const authResult = await verifyAuth(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const code = normalizeWatchlistCode(request.nextUrl.searchParams.get("code"));
  if (!code) {
    return NextResponse.json(
      { error: "銘柄コードが必要です" },
      { status: 400 }
    );
  }

  try {
    const db = getFirestore(getAdminApp());
    await db
      .doc(`users/${authResult.uid}`)
      .collection("watchlist")
      .doc(code)
      .delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "watchlist DELETE に失敗しました",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "ウォッチリストの更新に失敗しました" },
      { status: 500 }
    );
  }
}
