import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const searchCompanyMock = vi.fn();

vi.mock("@/lib/api/marketDataClient", () => ({
  createMarketDataClient: () => ({ searchCompany: searchCompanyMock }),
}));

import { POST } from "../route";

let ipCounter = 0;
function postSuggestions(body: unknown) {
  ipCounter += 1;
  return POST(
    new NextRequest("http://localhost/api/search-suggestions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `198.51.100.${ipCounter}`,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/search-suggestions", () => {
  beforeEach(() => {
    searchCompanyMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 400 for a non-string query", async () => {
    const response = await postSuggestions({ query: 123 });
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).not.toContain("expected");
    expect(searchCompanyMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an oversized query", async () => {
    const response = await postSuggestions({ query: "a".repeat(10_000) });
    expect(response.status).toBe(400);
    expect(searchCompanyMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid JSON body (previously a 500 with the raw error)", async () => {
    const response = await postSuggestions("{not json");
    expect(response.status).toBe(400);
  });

  it("returns no suggestions (not an error) for short or unsupported input while typing", async () => {
    for (const query of ["ト", "🚀🚀"]) {
      const response = await postSuggestions({ query });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ suggestions: [] });
    }
    expect(searchCompanyMock).not.toHaveBeenCalled();
  });

  it("returns the market data suggestion for a valid query", async () => {
    searchCompanyMock.mockResolvedValue({ symbol: "7203", name: "トヨタ自動車" });
    const response = await postSuggestions({ query: "トヨタ" });
    expect(response.status).toBe(200);
    expect((await response.json()).suggestions[0]).toMatchObject({
      symbol: "7203",
      companyName: "トヨタ自動車",
    });
    expect(response.headers.get("X-RateLimit-Limit")).not.toBeNull();
  });

  it("does not leak upstream error messages", async () => {
    searchCompanyMock.mockRejectedValue(new Error("upstream secret detail"));
    const response = await postSuggestions({ query: "トヨタ" });
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("secret");
  });
});
