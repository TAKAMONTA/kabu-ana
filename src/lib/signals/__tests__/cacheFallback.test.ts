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

describe("signal date ids", () => {
  it("uses the JST date (00:00 JST boundary, not 09:00 JST)", async () => {
    const { todayId } = await import("../cache");
    // 2026-11-14 23:59 JST
    expect(todayId(new Date("2026-11-14T14:59:00.000Z"))).toBe("2026-11-14");
    // 2026-11-15 00:00 JST（UTC ではまだ 11-14）
    expect(todayId(new Date("2026-11-14T15:00:00.000Z"))).toBe("2026-11-15");
    // JST 06:00 の cron（21:00 UTC）は JST の当日分に書く
    expect(todayId(new Date("2026-11-14T21:00:00.000Z"))).toBe("2026-11-15");
  });

  it("computes the previous day across month and year boundaries", async () => {
    const { previousDayId } = await import("../cache");
    expect(previousDayId("2026-11-15")).toBe("2026-11-14");
    expect(previousDayId("2026-03-01")).toBe("2026-02-28");
    expect(previousDayId("2027-01-01")).toBe("2026-12-31");
  });
});
