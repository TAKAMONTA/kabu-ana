/** ダイジェスト生成に渡す1銘柄分の材料 */
export interface DigestStockInput {
  code: string;
  name: string;
  close?: number;
  changePercent?: number;
  /** 株価の基準日（YYYY-MM-DD） */
  asOf?: string;
  headlines: string[];
}

/** name（ユーザー入力）の切り詰め上限 */
const MAX_NAME_LEN = 100;
/** headline（外部ニュース見出し）の切り詰め上限 */
const MAX_HEADLINE_LEN = 120;

/** from〜to（両端含む）の文字を連結した文字列を作る */
const charRange = (from: number, to: number): string =>
  Array.from({ length: to - from + 1 }, (_, i) =>
    String.fromCharCode(from + i)
  ).join("");

/**
 * 空白へ置換する制御文字・不可視文字の正規表現。
 * - U+0000〜U+001F（改行・タブを含む C0 制御）/ U+007F（DEL）
 * - U+0080〜U+009F（C1 制御）
 * - U+200B〜U+200F（ゼロ幅スペース・方向マーク）
 * - U+202A〜U+202E（双方向制御。表示上の文字順を偽装できる）
 * - U+2060（word joiner）/ U+FEFF（BOM・ゼロ幅ノーブレークスペース）
 * ソース上に生の制御バイトを埋め込まないよう charCode から組み立てる。
 */
const UNSAFE_INLINE_CHARS_RE = new RegExp(
  "[" +
    charRange(0, 31) +
    String.fromCharCode(127) +
    charRange(0x80, 0x9f) +
    charRange(0x200b, 0x200f) +
    charRange(0x202a, 0x202e) +
    String.fromCharCode(0x2060) +
    String.fromCharCode(0xfeff) +
    "]",
  "g"
);

/**
 * 制御文字・不可視文字を空白に置換し、連続空白を1つに畳んでから上限で
 * 切り詰める。name はユーザー入力、headlines は外部ニュースの見出しで、
 * どちらも改行やゼロ幅文字が素通りし得るため、行構造の破壊（偽の銘柄行・
 * 偽の制約行の挿入）と不可視文字の混入を防ぐための無害化。
 * 改行を使わないインライン注入（鉤括弧の閉じ開きで指示文を混ぜる等）は
 * ここでは防げない＝完全な注入対策ではない。出力側の zod 検証・表示時の
 * エスケープ・システムプロンプトの禁止事項と合わせて守る。
 */
function sanitizeInlineText(value: string, maxLen: number): string {
  const collapsed = value
    .replace(UNSAFE_INLINE_CHARS_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed.length > maxLen ? collapsed.slice(0, maxLen) : collapsed;
}

/**
 * 朝ダイジェスト用のユーザープロンプトを組み立てる。
 * 出力形式（JSON）と禁止事項（売買推奨）はここで明示する。
 */
export function buildDigestPrompt(stocks: DigestStockInput[]): string {
  const lines = stocks.map(s => {
    const name = sanitizeInlineText(s.name, MAX_NAME_LEN);
    const hasPrice =
      Number.isFinite(s.close) && Number.isFinite(s.changePercent);
    const price = hasPrice
      ? `終値${s.close}円 前日比${(s.changePercent as number).toFixed(2)}%` +
        (s.asOf ? `（${s.asOf}時点）` : "")
      : "株価データなし";
    const headlines = Array.isArray(s.headlines) ? s.headlines : [];
    const news =
      headlines.length > 0
        ? headlines
            .map(h => `「${sanitizeInlineText(h, MAX_HEADLINE_LEN)}」`)
            .join(" / ")
        : "ニュースなし";
    return `- ${s.code} ${name}: ${price} / ニュース: ${news}`;
  });

  return [
    "以下はユーザーがウォッチしている銘柄の前日終値と直近ニュースです。",
    "個人投資家向けの朝のダイジェストを日本語で作ってください。",
    "",
    ...lines,
    "",
    "出力は次のJSONのみ（前後に文章を付けない）:",
    `{"marketLine": "対象銘柄全体を見た1行", "stockLines": [{"code": "銘柄コード", "line": "その銘柄の1行"}], "focusLine": "今日注目すべき点の1行"}`,
    "制約:",
    "- stockLines は入力の全銘柄について1件ずつ、入力と同じ順で",
    "- 各行は事実の整理と注目点の提示にとどめ、売買の推奨や将来の断定はしない",
    "- データなしの銘柄は「データが取得できなかった」ことを正直に書く",
    "- 各行は全角60文字以内",
  ].join("\n");
}
