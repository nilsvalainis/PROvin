/**
 * Pasūtījuma melnraksta JSON saglabāšanai — noņem kaitīgus / nederīgus rakstzīmju kodus,
 * kas var izraisīt `JSON.stringify` / serializācijas problēmas pēc AI teksta ielīmēšanas.
 */

const MAX_DRAFT_STRING = 120_000;

/** Noņem BOM, NUL un vadības simbolus (izņemot \t \n \r). */
export function sanitizeDraftTextForStorage(s: string, maxLen = MAX_DRAFT_STRING): string {
  if (typeof s !== "string") return "";
  let t = s.replace(/\uFEFF/g, "");
  t = t.replace(/\u0000/g, "");
  t = t.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

export function deepSanitizeDraftStrings(value: unknown): unknown {
  if (typeof value === "string") return sanitizeDraftTextForStorage(value);
  if (Array.isArray(value)) return value.map(deepSanitizeDraftStrings);
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      out[k] = deepSanitizeDraftStrings(o[k]);
    }
    return out;
  }
  return value;
}
