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
    
    // まず、thead tr thでヘッダーを探す
    $tables.each((_: number, tableEl: any) => {
      if (targetTable) return;
      const headers = $(tableEl).find("thead tr th");
      if (headers.length === 0) {
        // theadがない場合は、最初の行をヘッダーとして扱う
        const firstRow = $(tableEl).find("tbody tr:first-child, tr:first-child");
        if (firstRow.length > 0) {
          const firstRowCells = $(firstRow[0]).find("th, td");
          const headerTexts = firstRowCells
            .map((__: number, cell: any) =>
              $(cell)
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
            return false; // 見つかったのでループを抜ける
          }
        }
        return;
      }

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
        return false; // 見つかったのでループを抜ける
      }
    });

    // まだ見つからない場合は、より緩い条件で検索
    if (!targetTable) {
      $tables.each((_: number, tableEl: any) => {
        if (targetTable) return false;
        const tableText = $(tableEl).text();
        // 売買代金とコードが含まれていれば候補とする
        if (tableText.includes("売買代金") && tableText.includes("コード")) {
          // リンクが含まれているか確認（銘柄リンクがあるはず）
          const links = $(tableEl).find("a[href*='/stock/?code=']");
          if (links.length > 0) {
            targetTable = $(tableEl);
            return false;
          }
        }
      });
    }

    if (!targetTable) {
      console.error(`Table not found. Found ${$tables.length} table(s) in HTML`);
      // 各テーブルの内容をログに出力
      $tables.each((idx: number, tableEl: any) => {
        const tableText = $(tableEl).text().substring(0, 200);
        console.error(`Table ${idx}:`, tableText);
      });
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

    // ヘッダーを検索（theadがある場合とない場合の両方に対応）
    let headerCells = targetTable.find("thead tr th");
    if (headerCells.length === 0) {
      // theadがない場合は、最初の行をヘッダーとして扱う
      const firstRow = targetTable.find("tbody tr:first-child, tr:first-child");
      if (firstRow.length > 0) {
        headerCells = $(firstRow[0]).find("th, td");
      }
    }

    headerCells.each((index: number, cell: any) => {
      const text = $(cell)
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

    // データ行を取得（theadがない場合は最初の行をスキップ）
    let rows = targetTable.find("tbody > tr");
    const hasThead = targetTable.find("thead").length > 0;
    if (rows.length === 0) {
      rows = targetTable.find("tr");
      // 最初の行がヘッダーの場合はスキップ
      if (!hasThead && rows.length > 0) {
        rows = rows.not(rows.first());
      }
    }

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

