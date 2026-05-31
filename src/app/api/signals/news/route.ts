import { NextResponse } from "next/server";
import { fail, ok, readSignalDoc, todayId, writeSignalDoc } from "@/lib/signals/cache";
import { fetchEnergyNews, type EnergyNewsItem } from "@/lib/signals/sources/rss";
import { buildJapaneseSignalTitle } from "@/lib/signals/localize";

export const dynamic = process.env.EXPORT_STATIC === "true" ? "force-static" : "force-dynamic";

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
      titleJa: item.titleJa || buildJapaneseSignalTitle(item.title),
    })),
  };
}

export async function GET() {
  if (process.env.EXPORT_STATIC === "true") {
    return NextResponse.json(ok<NewsPayload>(null));
  }

  const cached = normalizeNewsPayload(await readSignalDoc<NewsPayload>("signals_news", todayId()));
  try {
    const items = await fetchEnergyNews();
    const payload = { items, fetchedAt: new Date().toISOString() };
    await writeSignalDoc("signals_news", todayId(), payload);
    return NextResponse.json(ok(payload, payload.fetchedAt), {
      headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (error) {
    return NextResponse.json(
      fail<NewsPayload>(error instanceof Error ? error.message : "ニュース取得に失敗しました", cached?.fetchedAt, cached)
    );
  }
}
