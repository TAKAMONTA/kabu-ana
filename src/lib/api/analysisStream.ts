export const STRUCTURED_JSON_SENTINEL = "===STRUCTURED_JSON===";

export function formatSSE(
  event: "narrative" | "result" | "error" | "bundle",
  data: string
): string {
  // JSON-encode the payload so arbitrary content (newlines, quotes, backslashes)
  // survives the round-trip on a single data line. A naive \n→\\n escape is not
  // reversible: the `result` payload is itself JSON.stringify output that already
  // contains literal "\n" sequences, which the inverse replace would corrupt into
  // raw newlines and break JSON.parse on the client.
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function parseSSE(
  buffer: string
): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const allFrames = buffer.split("\n\n");
  // The last element is always either empty (complete buffer) or an incomplete
  // fragment (partial frame). Drop it so we only process fully-terminated frames.
  const frames = allFrames.slice(0, -1);
  for (const frame of frames) {
    if (!frame.trim()) continue;
    const lines = frame.split("\n");
    let event = "";
    let data: string | null = null;
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        event = line.slice(7);
      } else if (line.startsWith("data: ")) {
        try {
          data = JSON.parse(line.slice(6));
        } catch {
          data = null;
        }
      }
    }
    if (event && data !== null && data !== "") {
      events.push({ event, data });
    }
  }
  return events;
}

export function splitNarrativeAndJson(full: string): {
  narrative: string;
  json: string | null;
} {
  const sentinelIdx = full.indexOf(STRUCTURED_JSON_SENTINEL);
  if (sentinelIdx !== -1) {
    const narrative = full.slice(0, sentinelIdx).trim();
    const after = full
      .slice(sentinelIdx + STRUCTURED_JSON_SENTINEL.length)
      .trim();
    const jsonMatch = after.match(/\{[\s\S]*\}/);
    return { narrative, json: jsonMatch ? jsonMatch[0] : null };
  }

  const braceIdx = full.indexOf("{");
  if (braceIdx !== -1) {
    const narrative = full.slice(0, braceIdx).trim();
    const jsonMatch = full.slice(braceIdx).match(/\{[\s\S]*\}/);
    return { narrative, json: jsonMatch ? jsonMatch[0] : null };
  }

  return { narrative: full.trim(), json: null };
}
