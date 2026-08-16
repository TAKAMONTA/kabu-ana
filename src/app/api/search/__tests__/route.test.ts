import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// R-1回帰検知: searchResolution.ts の優先順位バグにより、英字の個別株別名
// （TOYOTA/SONY/NTT/MUFG等）が本文言及マッチに到達できず404になっていた。
// dataSource は localJpxStock が truthy になった時点で同期的に "jpx_local" に
// セットされるため、この検証には外部APIキー（J-Quants/EDINET）は不要。
function postSearch(query: string) {
  const request = new NextRequest("http://localhost/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return POST(request);
}

describe("POST /api/search: individual stock resolution via the real handler", () => {
  it('"トヨタ" resolves via jpx_local (7203)', async () => {
    const response = await postSearch("トヨタ");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.metadata.dataSource).toBe("jpx_local");
    expect(body.companyInfo.symbol).toBe("7203");
  }, 20000);

  it('"TOYOTA" (English alias) resolves via jpx_local (7203), not a 404', async () => {
    const response = await postSearch("TOYOTA");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.metadata.dataSource).toBe("jpx_local");
    expect(body.companyInfo.symbol).toBe("7203");
  }, 20000);
});
