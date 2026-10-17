/**
 * Kopīgs LV teikumu dalītājs (V1 un V2 pēcapstrāde).
 * Nesadalām decimālos („2.0 TDI”) un kārtas skaitļus pirms mazā burta („2013. gadā”).
 */

export function isRealSentencePunctuation(text: string, punctIndex: number): boolean {
  const ch = text[punctIndex];
  if (!ch || !".!?".includes(ch)) return false;
  let end = punctIndex + 1;
  while (end < text.length && ".!?".includes(text[end]!)) end++;
  if (end < text.length && !/\s/.test(text[end]!)) return false;
  if (ch === "." && punctIndex > 0 && /\d/.test(text[punctIndex - 1]!)) {
    const next = text.slice(end).match(/^\s*(\S)/);
    if (!next || /[\p{Ll}]/u.test(next[1]!)) return false;
  }
  return true;
}

export function splitIntoSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!".!?".includes(text[i]!)) continue;
    if (!isRealSentencePunctuation(text, i)) continue;
    let end = i + 1;
    while (end < text.length && ".!?".includes(text[end]!)) end++;
    while (end < text.length && /\s/.test(text[end]!)) end++;
    out.push(text.slice(start, end));
    start = end;
    i = end - 1;
  }
  if (start < text.length) out.push(text.slice(start));
  return out.length > 0 ? out : [text];
}

export const SENTENCE_HAS_EURO_RE = /€|\bEUR\b|\beiro\b/i;
const EUR_FOLLOW_ON_RE = /^(?:Šāda|Šī)\s+summa|^Šīs\s+izmaksas/i;

/** Izmet € teikumu un nākamo, ja tas sākas ar „Šāda/Šī summa” / „Šīs izmaksas”. */
export function dropEuroAmountSentences(parts: readonly string[]): string[] {
  const kept: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const s = parts[i]!;
    if (SENTENCE_HAS_EURO_RE.test(s)) {
      const next = parts[i + 1];
      if (next && EUR_FOLLOW_ON_RE.test(next.trim())) i += 1;
      continue;
    }
    kept.push(s);
  }
  return kept;
}
