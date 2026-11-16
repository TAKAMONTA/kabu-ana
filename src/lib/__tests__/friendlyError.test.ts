import { describe, expect, it } from "vitest";
import {
  NETWORK_ERROR_MESSAGE,
  RATE_LIMIT_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
  toFriendlyErrorMessage,
} from "../friendlyError";

const FALLBACK = "検索中にエラーが発生しました";

describe("toFriendlyErrorMessage", () => {
  it("ブラウザ由来の通信エラーを日本語の案内に置き換える", () => {
    expect(toFriendlyErrorMessage("Failed to fetch", FALLBACK)).toBe(
      NETWORK_ERROR_MESSAGE
    );
    expect(toFriendlyErrorMessage("Load failed", FALLBACK)).toBe(
      NETWORK_ERROR_MESSAGE
    );
  });

  it("レート制限はサーバー文言でも待ち時間の案内に統一する", () => {
    expect(
      toFriendlyErrorMessage(
        "レート制限に達しました。しばらく時間をおいてから再試行してください。",
        FALLBACK
      )
    ).toBe(RATE_LIMIT_ERROR_MESSAGE);
    expect(toFriendlyErrorMessage("Too Many Requests", FALLBACK)).toBe(
      RATE_LIMIT_ERROR_MESSAGE
    );
  });

  it("タイムアウトは待って再試行する案内にする", () => {
    expect(toFriendlyErrorMessage("Request timed out", FALLBACK)).toBe(
      TIMEOUT_ERROR_MESSAGE
    );
  });

  it("サーバーが返した日本語メッセージはそのまま使う", () => {
    expect(
      toFriendlyErrorMessage("企業情報が見つかりませんでした", FALLBACK)
    ).toBe("企業情報が見つかりませんでした");
  });

  it("環境変数名やAPIキーの設定状況は日本語でも利用者に見せない", () => {
    expect(
      toFriendlyErrorMessage(
        "EIA_API_KEY または FRED_API_KEY が未設定です",
        FALLBACK
      )
    ).toBe(FALLBACK);
    expect(
      toFriendlyErrorMessage(
        "OpenRouterのAPIキーが未設定です。.env.localファイルに設定してください。",
        FALLBACK
      )
    ).toBe(FALLBACK);
    expect(toFriendlyErrorMessage("APIキーが無効です", FALLBACK)).toBe(
      FALLBACK
    );
  });

  it("HTTP ステータスや fetch failed などの技術的な文言は既定文言にする", () => {
    expect(toFriendlyErrorMessage("HTTP 500", FALLBACK)).toBe(FALLBACK);
    expect(
      toFriendlyErrorMessage(
        "ランキングの取得に失敗しました（ステータス: 503）",
        FALLBACK
      )
    ).toBe(FALLBACK);
    expect(toFriendlyErrorMessage("fetch failed", FALLBACK)).toBe(FALLBACK);
    // 429 は従来どおり待ち時間の案内
    expect(toFriendlyErrorMessage("HTTP 429", FALLBACK)).toBe(
      RATE_LIMIT_ERROR_MESSAGE
    );
  });

  it("技術的な英語や空文字は既定文言にする", () => {
    expect(toFriendlyErrorMessage("Unexpected token < in JSON", FALLBACK)).toBe(
      FALLBACK
    );
    expect(toFriendlyErrorMessage("", FALLBACK)).toBe(FALLBACK);
    expect(toFriendlyErrorMessage(null, FALLBACK)).toBe(FALLBACK);
  });
});
