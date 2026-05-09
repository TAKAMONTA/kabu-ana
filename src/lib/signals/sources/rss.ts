import { calculateKeywordWeight, findKeywordMatches } from "../keywords";

export interface RssSource {
  id: string;
  name: string;
  url: string;
  weight: number;
}

export interface EnergyNewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  sourceWeight: number;
  publishedAt: string;
  summary: string;
  score: number;
  label: "Normal" | "Hot" | "Critical";
  matchedKeywords: string[];
}

export const RSS_SOURCES: RssSource[] = [
  { id: "reuters-energy", name: "Reuters Energy", url: "https://www.reutersagency.com/feed/?best-topics=energy", weight: 1.0 },
  { id: "bloomberg-energy", name: "Bloomberg Energy", url: "https://feeds.bloomberg.com/markets/news.rss", weight: 1.0 },
  { id: "oilprice", name: "OilPrice.com", url: "https://oilprice.com/rss/main", weight: 0.8 },
  { id: "argus", name: "Argus Media", url: "https://www.argusmedia.com/en/rss", weight: 0.9 },
  { id: "hellenic-shipping", name: "Hellenic Shipping News", url: "https://www.hellenicshippingnews.com/feed/", weight: 0.9 },
  { id: "mees", name: "MEES", url: "https://www.mees.com/rss", weight: 0.9 },
  { id: "energy-voice", name: "Energy Voice", url: "https://www.energyvoice.com/feed/", weight: 0.6 },
  { id: "jogmec", name: "JOGMEC", url: "https://www.jogmec.go.jp/news/release/news.xml", weight: 0.7 },
  { id: "reuters-world", name: "Reuters World", url: "https://www.reutersagency.com/feed/?best-topics=world", weight: 0.8 },
  { id: "bbc-world", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", weight: 0.7 },
  { id: "ap", name: "AP News", url: "https://apnews.com/hub/ap-top-news?output=rss", weight: 0.7 },
];

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function tagValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeEntities(match?.[1] ?? "");
}

export function parseRssFeed(xml: string, source: RssSource): EnergyNewsItem[] {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];
  return itemMatches.map((itemXml, index) => {
    const title = tagValue(itemXml, "title");
    const link = tagValue(itemXml, "link") || itemXml.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "";
    const publishedRaw = tagValue(itemXml, "pubDate") || tagValue(itemXml, "updated") || tagValue(itemXml, "published");
    const summary = tagValue(itemXml, "description") || tagValue(itemXml, "summary") || tagValue(itemXml, "content:encoded");
    const publishedAt = publishedRaw ? new Date(publishedRaw).toISOString() : new Date().toISOString();
    const text = `${title} ${summary}`;
    const keywordWeight = calculateKeywordWeight(text);
    const score = Math.round(source.weight * keywordWeight * 10) / 10;
    const label: EnergyNewsItem["label"] = score >= 7 ? "Critical" : score >= 4 ? "Hot" : "Normal";
    return {
      id: `${source.id}-${Buffer.from(`${link || title}-${index}`).toString("base64url").slice(0, 24)}`,
      title,
      link,
      source: source.name,
      sourceWeight: source.weight,
      publishedAt,
      summary,
      score,
      label,
      matchedKeywords: findKeywordMatches(text).map((match) => match.keyword),
    };
  }).filter((item) => item.title);
}

export async function fetchEnergyNews(): Promise<EnergyNewsItem[]> {
  const settled = await Promise.allSettled(
    RSS_SOURCES.map(async (source) => {
      const response = await fetch(source.url, { next: { revalidate: 900 } });
      if (!response.ok) throw new Error(`${source.name} RSS failed: ${response.status}`);
      return parseRssFeed(await response.text(), source);
    })
  );

  return settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => b.score - a.score || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 50);
}
