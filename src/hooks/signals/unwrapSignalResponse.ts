function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/**
 * claude-brief 等のシグナルAPIのレスポンス（status + body）を解釈し、成功データを返す。
 * `error` が非空文字列なら status に関係なくその文言でthrowする
 * （verifyAuthの401/503文言、既存のfail(...)の200文言をそのままUIに出すため）。
 * 2xxでない・2xxだが非JSONの場合はstatusベースでthrowし、undefinedを握り潰さない。
 */
export function unwrapSignalResponse<T>(
  status: number,
  data: unknown
): T | null {
  if (isRecord(data) && typeof data.error === "string" && data.error !== "") {
    throw new Error(data.error);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status}`);
  }
  if (!isRecord(data)) {
    throw new Error("深掘り分析に失敗しました");
  }
  return (data.data ?? null) as T | null;
}
