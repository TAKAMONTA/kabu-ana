import { describe, expect, it } from "vitest";
import { unwrapSignalResponse } from "../unwrapSignalResponse";

describe("unwrapSignalResponse", () => {
  it("throws the server-provided message for a 503 config-error response", () => {
    expect(() =>
      unwrapSignalResponse(503, { error: "認証サービスが利用できません" })
    ).toThrow("認証サービスが利用できません");
  });

  it("throws the server-provided message for a 401 login-required response", () => {
    expect(() =>
      unwrapSignalResponse(401, {
        error: "認証が必要です。ログインしてください。",
      })
    ).toThrow("認証が必要です。ログインしてください。");
  });

  it("throws HTTP <status> for a non-JSON 503 body instead of returning undefined", () => {
    expect(() =>
      unwrapSignalResponse(503, "<html>Service Unavailable</html>")
    ).toThrow("HTTP 503");
  });

  it("throws the server-provided message for a 200 response with a fail() payload", () => {
    expect(() =>
      unwrapSignalResponse(200, {
        data: null,
        error: "プレミアムユーザーのみ利用できます",
      })
    ).toThrow("プレミアムユーザーのみ利用できます");
  });

  it("returns data for a successful 200 response", () => {
    const payload = { foo: "bar" };
    expect(unwrapSignalResponse(200, { data: payload })).toEqual(payload);
  });

  it("returns null when data.data is null", () => {
    expect(unwrapSignalResponse(200, { data: null })).toBeNull();
  });

  it("throws a generic message for a 2xx non-JSON body", () => {
    expect(() => unwrapSignalResponse(200, "not json")).toThrow(
      "深掘り分析に失敗しました"
    );
  });
});
