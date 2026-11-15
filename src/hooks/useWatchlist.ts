"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { CapacitorHttp } from "@capacitor/core";
import { db } from "@/lib/firebase";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import {
  canAddMore,
  watchlistLimit,
  FREE_WATCHLIST_LIMIT,
} from "@/lib/watchlist/limits";
import { normalizeWatchlistCode } from "@/lib/watchlist/codes";
import { toFriendlyErrorMessage } from "@/lib/friendlyError";

const ADD_ERROR_FALLBACK =
  "ウォッチリストに登録できませんでした。もう一度お試しください。";
const REMOVE_ERROR_FALLBACK =
  "ウォッチリストから削除できませんでした。もう一度お試しください。";

export interface WatchlistItem {
  code: string;
  name: string;
  addedAt: Date | null;
}

export function useWatchlist() {
  const { user } = useAuth();
  const { isPremium, loading: subscriptionLoading } = useSubscription();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 楽観更新中に一覧へ上乗せする項目 */
  const [pending, setPending] = useState<WatchlistItem[]>([]);
  /** 削除中に一覧から隠すコード */
  const [removing, setRemoving] = useState<string[]>([]);

  useEffect(() => {
    if (!user || !db) {
      setItems([]);
      setLoading(false);
      return;
    }

    const watchlistQuery = query(
      collection(db, "users", user.uid, "watchlist"),
      orderBy("addedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      watchlistQuery,
      snapshot => {
        setItems(
          snapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            return {
              code: typeof data.code === "string" ? data.code : docSnapshot.id,
              name: typeof data.name === "string" ? data.name : docSnapshot.id,
              addedAt: data.addedAt?.toDate?.() ?? null,
            };
          })
        );
        setLoading(false);
      },
      err => {
        console.error("ウォッチリストの購読に失敗しました", err);
        setError("ウォッチリストを読み込めませんでした");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  /** 楽観更新を反映した表示用リスト */
  const visibleItems = useMemo(() => {
    const merged = [
      ...pending,
      ...items.filter(item => !pending.some(p => p.code === item.code)),
    ];
    return merged.filter(item => !removing.includes(item.code));
  }, [items, pending, removing]);

  const limit = watchlistLimit(isPremium);
  const canAdd = canAddMore(visibleItems.length, isPremium);

  const has = useCallback(
    (code: string) => {
      const normalized = normalizeWatchlistCode(code);
      if (!normalized) return false;
      return visibleItems.some(item => item.code === normalized);
    },
    [visibleItems]
  );

  const add = useCallback(
    async (code: string, name: string) => {
      const normalized = normalizeWatchlistCode(code);
      if (!user || !normalized) return;

      // 課金情報の読み込み中は isPremium が暫定的に false になるため、
      // ここでの事前判定はスキップしてAPIに進む（サーバー判定が正）。
      if (!subscriptionLoading && !has(normalized) && !canAdd) {
        setError(`無料プランは${FREE_WATCHLIST_LIMIT}銘柄までです`);
        return;
      }

      setError(null);
      setPending(prev => [
        { code: normalized, name, addedAt: new Date() },
        ...prev,
      ]);

      try {
        const response = await CapacitorHttp.post({
          url: getApiUrl("/api/watchlist"),
          headers: await getAuthHeaders(),
          data: { code: normalized, name },
        });
        if (response.status >= 400) {
          throw new Error(response.data?.error ?? ADD_ERROR_FALLBACK);
        }
      } catch (err) {
        setError(
          toFriendlyErrorMessage(
            err instanceof Error ? err.message : null,
            ADD_ERROR_FALLBACK
          )
        );
      } finally {
        // 成功時は onSnapshot が items を更新するので、楽観分は必ず外す
        setPending(prev => prev.filter(item => item.code !== normalized));
      }
    },
    [user, has, canAdd, subscriptionLoading]
  );

  const remove = useCallback(
    async (code: string) => {
      const normalized = normalizeWatchlistCode(code);
      if (!user || !normalized) return;

      setError(null);
      setRemoving(prev => [...prev, normalized]);

      try {
        const response = await CapacitorHttp.request({
          method: "DELETE",
          url: getApiUrl(
            `/api/watchlist?code=${encodeURIComponent(normalized)}`
          ),
          headers: await getAuthHeaders(),
        });
        if (response.status >= 400) {
          throw new Error(response.data?.error ?? REMOVE_ERROR_FALLBACK);
        }
      } catch (err) {
        setError(
          toFriendlyErrorMessage(
            err instanceof Error ? err.message : null,
            REMOVE_ERROR_FALLBACK
          )
        );
      } finally {
        setRemoving(prev => prev.filter(c => c !== normalized));
      }
    },
    [user]
  );

  const clearError = useCallback(() => setError(null), []);

  const isBusy = useCallback(
    (code: string) => {
      const normalized = normalizeWatchlistCode(code);
      if (!normalized) return false;
      return (
        pending.some(item => item.code === normalized) ||
        removing.includes(normalized)
      );
    },
    [pending, removing]
  );

  return {
    items: visibleItems,
    loading,
    error,
    limit,
    canAdd,
    has,
    add,
    remove,
    clearError,
    isBusy,
  };
}
