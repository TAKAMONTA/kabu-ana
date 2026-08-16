/**
 * 検索解決の総当たり検証で使う共通ロジック。
 *
 * 既定スイート（searchCoverage.test.ts）と全件スキャン
 * （searchCoverage.fullscan.test.ts）の双方から読み込み、
 * 「サンプルでは緑なのに全件では赤」という乖離が起きないよう
 * 判定ロジックを1箇所に固定する。
 *
 * 拡張子が `.test.ts` ではないため vitest の include には拾われない。
 */
import { resolveSearchQuery } from "../searchResolution";
import {
  JPX_STOCK_BY_CODE,
  JPX_STOCK_MASTER,
  normalizeStockText,
  type JpxAssetType,
  type JpxStock,
} from "../stockMaster";

export interface ResolvedTarget {
  code: string;
  assetType: JpxAssetType | null;
}

/**
 * resolveSearchQuery の戻り値を「最終的にどの銘柄コードへ落ちたか」に畳む。
 * 個別株は localJpxStock、ETF/REIT等は etfCode に載るため、両方を吸収する。
 */
export function resolveToTarget(query: string): ResolvedTarget | null {
  const result = resolveSearchQuery(query);
  if (result.localJpxStock) {
    return {
      code: result.localJpxStock.code,
      assetType: result.localJpxStock.assetType,
    };
  }
  if (result.etfCode) {
    return {
      code: result.etfCode,
      assetType: JPX_STOCK_BY_CODE.get(result.etfCode)?.assetType ?? null,
    };
  }
  return null;
}

function isEquity(assetType: JpxAssetType | null): boolean {
  return assetType === "equity";
}

export interface ResolutionMiss {
  /** 検索に使ったクエリ（銘柄名または別名） */
  query: string;
  /** 本来解決されるべきコード */
  expectedCode: string;
  expectedName: string;
  expectedAssetType: JpxAssetType;
  /** 実際に解決されたコード（null は未解決） */
  actualCode: string | null;
  actualAssetType: JpxAssetType | null;
  /** 個別株⇄ETF等をまたいで奪われた場合 true */
  crossAsset: boolean;
}

export interface ResolutionReport {
  total: number;
  ok: number;
  misses: ResolutionMiss[];
  /** MISS のうち個別株⇄非個別株をまたいだもの（ステップ4の衝突指標） */
  crossAssetMisses: ResolutionMiss[];
}

export interface ScanOptions {
  /** 銘柄名に加えて別名（CURATED_STOCK_ALIASES 由来）も検証する */
  includeAliases?: boolean;
}

/** 与えられた銘柄群について「名称（＋別名）→ 自コード」の総当たりを行う。 */
export function scanSelfResolution(
  stocks: JpxStock[],
  options: ScanOptions = {}
): ResolutionReport {
  const misses: ResolutionMiss[] = [];
  let total = 0;

  for (const stock of stocks) {
    const queries = options.includeAliases
      ? [stock.name, ...stock.aliases]
      : [stock.name];

    for (const query of queries) {
      total += 1;
      const actual = resolveToTarget(query);
      if (actual?.code === stock.code) continue;

      misses.push({
        query,
        expectedCode: stock.code,
        expectedName: stock.name,
        expectedAssetType: stock.assetType,
        actualCode: actual?.code ?? null,
        actualAssetType: actual?.assetType ?? null,
        crossAsset:
          actual !== null &&
          isEquity(stock.assetType) !== isEquity(actual.assetType),
      });
    }
  }

  return {
    total,
    ok: total - misses.length,
    misses,
    crossAssetMisses: misses.filter(miss => miss.crossAsset),
  };
}

/** MISS を読みやすい1行に整形する（失敗時のデバッグ用）。 */
export function formatMisses(misses: ResolutionMiss[], limit = 40): string {
  return misses
    .slice(0, limit)
    .map(
      miss =>
        `"${miss.query}" (${miss.expectedCode}/${miss.expectedAssetType}) -> ` +
        `${miss.actualCode ?? "UNRESOLVED"}/${miss.actualAssetType ?? "-"}` +
        `${miss.crossAsset ? " [cross-asset]" : ""}`
    )
    .join("\n");
}

/**
 * アサーション用の要約文字列。0件のときは余計な改行を付けず、
 * 失敗時のみ内訳を連結する（期待値は常に `0 miss / <total>` 形式）。
 */
export function missSummary(report: ResolutionReport, limit = 40): string {
  const head = `${report.misses.length} miss / ${report.total}`;
  return report.misses.length === 0
    ? head
    : `${head}\n${formatMisses(report.misses, limit)}`;
}

/** 同上（個別株⇄非個別株をまたいだ奪取のみ）。 */
export function crossAssetSummary(
  misses: ResolutionMiss[],
  limit = 40
): string {
  const head = `${misses.length} cross-asset`;
  return misses.length === 0 ? head : `${head}\n${formatMisses(misses, limit)}`;
}

/** 期待値側の文字列（`missSummary` と対にして使う）。 */
export function expectedNoMiss(report: ResolutionReport): string {
  return `0 miss / ${report.total}`;
}

/**
 * 決定的な等間隔サンプリング。ランダムサンプルは「たまたま緑」を生むため使わない。
 *
 * ただし、これ単体では「名称衝突による奪取」というこのスイートが本来守りたい
 * リスクとは無相関に散らばる。実測では、短く・他の銘柄名に包含される名称
 * （riskCohortOf、短名称・被包含名称のコホート）のうち、等間隔サンプルが
 * カバーできるのはごく一部に過ぎない（実測値は searchCoverage.test.ts 側の
 * コメントを参照）。等間隔サンプルは分布の目視確認には使えても、
 * リスクコホートの代わりにはならない。既定スイートでは riskCohortOf と
 * 組み合わせて使うこと。
 */
export function sampleByStride<T>(items: T[], stride: number): T[] {
  return items.filter((_, index) => index % stride === 0);
}

export function equitiesOf(stocks: JpxStock[]): JpxStock[] {
  return stocks.filter(stock => stock.assetType === "equity");
}

export function nonEquitiesOf(stocks: JpxStock[]): JpxStock[] {
  return stocks.filter(stock => stock.assetType !== "equity");
}

/**
 * 他の銘柄名の真部分文字列になっている名称（短く包含される側）を抽出する。
 *
 * 注意（レビューで判明した事実）: findStockMatchesInText の shadow 判定
 * （isShadowedMatch）が実際に保護しているのは、この関数が抽出する
 * 「短く包含される側」ではなく、それを包含する「長い側」である。
 * shadow 判定は「自分の matchedTerms がすべて、他候補が持つより長い語に
 * 包含される」候補を誤検出として弾く規則なので、ここで集めた短い名称を
 * *自分自身の名前だけ* でクエリしても shadow 判定はまず発火しない
 * （包含する側の長い名前が候補として現れないため）。shadow 判定が実際に
 * 発火するのは、この短い名称を部分文字列として含む「長い側」の名前で
 * クエリしたときである（実例: searchCoverage.test.ts の U+30FB ケース、
 * stockMaster.test.ts の 1476 ケース）。
 *
 * つまりこのコホートは、shadow 判定そのものを検証するテストではなく、
 * 「短く一般的な名称（containsStockTerm の日本語ワード境界規則が効く側）」
 * を代表させるための proxy サンプルである。shadow 判定自体のリグレッションは
 * stockMaster.test.ts の findStockMatchesInText 直接テストで守ること。
 * 判定基準はマスタ全体（JPX_STOCK_MASTER、equity/非equityの垣根なし）に対して行う。
 */
export function shadowRiskCandidates(stocks: JpxStock[]): JpxStock[] {
  const allNormalized = JPX_STOCK_MASTER.map(stock => ({
    code: stock.code,
    normalized: normalizeStockText(stock.name),
  }));
  return stocks.filter(stock => {
    const normalized = normalizeStockText(stock.name);
    return allNormalized.some(
      other => other.code !== stock.code && other.normalized.includes(normalized)
    );
  });
}

/**
 * 短い名称（既定2文字以下）を抽出する。containsStockTerm の日本語ワード境界判定
 * （U+30FB のすり抜け等）は短い語ほど誤検出源になりやすく、shadowRiskCandidates
 * と並ぶリスクコホートを構成する。
 */
export function shortNameCandidates(
  stocks: JpxStock[],
  maxLength = 2
): JpxStock[] {
  return stocks.filter(stock => stock.name.length <= maxLength);
}

/**
 * 正規化名がマスタ内の別銘柄（別コード）と完全一致する名称を抽出する。
 *
 * findStockMatchesInText はマッチ長が同点のとき equity 優先→コード昇順で
 * タイブレークする。正規化名が完全一致する2銘柄は、どちらの名前でクエリしても
 * 必ずマッチ長が同点になるため、このタイブレーク順序に解決結果が依存する
 * 唯一のマスタ内パターンである。現状は該当0件だが、将来の収録データで
 * このパターンが生まれても既定スイートが即座に拾えるよう、明示的なコホートとして
 * 独立させておく。
 */
export function duplicateNameCandidates(stocks: JpxStock[]): JpxStock[] {
  const allNormalized = JPX_STOCK_MASTER.map(stock => ({
    code: stock.code,
    normalized: normalizeStockText(stock.name),
  }));
  return stocks.filter(stock => {
    const normalized = normalizeStockText(stock.name);
    return allNormalized.some(
      other => other.code !== stock.code && other.normalized === normalized
    );
  });
}

/**
 * 名称中に「独立した4桁の数字トークン」を含む銘柄を抽出する。
 *
 * resolveSearchQuery は findLocalJpxStockByCode を最初に無条件で通すため
 * （query.normalize("NFKC") 後に /\b\d{4}\b/ にマッチした文字列をコードとして
 * 引く）、名称中に独立した4桁トークンを持つ銘柄は、そのトークンと同じコードの
 * 別銘柄が存在する場合、名称マッチより先にコード経路へ横取りされうる。
 * 現状は衝突する実在コードがなく実害はないが、安価に塞げるコホートとして
 * リスクコホートに加える。
 */
export function fourDigitTokenCandidates(stocks: JpxStock[]): JpxStock[] {
  return stocks.filter(stock => /\b\d{4}\b/.test(stock.name.normalize("NFKC")));
}

/** 銘柄コード基準で重複排除した和集合。 */
export function dedupeStocksByCode(...groups: JpxStock[][]): JpxStock[] {
  const byCode = new Map<string, JpxStock>();
  for (const group of groups) {
    for (const stock of group) byCode.set(stock.code, stock);
  }
  return [...byCode.values()];
}

/**
 * 名称衝突（shadowRiskCandidates）、短い名称（shortNameCandidates）、
 * 正規化名の完全一致（duplicateNameCandidates）、独立した4桁トークン
 * （fourDigitTokenCandidates）の和集合。
 * 「たまたま緑」を防ぐための既定スイートの中核サンプルはこれを必ず含めること。
 */
export function riskCohortOf(stocks: JpxStock[]): JpxStock[] {
  return dedupeStocksByCode(
    shadowRiskCandidates(stocks),
    shortNameCandidates(stocks),
    duplicateNameCandidates(stocks),
    fourDigitTokenCandidates(stocks)
  );
}
