import { describe, expect, it } from "vitest";
import { maskId, sanitizeError } from "../logSanitizer";

describe("maskId", () => {
  it("末尾4文字のみを残してマスクする", () => {
    expect(maskId("abcd1234")).toBe("...1234");
  });

  it("4文字以下の場合は完全にマスクする", () => {
    expect(maskId("abcd")).toBe("****");
    expect(maskId("abc")).toBe("****");
  });

  it("空文字列はunknownを返す", () => {
    expect(maskId("")).toBe("unknown");
  });

  it("文字列以外の値もStringに変換してマスクする", () => {
    expect(maskId(12345)).toBe("...2345");
    expect(maskId(true)).toBe("****");
  });

  it("nullやundefinedを渡してもTypeErrorにならずunknownを返す", () => {
    expect(() => maskId(null)).not.toThrow();
    expect(() => maskId(undefined)).not.toThrow();
    expect(maskId(null)).toBe("unknown");
    expect(maskId(undefined)).toBe("unknown");
  });
});

describe("sanitizeError", () => {
  it("Errorインスタンスのmessageを返す", () => {
    expect(sanitizeError(new Error("boom"))).toBe("boom");
  });

  it("文字列がthrowされた場合はそのまま返す", () => {
    expect(sanitizeError("plain error string")).toBe("plain error string");
  });

  it("nullがthrowされてもTypeErrorにならない", () => {
    expect(() => sanitizeError(null)).not.toThrow();
    expect(sanitizeError(null)).toBe("null");
  });

  it("undefinedがthrowされてもTypeErrorにならない", () => {
    expect(() => sanitizeError(undefined)).not.toThrow();
    expect(sanitizeError(undefined)).toBe("undefined");
  });

  it("messageプロパティがnullの場合はerror自体を文字列化する", () => {
    expect(sanitizeError({ message: null, toString: () => "fallback" })).toBe(
      "fallback"
    );
  });

  it("200文字を超えるメッセージは200文字に切り詰めた上で省略マーカーを付与する", () => {
    const longMessage = "a".repeat(250);
    const result = sanitizeError(new Error(longMessage));
    expect(result).toBe(`${"a".repeat(200)}…(truncated)`);
    expect(result.endsWith("…(truncated)")).toBe(true);
  });

  it("200文字以下のメッセージは切り詰めない", () => {
    const message = "a".repeat(150);
    expect(sanitizeError(new Error(message))).toBe(message);
  });

  it("idsToMaskで指定した識別子をマスクする", () => {
    const error = new Error(
      "user abcd1234efgh not found in subscriptions/abcd1234efgh"
    );
    const result = sanitizeError(error, ["abcd1234efgh"]);
    expect(result).not.toContain("abcd1234efgh");
    expect(result).toContain("...efgh");
  });

  it("idsToMaskにundefined/nullが混ざっていても安全に無視する", () => {
    const error = new Error("subscriptions/abcd1234 not found");
    const result = sanitizeError(error, [undefined, null, "abcd1234"]);
    expect(result).toBe("subscriptions/...1234 not found");
  });

  it("idsToMask未指定でもマスクなしでメッセージを返す", () => {
    const error = new Error("subscriptions/abcd1234 not found");
    expect(sanitizeError(error)).toBe("subscriptions/abcd1234 not found");
  });

  it("切り詰めより前に識別子をマスクするため識別子の断片が残らない", () => {
    const secretId = "secretUserId1234567890";
    const error = new Error("x".repeat(195) + secretId);
    const result = sanitizeError(error, [secretId]);
    expect(result).not.toContain(secretId);
  });

  it("6文字未満の短いidはマスクをスキップしメッセージを破壊しない", () => {
    const error = new Error("value a appears in this message about a topic");
    const result = sanitizeError(error, ["a"]);
    expect(result).toBe("value a appears in this message about a topic");
  });

  it("6文字以上のidは通常通りマスクされる", () => {
    const error = new Error("session abcdef expired");
    const result = sanitizeError(error, ["abcdef"]);
    expect(result).not.toContain("abcdef");
    expect(result).toContain("...cdef");
  });
});
