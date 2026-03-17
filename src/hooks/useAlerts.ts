"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";

export interface AlertSettings {
  enabled: boolean;
  newsImpactEnabled: boolean;
  financialScoreEnabled: boolean;
  newsImpactThreshold: number;
  financialScoreChangeThreshold: number;
  cooldownMinutes: number;
}

export interface AlertItem {
  id: string;
  type: "news-impact" | "financial-score-change";
  severity: "high" | "medium" | "low";
  symbol: string;
  companyName: string;
  message: string;
  value: number;
  read: boolean;
  readAt?: Date | null;
  createdAt?: Date | null;
}

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: true,
  newsImpactEnabled: true,
  financialScoreEnabled: true,
  newsImpactThreshold: 50,
  financialScoreChangeThreshold: 2,
  cooldownMinutes: 30,
};

export function useAlerts() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setSettings(DEFAULT_ALERT_SETTINGS);
      setAlerts([]);
      setLoading(false);
      return;
    }

    const settingsRef = doc(db, "users", user.uid, "preferences", "alerts");
    const alertsRef = collection(db, "users", user.uid, "alerts");
    const alertsQuery = query(alertsRef, orderBy("createdAt", "desc"), limit(20));

    const unsubscribeSettings = onSnapshot(
      settingsRef,
      (snapshot) => {
        const data = snapshot.data();
        setSettings({
          enabled:
            typeof data?.enabled === "boolean"
              ? data.enabled
              : DEFAULT_ALERT_SETTINGS.enabled,
          newsImpactEnabled:
            typeof data?.newsImpactEnabled === "boolean"
              ? data.newsImpactEnabled
              : DEFAULT_ALERT_SETTINGS.newsImpactEnabled,
          financialScoreEnabled:
            typeof data?.financialScoreEnabled === "boolean"
              ? data.financialScoreEnabled
              : DEFAULT_ALERT_SETTINGS.financialScoreEnabled,
          newsImpactThreshold:
            typeof data?.newsImpactThreshold === "number"
              ? data.newsImpactThreshold
              : DEFAULT_ALERT_SETTINGS.newsImpactThreshold,
          financialScoreChangeThreshold:
            typeof data?.financialScoreChangeThreshold === "number"
              ? data.financialScoreChangeThreshold
              : DEFAULT_ALERT_SETTINGS.financialScoreChangeThreshold,
          cooldownMinutes:
            typeof data?.cooldownMinutes === "number"
              ? data.cooldownMinutes
              : DEFAULT_ALERT_SETTINGS.cooldownMinutes,
        });
      },
      (settingsErr) => {
        console.error("通知設定取得エラー:", settingsErr);
        setError("通知設定の取得に失敗しました");
      }
    );

    const unsubscribeAlerts = onSnapshot(
      alertsQuery,
      (snapshot) => {
        const nextAlerts: AlertItem[] = snapshot.docs.map((alertDoc) => {
          const data = alertDoc.data();
          return {
            id: alertDoc.id,
            type: data.type || "news-impact",
            severity:
              data.severity === "high" ||
              data.severity === "medium" ||
              data.severity === "low"
                ? data.severity
                : "medium",
            symbol: data.symbol || "",
            companyName: data.companyName || data.symbol || "",
            message: data.message || "",
            value: typeof data.value === "number" ? data.value : 0,
            read: Boolean(data.read),
            readAt: data.readAt?.toDate?.() ?? null,
            createdAt: data.createdAt?.toDate?.() ?? null,
          };
        });
        setAlerts(nextAlerts);
        setLoading(false);
        setError(null);
      },
      (alertsErr) => {
        console.error("通知履歴取得エラー:", alertsErr);
        setError("通知履歴の取得に失敗しました");
        setLoading(false);
      }
    );

    return () => {
      unsubscribeSettings();
      unsubscribeAlerts();
    };
  }, [user]);

  const updateSettings = useCallback(
    async (patch: Partial<AlertSettings>) => {
      if (!user || !db) {
        throw new Error("通知設定の変更にはログインが必要です");
      }

      const settingsRef = doc(db, "users", user.uid, "preferences", "alerts");
      await setDoc(
        settingsRef,
        {
          ...patch,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    [user]
  );

  const createAlert = useCallback(
    async (
      payload: Omit<AlertItem, "id" | "createdAt" | "read" | "readAt">,
      options?: { cooldownMinutes?: number }
    ): Promise<boolean> => {
      if (!user || !db) return false;

      const cooldownMinutes = Math.max(1, options?.cooldownMinutes ?? 30);
      const now = Date.now();
      const duplicate = alerts.find((alert) => {
        if (alert.type !== payload.type || alert.symbol !== payload.symbol) {
          return false;
        }
        if (!alert.createdAt) return false;
        return now - alert.createdAt.getTime() < cooldownMinutes * 60 * 1000;
      });
      if (duplicate) {
        return false;
      }

      const alertsRef = collection(db, "users", user.uid, "alerts");
      await addDoc(alertsRef, {
        ...payload,
        read: false,
        createdAt: serverTimestamp(),
      });
      return true;
    },
    [user, alerts]
  );

  const markAsRead = useCallback(
    async (alertId: string) => {
      if (!user || !db) return;
      const firestore = db;
      const alertRef = doc(firestore, "users", user.uid, "alerts", alertId);
      await updateDoc(alertRef, {
        read: true,
        readAt: serverTimestamp(),
      });
    },
    [user]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user || !db) return;
    const firestore = db;

    const unread = alerts.filter((alert) => !alert.read);
    await Promise.all(
      unread.map((alert) => {
        const alertRef = doc(firestore, "users", user.uid, "alerts", alert.id);
        return updateDoc(alertRef, {
          read: true,
          readAt: serverTimestamp(),
        });
      })
    );
  }, [user, alerts]);

  const unreadCount = alerts.filter((alert) => !alert.read).length;

  return {
    settings,
    alerts,
    unreadCount,
    loading,
    error,
    updateSettings,
    createAlert,
    markAsRead,
    markAllAsRead,
  };
}
