"use client";

import { useCallback, useEffect, useState } from "react";
import { CapacitorHttp } from "@capacitor/core";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";
import type { WatchlistQuote } from "@/lib/watchlist/quotesCache";

/** APIの1回あたり上限に合わせた分割サイズ */
const CHUNK_SIZE = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function useWatchlistQuotes(codes: string[]) {
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote | null>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  // 配列の同一性ではなく中身で再取得を判定する
  const key = codes.join(",");

  useEffect(() => {
    if (!key) {
      setQuotes({});
      setFailed(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const responses = await Promise.all(
          chunk(key.split(","), CHUNK_SIZE).map(group =>
            CapacitorHttp.get({
              url: getApiUrl(
                `/api/watchlist/quotes?codes=${encodeURIComponent(
                  group.join(",")
                )}`
              ),
              headers,
            })
          )
        );
        if (cancelled) return;
        if (responses.some(response => response.status >= 400)) {
          setFailed(true);
          return;
        }
        setQuotes(
          Object.assign(
            {},
            ...responses.map(response => response.data?.quotes ?? {})
          )
        );
      } catch (err) {
        if (cancelled) return;
        console.warn("株価の取得に失敗しました", err);
        setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  return { quotes, loading, failed, refresh };
}
