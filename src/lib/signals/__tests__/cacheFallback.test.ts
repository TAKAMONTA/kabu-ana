import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/verifyAuth", () => ({
  getAdminApp: vi.fn(),
}));

import {
  PREVIOUS_SIGNAL_ID,
  readSignalDocWithFallback,
  writeSignalDocWithFallback,
} from "../cache";

describe("signal cache fallbacks", () => {
  it("uses today's signal document when it exists", async () => {
    const reader = vi.fn(async (_collection: string, id: string) =>
      id === "2026-06-17" ? { fetchedAt: "today" } : null
    );

    await expect(
      readSignalDocWithFallback("signals_prices", "2026-06-17", reader)
    ).resolves.toEqual({ fetchedAt: "today" });

    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader).toHaveBeenCalledWith("signals_prices", "2026-06-17");
  });

  it("falls back to the previous successful signal document when today is missing", async () => {
    const reader = vi.fn(async (_collection: string, id: string) =>
      id === PREVIOUS_SIGNAL_ID ? { fetchedAt: "yesterday" } : null
    );

    await expect(
      readSignalDocWithFallback("signals_news", "2026-06-17", reader)
    ).resolves.toEqual({ fetchedAt: "yesterday" });

    expect(reader).toHaveBeenNthCalledWith(1, "signals_news", "2026-06-17");
    expect(reader).toHaveBeenNthCalledWith(
      2,
      "signals_news",
      PREVIOUS_SIGNAL_ID
    );
  });

  it("does not recurse when the requested document is already previous", async () => {
    const reader = vi.fn(async () => null);

    await expect(
      readSignalDocWithFallback("signals_seismic", PREVIOUS_SIGNAL_ID, reader)
    ).resolves.toBeNull();

    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader).toHaveBeenCalledWith("signals_seismic", PREVIOUS_SIGNAL_ID);
  });

  it("writes successful signal payloads to both today and previous", async () => {
    const writer = vi.fn(async () => {});
    const payload = { fetchedAt: "2026-06-17T05:40:00.000Z", items: [] };

    await writeSignalDocWithFallback(
      "signals_news",
      "2026-06-17",
      payload,
      writer
    );

    expect(writer).toHaveBeenNthCalledWith(
      1,
      "signals_news",
      "2026-06-17",
      payload
    );
    expect(writer).toHaveBeenNthCalledWith(
      2,
      "signals_news",
      PREVIOUS_SIGNAL_ID,
      payload
    );
  });

  it("does not double-write when the target document is previous", async () => {
    const writer = vi.fn(async () => {});
    const payload = { fetchedAt: "2026-06-17T05:40:00.000Z", prices: [] };

    await writeSignalDocWithFallback(
      "signals_prices",
      PREVIOUS_SIGNAL_ID,
      payload,
      writer
    );

    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith(
      "signals_prices",
      PREVIOUS_SIGNAL_ID,
      payload
    );
  });
});
