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
      console.error(`Failed to fetch ranking: ${response.status} ${response.statusText}`);
      throw new Error(`failed to fetch ranking: ${response.status}`);
    }

    const html = await response.text();
    if (!html || html.length === 0) {
      console.error("Empty HTML response from kabutan.jp");
      throw new Error("empty HTML response");
    }

    const $ = load(html);

    const items: RankingItem[] = [];

    const $tables = $("table");
    let targetTable: any = null;
    $tables.each((_: number, tableEl: any) => {
      if (targetTable) return;
      const headers = $(tableEl).find("thead tr th");
      const headerTexts = headers
        .map((__: number, th: any) =>
          $(th)
            .text()
            .replace(/\s+/g, "")
            .trim()
        )
        .get();

      const hasTradingValue = headerTexts.some((text: string) =>
        text.includes("売買代金")
      );
      const hasCode = headerTexts.some((text: string) => text.includes("コード"));
      const hasName = headerTexts.some((text: string) => text.includes("銘柄"));

      if (hasTradingValue && hasCode && hasName) {
        targetTable = $(tableEl);
      }
    });

    if (!targetTable) {
      console.error(`Table not found. Found ${$tables.length} table(s) in HTML`);
      console.error("HTML preview:", html.substring(0, 1000));
      throw new Error("ranking table not found");
    }

    const headerIndexMap: Record<
      "code" | "name" | "price" | "change" | "changePercent" | "volume" | "value" | "rank",
      number
    > = {
      rank: 0,
      code: -1,
      name: -1,
      price: -1,
      change: -1,
      changePercent: -1,
      volume: -1,
      value: -1,
    };

    targetTable
      .find("thead tr th")
      .each((index: number, th: any) => {
        const text = $(th)
          .text()
          .replace(/\s+/g, "")
          .trim();
        if (text.includes("順位")) headerIndexMap.rank = index;
        else if (text.includes("コード")) headerIndexMap.code = index;
        else if (text.includes("銘柄")) headerIndexMap.name = index;
        else if (text.includes("株価")) headerIndexMap.price = index;
        else if (text.includes("前日比") || text.includes("値上率"))
          headerIndexMap.change = index;
        else if (text.includes("比") && text.includes("%"))
          headerIndexMap.changePercent = index;
        else if (text.includes("出来高")) headerIndexMap.volume = index;
        else if (text.includes("売買代金")) headerIndexMap.value = index;
      });

    const rows = targetTable.find("tbody > tr");

    rows.each((index: number, element: any) => {
      if (items.length >= 5) return false;

      const cells = $(element).find("td");
      if (cells.length === 0) return;

      const link = $(element)
        .find("a[href*='/stock/?code=']")
        .first();
      if (!link.length) return;

      const name = link.text().trim();
      if (!name) return;

      const href = link.attr("href") || "";
      const codeMatch = href.match(/code=(\d{4})/);

      const getCellText = (idx: number) =>
        idx >= 0 && idx < cells.length
          ? $(cells[idx])
              .text()
              .replace(/\s+/g, " ")
              .trim()
          : "";

      const rankText = getCellText(headerIndexMap.rank);
      const priceRaw = getCellText(headerIndexMap.price);
      const changeRaw = getCellText(headerIndexMap.change);
      const changePercentRaw = getCellText(headerIndexMap.changePercent);
      const volumeRaw = getCellText(headerIndexMap.volume);
      const valueRaw = getCellText(headerIndexMap.value);

      const rank =
        parseInt(rankText.replace(/\D/g, ""), 10) || items.length + 1;
      const code =
        codeMatch?.[1] ||
        getCellText(headerIndexMap.code).replace(/\D/g, "");

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
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack;
    console.error("top-trading-value エラー:", errorMessage);
    if (errorStack) {
      console.error("Error stack:", errorStack);
    }
    return NextResponse.json(
      { items: [], error: "ranking_fetch_failed" },
      { status: 500 }
    );
  }
}

