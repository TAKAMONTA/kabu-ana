import { useState, useCallback } from "react";
import { getApiUrl } from "@/lib/utils/apiClient";
import { EdinetTextBlock } from "@/lib/api/edinetdb";

export interface AISummary {
  summary?: string;
  businessModel?: string;
  keyRisks?: string[];
  growthDrivers?: string[];
  investmentPoints?: string[];
}

export function useTextBlocks() {
  const [textBlocks, setTextBlocks] = useState<EdinetTextBlock[]>([]);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTextBlocks = useCallback(async (edinetCode: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl(`/api/text-blocks?edinet_code=${edinetCode}`));
      if (!res.ok) throw new Error("有報テキストの取得に失敗しました");
      const data = await res.json();
      setTextBlocks(data.data || []);
    } catch (err: any) {
      setError(err.message || "有報テキストの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const summarizeWithAI = useCallback(async (edinetCode: string, companyName: string) => {
    setIsSummarizing(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/text-blocks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edinetCode,
          companyName,
          sections: textBlocks.length > 0 ? textBlocks : undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "AI要約に失敗しました");
      }
      const data = await res.json();
      if (data.textBlocks && textBlocks.length === 0) {
        setTextBlocks(data.textBlocks);
      }
      setAiSummary(data.aiSummary);
    } catch (err: any) {
      setError(err.message || "AI要約に失敗しました");
    } finally {
      setIsSummarizing(false);
    }
  }, [textBlocks]);

  const clear = useCallback(() => {
    setTextBlocks([]);
    setAiSummary(null);
    setError(null);
  }, []);

  return { textBlocks, aiSummary, isLoading, isSummarizing, error, fetchTextBlocks, summarizeWithAI, clear };
}
