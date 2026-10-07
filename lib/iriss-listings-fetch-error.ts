/**
 * Node fetch (undici) kļūda ir `TypeError: fetch failed`, īstais iemesls ir `error.cause.code`
 * (ECONNRESET, UND_ERR_CONNECT_TIMEOUT, ENOTFOUND, CERT_HAS_EXPIRED, ...). UI un cron atbildē
 * rādām kodu, nevis tikai "fetch failed".
 */

const CODE_RE = /^[A-Z][A-Z0-9_]{2,80}$/;

export function fetchErrorCodes(err: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && CODE_RE.test(code) && !out.includes(code)) out.push(code);
    cur = (cur as { cause?: unknown }).cause;
  }
  return out;
}

/** Īss teksts logam: ziņojums (ja tas nav tukšais "fetch failed") un cause kodi. */
export function formatFetchError(err: unknown, fallback = "fetch failed"): string {
  const codes = fetchErrorCodes(err);
  const raw = err instanceof Error ? err.message.trim() : "";
  const message = raw && raw.toLowerCase() !== "fetch failed" ? raw.split("\n")[0] : "";
  const parts = [message, ...codes.filter((c) => !message.includes(c))];
  return (parts.filter(Boolean).join(" ") || fallback).slice(0, 220);
}
