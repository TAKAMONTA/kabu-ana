import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// 空白入力のガードは全ての外部呼び出し（Yahoo/Google RSS/OpenRouter）より前に
// 評価されるため、外部APIキー無しで検証できる。POSTはwithRateLimit/withDailyLimit
// でラップされているが、レート制限は15分100リクエスト/IP+パス、日次制限は
// response.okのときだけ加算されるため、少数の400レスポンスを送るだけの
// このテストでは制限に抵触しない
function postNewsAnalysis(body: unknown) {
  const request = new NextRequest("http://localhost/api/news-analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

/** body: JSON.stringify()を経由せず、生のリクエストボディ文字列をそのまま送る */
function postRawBody(rawBody: string) {
  const request = new NextRequest("http://localhost/api/news-analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody,
  });
  return POST(request);
}

describe("POST /api/news-analysis: blank input guards", () => {
  it('{"symbol":" ","companyName":" "} は400（空白のみはtrim後に空として弾く）', async () => {
    const response = await postNewsAnalysis({ symbol: " ", companyName: " " });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });

  it('{"symbol":"","companyName":"トヨタ自動車"} は400（symbol欠落）', async () => {
    const response = await postNewsAnalysis({
      symbol: "",
      companyName: "トヨタ自動車",
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });

  it('{"symbol":"7203"} は400（companyName欠落）', async () => {
    const response = await postNewsAnalysis({ symbol: "7203" });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });

  it("不正なJSON body は400（従来はrequest.json()が例外を投げ500になっていた）", async () => {
    const response = await postRawBody("not-json");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });

  it("bodyがnullは400（分割代入がTypeErrorにならず400で弾く）", async () => {
    const response = await postNewsAnalysis(null);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("シンボルと企業名が必要です");
  });
});
