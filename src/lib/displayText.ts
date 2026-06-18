export function normalizeDisplayText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeOptionalDisplayText(value?: string | null): string {
  return value ? normalizeDisplayText(value) : "";
}
