import { CastleRank } from "@/components/castle/types";

/**
 * ランクに応じた城の描写プロンプトを生成
 */
export function generateCastlePrompt(rank: CastleRank, companyName: string): string {
  const baseStyle =
    "Kawaii anime style, Studio Ghibli inspired, Japanese traditional castle (shiro), watercolor painting effect, soft pastel colors, detailed architecture";

  const rankDescriptions: Record<CastleRank, string> = {
    S: `A magnificent, perfect Japanese castle (like Himeji Castle) on a sunny day, pristine white walls, immaculate stone walls with no cracks, golden ornaments on the roof, cherry blossoms blooming around, majestic and grand appearance, clouds of good fortune surrounding the castle, imperial elegance, ${baseStyle}`,

    A: `A strong and well-maintained Japanese castle with solid stone walls, clean white plaster, sturdy wooden structures, beautiful curved roofs with traditional tiles, surrounded by a moat with clear water, pine trees nearby, clear blue sky, ${baseStyle}`,

    B: `A good Japanese castle in decent condition, traditional architecture, stone walls with minor weathering but still solid, white walls with slight aging, well-maintained gardens, peaceful atmosphere, autumn colors, ${baseStyle}`,

    C: `An average Japanese castle with some signs of age, stone walls with visible weathering, some moss growing on the lower walls, a few minor repairs visible, partly cloudy sky, mixed seasons, functional but modest appearance, ${baseStyle}`,

    D: `A neglected Japanese castle in poor condition, cracked stone walls, weeds growing between stones, faded and peeling white walls, some wooden structures showing rot, overcast sky, autumn leaves falling, sense of decline, ${baseStyle}`,

    E: `An abandoned, ruined Japanese castle, collapsed stone walls with large gaps, broken gates hanging off hinges, holes in the roof, empty rice bales, overgrown with vegetation, stormy dark clouds, ravens flying overhead, sense of decay and danger, crumbling towers, ${baseStyle}`,
  };

  return rankDescriptions[rank];
}

/**
 * 画像生成用のシステムプロンプト
 */
export function getImageGenerationSystemPrompt(): string {
  return `You are generating an image of a Japanese castle that represents the financial health of a company. 
The castle should be illustrated in a warm, kawaii anime style inspired by Studio Ghibli.
The condition of the castle reflects the company's financial stability:
- Well-maintained castles represent financially healthy companies
- Damaged or ruined castles represent financially troubled companies
Make sure the image is suitable for a financial analysis application.`;
}

/**
 * ランクに応じた背景色のCSSクラスを取得
 */
export function getRankBackgroundClass(rank: CastleRank): string {
  const backgrounds: Record<CastleRank, string> = {
    S: "from-yellow-100 via-amber-50 to-yellow-100",
    A: "from-purple-100 via-violet-50 to-purple-100",
    B: "from-blue-100 via-sky-50 to-blue-100",
    C: "from-green-100 via-emerald-50 to-green-100",
    D: "from-orange-100 via-amber-50 to-orange-100",
    E: "from-red-100 via-rose-50 to-red-100",
  };
  return backgrounds[rank];
}

/**
 * ランクに応じたボーダー色のCSSクラスを取得
 */
export function getRankBorderClass(rank: CastleRank): string {
  const borders: Record<CastleRank, string> = {
    S: "border-yellow-400",
    A: "border-purple-400",
    B: "border-blue-400",
    C: "border-green-400",
    D: "border-orange-400",
    E: "border-red-400",
  };
  return borders[rank];
}
