import { sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";

/**
 * Dekodē biežākos HTML entītiju fragmentus pēc tagu noņemšanas
 * (citādi PDF / esc() rādītu piemēram tekstu „&nbsp;”).
 */
export function decodeBasicHtmlEntities(raw: string): string {
  if (!raw) return "";
  const pass = (input: string): string => {
    let s = input.replace(/&(nbsp|#160)\s*;/gi, " ");
    s = s.replace(/&#x([\da-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(Number.parseInt(h as string, 16)),
    );
    s = s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number.parseInt(n as string, 10)));
    s = s.replace(/&lt;/gi, "<");
    s = s.replace(/&gt;/gi, ">");
    s = s.replace(/&quot;/gi, '"');
    s = s.replace(/&#0*39;/g, "'");
    s = s.replace(/&apos;/gi, "'");
    s = s.replace(/&amp;/gi, "&");
    return s;
  };
  /** Divreiz — lai `&amp;nbsp;` kļūtu par tukšumu, nevis redzamu `&nbsp;`. */
  return pass(pass(raw));
}

function escapeHtmlPlain(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Drošai glabāšanai/atgriešanai pēc AI polish vienkāršu tekstu ietīt minimālā HTML. */
export function plainTextToMinimalRichHtml(text: string): string {
  const t = sanitizeDraftTextForStorage(text);
  return escapeHtmlPlain(t).replace(/\r?\n/g, "<br />");
}

/** Admin bagātinātais HTML → vienots plakanais teksts (PDF / AI polish nosūtei). */
export function adminRichHtmlToPlainText(html: string): string {
  const s = sanitizeDraftTextForStorage(html);
  if (!s.trim()) return "";
  let t = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  t = decodeBasicHtmlEntities(t);
  return t
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Tikai tik daudz, lai uz admin lasīšanu ar dangerouslySetInnerHTML neielīstu skriptu. */
export function coerceAdminRichHtmlForDisplay(html: string): string {
  let s = sanitizeDraftTextForStorage(html);
  s = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)+/gi, "");
  return s;
}
