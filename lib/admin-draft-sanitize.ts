/**
 * Pasūtījuma melnraksta JSON saglabāšanai — noņem kaitīgus / nederīgus rakstzīmju kodus,
 * kas var izraisīt `JSON.stringify` / serializācijas problēmas pēc AI teksta ielīmēšanas.
 */

const MAX_DRAFT_STRING = 120_000;
const MAX_DRAFT_DATA_URL_STRING = 15_000_000;

/** Noņem BOM, NUL un vadības simbolus (izņemot \t \n \r). */
export function sanitizeDraftTextForStorage(s: string, maxLen = MAX_DRAFT_STRING): string {
  if (typeof s !== "string") return "";
  let t = s.replace(/\uFEFF/g, "");
  t = t.replace(/\u0000/g, "");
  t = t.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

export function deepSanitizeDraftStrings(value: unknown): unknown {
  return deepSanitizeDraftStringsWithKey(value, "");
}

function deepSanitizeDraftStringsWithKey(value: unknown, key: string): unknown {
  if (typeof value === "string") {
    const maxLen = key === "dataUrl" ? MAX_DRAFT_DATA_URL_STRING : MAX_DRAFT_STRING;
    return sanitizeDraftTextForStorage(value, maxLen);
  }
  if (Array.isArray(value)) return value.map((item) => deepSanitizeDraftStringsWithKey(item, key));
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      out[k] = deepSanitizeDraftStringsWithKey(o[k], k);
    }
    return out;
  }
  return value;
}
