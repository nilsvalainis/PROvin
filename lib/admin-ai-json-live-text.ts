/**
 * Daļējs JSON straumes teksts — izvelk komentāra laukus, lai SSE varētu
 * krāsot lauku, nevis dumpot neapstrādātu `{ "listedForSale": ...`.
 */

const LIVE_STRING_KEYS = ["comments", "letter", "text"] as const;

export function extractPartialJsonString(source: string, key: string): string {
  const re = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*"`);
  const m = re.exec(source);
  if (!m || m.index == null) return "";
  let i = m.index + m[0].length;
  let out = "";
  while (i < source.length) {
    const c = source[i]!;
    if (c === "\\") {
      const n = source[i + 1];
      if (n == null) break;
      const map: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        '"': '"',
        "\\": "\\",
        "/": "/",
      };
      out += map[n] ?? n;
      i += 2;
      continue;
    }
    if (c === '"') break;
    out += c;
    i += 1;
  }
  return out;
}

export function extractPartialJsonBoolean(source: string, key: string): boolean | undefined {
  const re = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*(true|false)`);
  const m = re.exec(source);
  if (!m) return undefined;
  return m[1] === "true";
}

/** Komentāra teksts no nepilnīga JSON (tirgus `comments`, peek `letter`). */
export function liveAdminCommentFromPartialJson(partial: string): string {
  const raw = partial.trim();
  if (!raw) return "";
  for (const key of LIVE_STRING_KEYS) {
    const v = extractPartialJsonString(raw, key).trim();
    if (v) return v;
  }
  return "";
}
