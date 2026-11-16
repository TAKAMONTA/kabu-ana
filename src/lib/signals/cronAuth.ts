import crypto from "crypto";

/**
 * cron 用のシークレット候補。Vercel Cron が自動で送るのは CRON_SECRET
 * （名前固定）なのでこれを優先し、旧名 SIGNALS_CRON_SECRET も互換で受け付ける。
 */
function cronSecrets(): string[] {
  return [process.env.CRON_SECRET, process.env.SIGNALS_CRON_SECRET].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
}

function timingSafeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Authorization ヘッダーが `Bearer <CRON_SECRET>`（または旧名 SIGNALS_CRON_SECRET）と
 * 一致するかを定数時間比較で判定する。シークレットが1つも設定されていなければ常に false。
 */
export function isAuthorizedCronRequest(authorization: string | null): boolean {
  if (!authorization) return false;
  const secrets = cronSecrets();
  if (secrets.length === 0) return false;
  // 早期 return で「どの候補に一致したか」の時間差を出さないよう、全候補を比較する
  let authorized = false;
  for (const secret of secrets) {
    if (timingSafeEqualString(authorization, `Bearer ${secret}`)) {
      authorized = true;
    }
  }
  return authorized;
}
