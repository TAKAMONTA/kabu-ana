import { describe, expect, it } from "vitest";
import {
  buildJapaneseSignalTitle,
  getScoreLabelJa,
  getSignalLabelJa,
  localizeSignalKeyword,
  localizeSignalKeywords,
} from "../localize";

describe("signal localization helpers", () => {
  it("maps severity labels to Japanese display text", () => {
    expect(getSignalLabelJa("Critical")).toBe("緊急");
    expect(getSignalLabelJa("Hot")).toBe("注目");
    expect(getSignalLabelJa("Normal")).toBe("通常");
  });

  it("formats score label in Japanese", () => {
    expect(getScoreLabelJa(7)).toBe("重要度 7.0");
    expect(getScoreLabelJa(4.25)).toBe("重要度 4.3");
  });

  it("localizes common English signal keywords", () => {
    expect(localizeSignalKeyword("Hormuz")).toBe("ホルムズ海峡");
    expect(localizeSignalKeyword("tanker")).toBe("タンカー");
    expect(localizeSignalKeyword("missile")).toBe("ミサイル");
    expect(localizeSignalKeyword("LNG")).toBe("LNG");
    expect(localizeSignalKeyword("sanction")).toBe("制裁");
    expect(localizeSignalKeyword("cyber attack")).toBe("サイバー攻撃");
  });

  it("deduplicates localized keyword chips", () => {
    expect(localizeSignalKeywords(["Hormuz", "ホルムズ", "tanker"])).toEqual([
      "ホルムズ海峡",
      "タンカー",
    ]);
  });

  it("builds a Japanese-first headline from common energy signal titles", () => {
    expect(
      buildJapaneseSignalTitle(
        "LNG Tanker Exits Hormuz for India for First Time Since War Began"
      )
    ).toBe("LNGタンカーがホルムズ海峡を通過、供給リスクに注目");
  });

  it("builds Japanese-first headlines for OPEC and sanctions stories", () => {
    expect(
      buildJapaneseSignalTitle("OPEC+ Weighs Deeper Output Cuts as Brent Falls")
    ).toBe("OPECプラスの追加減産観測、原油価格への影響に注目");

    expect(
      buildJapaneseSignalTitle("US Sanctions Hit Russian Oil Tanker Fleet")
    ).toBe("米国制裁がロシア原油タンカー網に影響");
  });

  it("avoids pretending unmatched English headlines are translated", () => {
    expect(buildJapaneseSignalTitle("Company Reports Quarterly Update")).toBe(
      "原文確認: Company Reports Quarterly Update"
    );
  });
});
