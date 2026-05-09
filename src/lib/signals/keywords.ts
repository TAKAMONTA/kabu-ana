export const KEYWORD_WEIGHTS: Record<string, number> = {
  Hormuz: 3.0,
  "ホルムズ": 3.0,
  "OPEC+": 2.5,
  OPEC: 2.0,
  "Saudi Aramco": 2.0,
  "サウジ": 1.8,
  UAE: 1.5,
  "Abu Dhabi": 1.5,
  shale: 1.5,
  "シェール": 1.5,
  LNG: 2.0,
  sanction: 2.0,
  "制裁": 2.0,
  tanker: 2.0,
  "タンカー": 2.0,
  "strike on": 3.0,
  "earthquake M7": 2.0,
  "cyber attack": 1.5,
  "grain export": 1.0,
};

export const GEOPOL_KEYWORDS = [
  "sanction",
  "制裁",
  "strike on",
  "missile",
  "war",
  "conflict",
  "OPEC",
  "OPEC+",
  "Saudi Aramco",
  "サウジ",
  "UAE",
];

export const MARITIME_KEYWORDS = ["Hormuz", "ホルムズ", "Strait", "tanker", "タンカー", "missile"];
export const ENERGY_CRITICAL_KEYWORDS = ["OPEC cut", "Hormuz", "ホルムズ", "shale halt"];
export const CYBER_KEYWORDS = ["cyber attack", "ransomware"];

export function findKeywordMatches(text: string): Array<{ keyword: string; weight: number }> {
  const haystack = text.toLowerCase();
  return Object.entries(KEYWORD_WEIGHTS)
    .filter(([keyword]) => haystack.includes(keyword.toLowerCase()))
    .map(([keyword, weight]) => ({ keyword, weight }));
}

export function calculateKeywordWeight(text: string): number {
  return findKeywordMatches(text).reduce((total, match) => total + match.weight, 0);
}
