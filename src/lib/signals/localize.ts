import type { EnergyNewsItem } from "./sources/rss";

const LABEL_JA: Record<EnergyNewsItem["label"], string> = {
  Normal: "通常",
  Hot: "注目",
  Critical: "緊急",
};

const KEYWORD_JA: Record<string, string> = {
  Hormuz: "ホルムズ海峡",
  "ホルムズ": "ホルムズ海峡",
  Strait: "海峡",
  tanker: "タンカー",
  LNG: "LNG",
  missile: "ミサイル",
  "OPEC cut": "OPEC減産",
  "OPEC+": "OPECプラス",
  OPEC: "OPEC",
  sanction: "制裁",
  sanctions: "制裁",
  "Saudi Aramco": "サウジアラムコ",
  UAE: "UAE",
  "Abu Dhabi": "アブダビ",
  "strike on": "攻撃",
  "earthquake M7": "M7級地震",
  cyber: "サイバー",
  "cyber attack": "サイバー攻撃",
  ransomware: "ランサムウェア",
  attack: "攻撃",
  war: "戦争",
  conflict: "紛争",
  shale: "シェール",
  "shale halt": "シェール停止",
  "grain export": "穀物輸出",
};

export function getSignalLabelJa(label: EnergyNewsItem["label"]): string {
  return LABEL_JA[label] ?? label;
}

export function getScoreLabelJa(score: number): string {
  return `重要度 ${score.toFixed(1)}`;
}

export function localizeSignalKeyword(keyword: string): string {
  return KEYWORD_JA[keyword] ?? keyword;
}

export function localizeSignalKeywords(keywords: string[]): string[] {
  return Array.from(new Set(keywords.map(localizeSignalKeyword)));
}

export function buildJapaneseSignalTitle(title: string): string {
  const lowerTitle = title.toLowerCase();

  if (
    lowerTitle.includes("lng") &&
    lowerTitle.includes("tanker") &&
    lowerTitle.includes("hormuz")
  ) {
    return "LNGタンカーがホルムズ海峡を通過、供給リスクに注目";
  }

  if (lowerTitle.includes("hormuz") && lowerTitle.includes("tanker")) {
    return "ホルムズ海峡周辺のタンカー動向に注意";
  }

  if (
    lowerTitle.includes("opec") &&
    (lowerTitle.includes("cut") || lowerTitle.includes("output"))
  ) {
    return "OPECプラスの追加減産観測、原油価格への影響に注目";
  }

  if (
    lowerTitle.includes("sanction") &&
    lowerTitle.includes("russian") &&
    (lowerTitle.includes("oil") || lowerTitle.includes("tanker"))
  ) {
    return "米国制裁がロシア原油タンカー網に影響";
  }

  if (lowerTitle.includes("cyber") && lowerTitle.includes("attack")) {
    return "エネルギー関連のサイバー攻撃リスクに注意";
  }

  if (lowerTitle.includes("missile") && lowerTitle.includes("oil")) {
    return "ミサイル攻撃による原油供給リスクに注意";
  }

  const replacements: Array<[RegExp, string]> = [
    [/\bHormuz\b/gi, "ホルムズ海峡"],
    [/\btanker(s)?\b/gi, "タンカー"],
    [/\bLNG\b/g, "LNG"],
    [/\bOPEC\+\b/g, "OPECプラス"],
    [/\bOPEC\b/g, "OPEC"],
    [/\bmissile(s)?\b/gi, "ミサイル"],
    [/\bwar\b/gi, "戦争"],
    [/\bIndia\b/g, "インド"],
    [/\bChina\b/g, "中国"],
    [/\bUS\b/g, "米国"],
    [/\bU\.S\.\b/g, "米国"],
    [/\bRussia\b/g, "ロシア"],
    [/\bIran\b/g, "イラン"],
    [/\bSaudi\b/g, "サウジ"],
    [/\bBrent\b/g, "ブレント原油"],
    [/\bWTI\b/g, "WTI原油"],
    [/\boil\b/gi, "原油"],
    [/\bgas\b/gi, "天然ガス"],
    [/\bsanctions?\b/gi, "制裁"],
    [/\bcyber attack\b/gi, "サイバー攻撃"],
  ];

  let localized = title;
  replacements.forEach(([pattern, replacement]) => {
    localized = localized.replace(pattern, replacement);
  });

  if (localized === title) {
    return `原文確認: ${title}`;
  }

  return localized;
}
