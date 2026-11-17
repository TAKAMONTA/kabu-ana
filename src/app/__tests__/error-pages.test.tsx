import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ErrorPage from "../error";
import GlobalError from "../global-error";
import { getErrorReference } from "@/lib/utils/errorReference";

// jsdom 等は入れていないため、サーバー描画の HTML で中身を確かめる
describe("error pages", () => {
  const secret = "fetch failed: ECONNREFUSED 10.0.0.1 token=abc";

  it("error.tsx shows a Japanese message and retry/home actions without error details", () => {
    const error = Object.assign(new Error(secret), { digest: "1234567890" });
    const html = renderToStaticMarkup(
      <ErrorPage error={error} reset={vi.fn()} retry={vi.fn()} />
    );
    expect(html).toContain("うまく表示できませんでした");
    expect(html).toContain("もう一度試す");
    expect(html).toContain('href="/"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("参照番号: 1234567890");
    expect(html).not.toContain(secret);
    expect(html).not.toContain("ECONNREFUSED");
  });

  it("global-error.tsx renders its own html/body with lang=ja", () => {
    const html = renderToStaticMarkup(
      <GlobalError error={new Error(secret)} reset={vi.fn()} />
    );
    expect(html).toMatch(/^<html lang="ja">/);
    expect(html).toContain("<body");
    expect(html).toContain("もう一度試す");
    expect(html).not.toContain(secret);
    expect(html).not.toContain("参照番号");
  });
});

describe("getErrorReference", () => {
  it("returns only a safe digest", () => {
    expect(getErrorReference({ digest: "abc_123-X" })).toBe("abc_123-X");
    expect(getErrorReference(new Error("x"))).toBeNull();
    expect(getErrorReference("boom")).toBeNull();
    expect(getErrorReference(null)).toBeNull();
    expect(getErrorReference({ digest: 42 })).toBeNull();
    expect(getErrorReference({ digest: "<script>alert(1)</script>" })).toBeNull();
    expect(getErrorReference({ digest: "a".repeat(65) })).toBeNull();
  });
});
