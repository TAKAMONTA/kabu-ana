"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";

const WATCHLIST_LIMITS = {
  FREE_MAX_ITEMS: 3,
} as const;

export interface WatchlistItem {
  id: string;
  symbol: string;
  companyName: string;
  market?: string;
  edinetCode?: string | null;
  latestNewsImpactScore?: number | null;
  latestFinancialOverallScore?: number | null;
  createdAt?: Date | null;
}

function getDocIdFromSymbol(symbol: string): string {
  return encodeURIComponent(symbol.trim().toUpperCase());
}

export function useWatchlist() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setItems([]);
      setLoading(false);
      return;
    }

    const watchlistRef = collection(db, "users", user.uid, "watchlist");
    const q = query(watchlistRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextItems: WatchlistItem[] = snapshot.docs.map((itemDoc) => {
          const data = itemDoc.data();
          return {
            id: itemDoc.id,
            symbol: data.symbol || "",
            companyName: data.companyName || data.symbol || "",
            market: data.market,
            edinetCode: data.edinetCode ?? null,
            latestNewsImpactScore:
              typeof data.latestNewsImpactScore === "number"
                ? data.latestNewsImpactScore
                : null,
            latestFinancialOverallScore:
              typeof data.latestFinancialOverallScore === "number"
                ? data.latestFinancialOverallScore
                : null,
            createdAt: data.createdAt?.toDate?.() ?? null,
          };
        });
        setItems(nextItems);
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("ウォッチリスト取得エラー:", snapshotError);
        setError("ウォッチリストの取得に失敗しました");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const isInWatchlist = useCallback(
    (symbol: string) => {
      const normalized = symbol.trim().toUpperCase();
      return items.some((item) => item.symbol.trim().toUpperCase() === normalized);
    },
    [items]
  );

  const getMaxItems = useCallback(() => {
    return isPremium ? Number.POSITIVE_INFINITY : WATCHLIST_LIMITS.FREE_MAX_ITEMS;
  }, [isPremium]);

  const canAddMore = useCallback(() => {
    return isPremium || items.length < WATCHLIST_LIMITS.FREE_MAX_ITEMS;
  }, [isPremium, items.length]);

  const addToWatchlist = useCallback(
    async (payload: {
      symbol: string;
      companyName: string;
      market?: string;
      edinetCode?: string | null;
    }) => {
      if (!user || !db) {
        throw new Error("ウォッチリスト機能はログインが必要です");
      }

      const normalizedSymbol = payload.symbol.trim().toUpperCase();
      if (!normalizedSymbol) {
        throw new Error("シンボルが不正です");
      }

      if (!isInWatchlist(normalizedSymbol) && !canAddMore()) {
        throw new Error(
          `無料プランの上限(${WATCHLIST_LIMITS.FREE_MAX_ITEMS}銘柄)に達しています`
        );
      }

      const watchlistDocRef = doc(
        db,
        "users",
        user.uid,
        "watchlist",
        getDocIdFromSymbol(normalizedSymbol)
      );

      await setDoc(
        watchlistDocRef,
        {
          symbol: normalizedSymbol,
          companyName: payload.companyName,
          market: payload.market || "",
          edinetCode: payload.edinetCode ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    [user, isInWatchlist, canAddMore]
  );

  const removeFromWatchlist = useCallback(
    async (symbol: string) => {
      if (!user || !db) {
        throw new Error("ウォッチリスト機能はログインが必要です");
      }

      const normalizedSymbol = symbol.trim().toUpperCase();
      if (!normalizedSymbol) return;

      const watchlistDocRef = doc(
        db,
        "users",
        user.uid,
        "watchlist",
        getDocIdFromSymbol(normalizedSymbol)
      );
      await deleteDoc(watchlistDocRef);
    },
    [user]
  );

  const updateWatchlistMetrics = useCallback(
    async (
      symbol: string,
      metrics: {
        latestNewsImpactScore?: number | null;
        latestFinancialOverallScore?: number | null;
      }
    ) => {
      if (!user || !db) {
        throw new Error("ウォッチリスト機能はログインが必要です");
      }

      const normalizedSymbol = symbol.trim().toUpperCase();
      if (!normalizedSymbol) return;

      const watchlistDocRef = doc(
        db,
        "users",
        user.uid,
        "watchlist",
        getDocIdFromSymbol(normalizedSymbol)
      );

      await setDoc(
        watchlistDocRef,
        {
          ...metrics,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    [user]
  );

  return {
    items,
    loading,
    error,
    isPremium,
    isInWatchlist,
    canAddMore,
    addToWatchlist,
    removeFromWatchlist,
    updateWatchlistMetrics,
    freeLimit: WATCHLIST_LIMITS.FREE_MAX_ITEMS,
    maxItems: getMaxItems(),
  };
}
