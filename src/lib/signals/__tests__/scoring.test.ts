import { describe, expect, it } from "vitest";
import { claudeMorningBriefSchema } from "../claude";
import { calculateRiskVector, compositeScore, zscore } from "../scoring";

describe("signals scoring", () => {
  it("calculates zscore against a baseline", () => {
    expect(zscore(4, [1, 2, 3])).toBeCloseTo(2.45, 1);
  });

  it("blocks scores while baseline is collecting", () => {
    const result = calculateRiskVector({
      prices: {},
      baseline: {
        wtiChanges30d: [],
        brentChanges30d: [],
        natGasChanges30d: [],
        gasolineInventoryChanges30d: [],
        geopolNewsVolume14d: [],
        daysCollected: 13,
      },
      news: [],
      earthquakes: [],
    });

    expect(result.baselineReady).toBe(false);
    expect(result.risk).toBeNull();
  });

  it("promotes high risk dimensions and critical news to anomalies", () => {
    const now = Date.now();
    const result = calculateRiskVector(
      {
        prices: { wti24hChange: 6, brent24hChange: 6, natGas24hChange: 2, gasolineInventoryChange: -500 },
        baseline: {
          wtiChanges30d: Array.from({ length: 30 }, (_, index) => index % 2),
          brentChanges30d: Array.from({ length: 30 }, (_, index) => index % 2),
          natGasChanges30d: Array.from({ length: 30 }, (_, index) => index * 0.01),
          gasolineInventoryChanges30d: Array.from({ length: 30 }, (_, index) => index),
          geopolNewsVolume14d: Array.from({ length: 14 }, () => 1),
          daysCollected: 14,
        },
        news: [{
          title: "Hormuz tanker missile cyber attack",
          score: 7,
          publishedAt: new Date(now).toISOString(),
        }],
        earthquakes: [{ magnitude: 7.1, time: new Date(now).toISOString() }],
      },
      now
    );

    expect(result.baselineReady).toBe(true);
    expect(result.risk?.energy).toBe(10);
    expect(result.anomalies.some((item) => item.score >= 7)).toBe(true);
  });

  it("weights composite by the approved vector", () => {
    expect(compositeScore({ geopol: 10, energy: 8, maritime: 0, disaster: 0, cyber: 0 })).toBe(5);
  });
});

describe("claudeMorningBriefSchema", () => {
  it("欠損 ticker の行は捨て、ticker と direction が揃った行のみ残す", () => {
    const parsed = claudeMorningBriefSchema.parse({
      headline_jp: "地政リスク注視",
      summary_jp: "エネルギー価格と地政が交錯し市場は不安定。短期は需給と政策を注視。",
      key_drivers: [],
      stocks_to_watch: [{ reason: "テストのみ" }, { ticker: "7203", reason: "円安", direction: "up" }],
      risk_outlook: "elevated",
    });

    expect(parsed.stocks_to_watch).toHaveLength(1);
    expect(parsed.stocks_to_watch[0]).toMatchObject({
      ticker: "7203",
      reason: "円安",
      direction: "up",
    });
  });

  it("ticker はあるが direction 欠損のとき watch にフォールバック", () => {
    const parsed = claudeMorningBriefSchema.parse({
      headline_jp: "見出し12345",
      summary_jp: "x".repeat(50),
      stocks_to_watch: [{ ticker: "9984", reason: "様子見" }],
      risk_outlook: "low",
    });
    expect(parsed.stocks_to_watch).toEqual([{ ticker: "9984", reason: "様子見", direction: "watch" }]);
  });
});
