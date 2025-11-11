import { NextResponse } from "next/server";
import { load } from "cheerio";

interface RankingItem {
  rank: number;
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  value: number;
  priceDisplay: string;
  changeDisplay: string;
  volumeDisplay: string;
  valueDisplay: string;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TARGET_URL = "https://kabutan.jp/warning/?mode=3_1&market=1";

const normalizeNumber = (raw: string) => {
  const trimmed = raw
    .replace(/[\s,+円株％%万円百万円億万株出来高]/g, "")
    .replace(/[^\d.\-]/g, "");

  if (!trimmed) return 0;

  if (raw.includes("億")) {
    return parseFloat(trimmed) * 100_000_000;
  }
  if (raw.includes("百万円")) {
    return parseFloat(trimmed) * 1_000_000;
  }
  if (raw.includes("万円")) {
    return parseFloat(trimmed) * 10_000;
  }
  if (raw.includes("万株")) {
    return parseFloat(trimmed) * 10_000;
  }

  return parseFloat(trimmed);
};

export async function GET() {
  try {
    const response = await fetch(TARGET_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
        "Accept-Language": "ja-JP,ja;q=0.9",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`failed to fetch ranking: ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);

    const items: RankingItem[] = [];
    const rows = $("table").first().find("tbody > tr");

    rows.each((index, element) => {
      if (items.length >= 5) return false;

      const cells = $(element).find("td");
      if (cells.length < 8) return;

      const rankText = $(cells[0]).text().trim();
      const rank = parseInt(rankText, 10) || index + 1;
      const code = $(cells[1]).text().trim();
      const name = $(cells[2]).text().trim();
      const priceRaw = $(cells[3]).text();
      const changeRaw = $(cells[4]).text();
      const changePercentRaw = $(cells[5]).text();
      const volumeRaw = $(cells[6]).text();
      const valueRaw = $(cells[7]).text();

      const price = normalizeNumber(priceRaw);
      const change = normalizeNumber(changeRaw);
      const changePercent = normalizeNumber(changePercentRaw);
      const volume = normalizeNumber(volumeRaw);
      const value = normalizeNumber(valueRaw);

      items.push({
        rank,
        code,
        name,
        price,
        change,
        changePercent,
        volume,
        value,
        priceDisplay: `${price.toLocaleString()}円`,
        changeDisplay: `${change >= 0 ? "+" : ""}${change.toLocaleString()} (${changePercent.toFixed(2)}%)`,
        volumeDisplay: `${volume.toLocaleString()}株`,
        valueDisplay: `${value.toLocaleString()}円`,
      });
    });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("top-trading-value エラー:", error?.message || error);
    return NextResponse.json(
      { items: [], error: "ranking_fetch_failed" },
      { status: 500 }
    );
  }
}

