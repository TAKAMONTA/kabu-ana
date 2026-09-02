"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CapacitorHttp } from "@capacitor/core";
import { getApiUrl, getAuthHeaders } from "@/lib/utils/apiClient";

export interface DigestPayload {
  dateId: string;
  marketLine: string;
  stockLines: Array<{ code: string; name: string; line: string }>;
  focusLine: string;
  codes: string[];
  asOf?: string;
}

type DigestStatus =
  | "idle"
  | "loading"
  | "generating"
  | "ready"
  | "error"
  | "empty";

/** generating 中の自動再取得: 3秒間隔・最大5回（設計書どおり） */
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 5;

export function useDigest(codes: string[]) {
  const [status, setStatus] = useState<DigestStatus>("idle");
  const [digest, setDigest] = useState<DigestPayload | null>(null);
  const [nonce, setNonce] = useState(0);
  const pollCountRef = useRef(0);
  const hasCodes = codes.length > 0;

  useEffect(() => {
    if (!hasCodes) {
      setStatus("idle");
      setDigest(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    pollCountRef.current = 0;

    const fetchOnce = async (retry: boolean) => {
      try {
        if (pollCountRef.current === 0) setStatus("loading");
        const response = await CapacitorHttp.get({
          url: getApiUrl(`/api/digest${retry ? "?retry=1" : ""}`),
          headers: await getAuthHeaders(),
        });
        if (cancelled) return;
        if (response.status >= 400) {
          setStatus("error");
          return;
        }
        const body = response.data ?? {};
        if (body.status === "ready") {
          setDigest(body as DigestPayload);
          setStatus("ready");
        } else if (body.status === "generating") {
          if (pollCountRef.current >= MAX_POLLS) {
            setStatus("error");
            return;
          }
          pollCountRef.current += 1;
          setStatus("generating");
          timer = setTimeout(() => void fetchOnce(false), POLL_INTERVAL_MS);
        } else if (body.status === "empty") {
          setStatus("empty");
        } else {
          setStatus("error");
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("ダイジェストの取得に失敗しました", err);
        setStatus("error");
      }
    };

    // nonce が奇数のときだけ再試行（retry=1）として取得する
    void fetchOnce(nonce % 2 === 1);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hasCodes, nonce]);

  const retry = useCallback(
    () => setNonce(n => (n % 2 === 1 ? n + 2 : n + 1)),
    []
  );

  return { status, digest, retry };
}
