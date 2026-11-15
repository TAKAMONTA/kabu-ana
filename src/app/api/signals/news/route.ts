import { NextResponse } from "next/server";
import {
  fail,
  logSignalError,
  ok,
  readSignalDocWithFallback,
  SIGNAL_FETCH_FAILED_MESSAGE,
  todayId,
  writeSignalDocWithFallback,
} from "@/lib/signals/cache";
import { fetchEnergyNews, type EnergyNewsItem } from "@/lib/signals/sources/rss";
import { buildJapaneseSignalTitle } from "@/lib/signals/localize";

export const dynamic = "force-dynamic";

interface NewsPayload {
  items: EnergyNewsItem[];
  fetchedAt: string;
}

function normalizeNewsPayload(payload: NewsPayload | null): NewsPayload | null {
  if (!payload) return null;

  return {
    ...payload,
    items: payload.items.map(item => ({
      ...item,
      titleJa: buildJapaneseSignalTitle(item.title),
    })),
  };
}

export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(ok<NewsPayload>(null));
  }

  const cached = normalizeNewsPayload(
    await readSignalDocWithFallback<NewsPayload>("signals_news", todayId()).catch(
      () => null
    )
  );
  try {
    const items = await fetchEnergyNews();
    const payload = { items, fetchedAt: new Date().toISOString() };
    await writeSignalDocWithFallback("signals_news", todayId(), payload);
    return NextResponse.json(ok(payload, payload.fetchedAt), {
      headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (error) {
    logSignalError("signals/news: ニュース取得に失敗しました", error);
    return NextResponse.json(
      fail<NewsPayload>(SIGNAL_FETCH_FAILED_MESSAGE, cached?.fetchedAt, cached)
    );
  }
}
