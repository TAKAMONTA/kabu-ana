export interface BriefSourceInput {
  prices?: { fetchedAt?: string | null; prices?: unknown[] | null } | null;
  news?: { fetchedAt?: string | null; items?: unknown[] | null } | null;
  seismic?: {
    fetchedAt?: string | null;
    earthquakes?: unknown[] | null;
  } | null;
  risk?: {
    calculatedAt?: string | null;
    risk?: unknown | null;
    composite?: unknown | null;
    anomalies?: unknown[] | null;
  } | null;
}

/** これより古い generating は、落ちた生成とみなして取り直す */
export const BRIEF_GENERATING_STALE_MS = 2 * 60 * 1000;
/** 1日（JST）あたりの生成試行の上限。AI課金の歯止め */
export const MAX_BRIEF_ATTEMPTS_PER_DAY = 3;

/** signals_brief/{JSTの日付} に保存している状態 */
export interface BriefDocState {
  brief?: unknown;
  generatedAt?: unknown;
  status?: unknown;
  attempts?: unknown;
  lockedAtMs?: unknown;
}

export type BriefGenerationDecision =
  | { kind: "ready" }
  | { kind: "generating" }
  | { kind: "exhausted" }
  | { kind: "unconfigured" }
  | { kind: "acquire"; attempts: number };

/** その日のブリーフが生成済みか（旧形式の { brief, generatedAt } も含む） */
export function isBriefReady(state: BriefDocState | undefined): boolean {
  return Boolean(state?.brief) && typeof state?.generatedAt === "string";
}

/**
 * 朝のブリーフを今生成してよいかを決める（トランザクション内で呼ぶ純粋関数）。
 *
 * ブリーフは JST の1日に1回だけ作る。以前は「ソースの fetchedAt がブリーフより新しい」
 * だけで作り直しており、prices/news/seismic/risk のどれかが叩かれるたびに有料の
 * AI呼び出しが走っていた。
 * - 生成済み → ready（AIは呼ばない）
 * - 他のリクエストが生成中（2分以内）→ generating
 * - 試行上限に到達 → exhausted
 * - AIが未設定 → unconfigured（試行回数を消費しない）
 * - それ以外 → acquire（生成権を取る）
 */
export function decideBriefGeneration(
  state: BriefDocState | undefined,
  nowMs: number,
  canGenerate: boolean
): BriefGenerationDecision {
  if (isBriefReady(state)) return { kind: "ready" };
  if (state?.status === "generating") {
    const lockedAtMs =
      typeof state.lockedAtMs === "number" ? state.lockedAtMs : 0;
    if (nowMs - lockedAtMs < BRIEF_GENERATING_STALE_MS) {
      return { kind: "generating" };
    }
  }
  const attempts =
    (typeof state?.attempts === "number" ? state.attempts : 0) + 1;
  if (attempts > MAX_BRIEF_ATTEMPTS_PER_DAY) return { kind: "exhausted" };
  if (!canGenerate) return { kind: "unconfigured" };
  return { kind: "acquire", attempts };
}

export function hasBriefSourceData(input: BriefSourceInput): boolean {
  return Boolean(
    (input.prices?.prices?.length ?? 0) > 0 ||
    (input.news?.items?.length ?? 0) > 0 ||
    (input.seismic?.earthquakes?.length ?? 0) > 0 ||
    input.risk?.risk != null ||
    input.risk?.composite != null ||
    (input.risk?.anomalies?.length ?? 0) > 0
  );
}

export function mergeBriefSourceFallbacks(
  persisted: BriefSourceInput,
  fetched: BriefSourceInput
): BriefSourceInput {
  return {
    prices: persisted.prices ?? fetched.prices,
    news: persisted.news ?? fetched.news,
    seismic: persisted.seismic ?? fetched.seismic,
    risk: persisted.risk ?? fetched.risk,
  };
}
