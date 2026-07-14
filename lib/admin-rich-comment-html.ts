import { sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";
import { ADMIN_RICH_PDF_FONT_WHITELIST } from "@/lib/admin-rich-comment-fonts";

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

/** No Gemini / Markdown atbildes — nekad neielikt `*` kā punktus PDF laukā. */
export function normalizeGeminiClientPlainText(text: string): string {
  let t = sanitizeDraftTextForStorage(text);
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/^\s*\*\s+/gm, "- ");
  t = t.replace(/^\s*•\s+/gm, "- ");
  t = t.replace(/\r\n/g, "\n");
  return t.trim();
}

/** Drošai glabāšanai/atgriešanai pēc AI polish vienkāršu tekstu ietīt minimālā HTML. */
export function plainTextToMinimalRichHtml(text: string): string {
  const t = sanitizeDraftTextForStorage(text);
  return escapeHtmlPlain(t).replace(/\r?\n/g, "<br />");
}

/** Gemini ✨ ģenerēts teksts klienta PDF laukam — bez `*` punktiem. */
export function geminiPlainTextToRichHtml(text: string): string {
  return plainTextToMinimalRichHtml(normalizeGeminiClientPlainText(text));
}

const EXPERT_BOLD_OPEN = "\uE010";
const EXPERT_BOLD_CLOSE = "\uE011";

/** Noņem sarakstu prefiksus no Gemini eksperta komentāra (ja modelis tomēr izmanto "- "). */
export function normalizeGeminiExpertParagraphText(text: string): string {
  let t = sanitizeDraftTextForStorage(text);
  t = t.replace(/^\s*[-•*–]\s+/gm, "");
  t = t.replace(/^\s*\d+[\.)]\s+/gm, "");
  t = t.replace(/^ANOMĀLIJA:\s*/gim, "**Anomālija:** ");
  t = t.replace(/\r\n/g, "\n");
  return t.trim();
}

/** Dziļās avotu analīzes ✨ — saglabā **bold** kā <strong> admin redaktoram un PDF. */
export function geminiExpertSourceCommentToRichHtml(text: string): string {
  let t = normalizeGeminiExpertParagraphText(text);
  t = t.replace(/\*\*([^*\n]+)\*\*/g, `${EXPERT_BOLD_OPEN}$1${EXPERT_BOLD_CLOSE}`);
  t = escapeHtmlPlain(t);
  t = t
    .replace(/\uE010/g, "<strong>")
    .replace(/\uE011/g, "</strong>");
  return t.replace(/\r?\n/g, "<br />");
}

function normalizeRichHtmlBlockLineBreaks(html: string): string {
  let s = html;
  // Tukšas rindas no contentEditable: <div><br></div>
  s = s.replace(/<(?:div|p)[^>]*>\s*(?:<br\s*\/?>\s*)*<\/(?:div|p)>/gi, "\n");
  // <br> tieši pirms bloka beigām — lieks, jo pats </div>/</p> jau ir rindas pāreja
  s = s.replace(/<br\s*\/?>\s*(?=<\/(?:div|p)>)/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(?:div|p)>/gi, "\n");
  s = s.replace(/<(?:div|p)[^>]*>/gi, "");
  return s;
}

/** Admin bagātinātais HTML → vienots plakanais teksts (PDF / AI polish nosūtei). */
export function adminRichHtmlToPlainText(html: string | null | undefined): string {
  const s = sanitizeDraftTextForStorage(typeof html === "string" ? html : "");
  if (!s.trim()) return "";
  let t = normalizeRichHtmlBlockLineBreaks(s);
  t = t.replace(/<[^>]+>/g, "");
  t = decodeBasicHtmlEntities(t);
  return t
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Tikai tik daudz, lai uz admin lasīšanu ar dangerouslySetInnerHTML neielīstu skriptu. */
export function coerceAdminRichHtmlForDisplay(html: string | null | undefined): string {
  let s = sanitizeDraftTextForStorage(typeof html === "string" ? html : "");
  s = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)+/gi, "");
  return s;
}

const PDF_B_OPEN = "\uE000";
const PDF_B_CLOSE = "\uE001";
const PDF_I_OPEN = "\uE002";
const PDF_I_CLOSE = "\uE003";
const PDF_U_OPEN = "\uE004";
const PDF_U_CLOSE = "\uE005";
const PDF_SPAN_OPEN = "\uE006";
const PDF_SPAN_MID = "\uE007";
const PDF_SPAN_CLOSE = "\uE008";

function isSafePdfColor(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/.test(v)) return true;
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(v)) return true;
  if (/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/.test(v)) return true;
  return ["red", "green", "#ef4444", "#22c55e", "#16a34a", "#dc2626"].includes(v);
}

function sanitizePdfInlineStyle(styleRaw: string): string {
  const allowed: string[] = [];
  for (const chunk of styleRaw.split(";")) {
    const idx = chunk.indexOf(":");
    if (idx < 0) continue;
    const prop = chunk.slice(0, idx).trim().toLowerCase();
    const val = chunk.slice(idx + 1).trim();
    if (!val) continue;
    if (prop === "color" && isSafePdfColor(val)) {
      allowed.push(`color:${val}`);
      continue;
    }
    if (prop === "font-size" && /^\d+(?:\.\d+)?(?:px|pt|rem|em)$/.test(val)) {
      allowed.push(`font-size:${val}`);
      continue;
    }
    if (prop === "font-family") {
      const first = val.replace(/['"]/g, "").split(",")[0]?.trim().toLowerCase() ?? "";
      if (ADMIN_RICH_PDF_FONT_WHITELIST.has(first)) {
        allowed.push(`font-family:${val}`);
      }
    }
  }
  return allowed.join(";");
}

function replaceInlineTagsWithMarkers(input: string): string {
  let s = input;
  s = s.replace(/<(strong|b)(\s[^>]*)?>/gi, PDF_B_OPEN);
  s = s.replace(/<\/(strong|b)>/gi, PDF_B_CLOSE);
  s = s.replace(/<(em|i)(\s[^>]*)?>/gi, PDF_I_OPEN);
  s = s.replace(/<\/(em|i)>/gi, PDF_I_CLOSE);
  s = s.replace(/<u(\s[^>]*)?>/gi, PDF_U_OPEN);
  s = s.replace(/<\/u>/gi, PDF_U_CLOSE);
  s = s.replace(/<font\s+face="([^"]*)"[^>]*>/gi, (_, face) => {
    const safe = sanitizePdfInlineStyle(`font-family:${face}`);
    return safe ? `${PDF_SPAN_OPEN}${safe}${PDF_SPAN_MID}` : "";
  });
  s = s.replace(/<\/font>/gi, PDF_SPAN_CLOSE);
  s = s.replace(/<span\s+style="([^"]*)"[^>]*>/gi, (_, style) => {
    const safe = sanitizePdfInlineStyle(style);
    return safe ? `${PDF_SPAN_OPEN}${safe}${PDF_SPAN_MID}` : "";
  });
  s = s.replace(/<\/span>/gi, PDF_SPAN_CLOSE);
  return s;
}

function restorePdfMarkersToHtml(escaped: string): string {
  let s = escaped;
  s = s.replace(/\uE006([^\uE007]*)\uE007/g, (_, style) => `<span style="${style}">`);
  s = s.replace(/\uE008/g, "</span>");
  s = s.replace(/\uE000/g, "<strong>");
  s = s.replace(/\uE001/g, "</strong>");
  s = s.replace(/\uE002/g, "<em>");
  s = s.replace(/\uE003/g, "</em>");
  s = s.replace(/\uE004/g, "<u>");
  s = s.replace(/\uE005/g, "</u>");
  return s;
}

/**
 * Admin bagātinātais HTML → drošs PDF HTML (`strong`, `em`, `u`, `span` ar krāsu/fontu; pārējie tagi noņemti).
 */
export function adminRichHtmlToPdfSafeHtml(html: string): string {
  let s = coerceAdminRichHtmlForDisplay(html);
  if (!s.trim()) return "";

  s = normalizeRichHtmlBlockLineBreaks(s);
  s = replaceInlineTagsWithMarkers(s);
  s = s.replace(/<[^>]+>/g, "");
  s = decodeBasicHtmlEntities(s);
  s = escapeHtmlPlain(s);
  s = restorePdfMarkersToHtml(s);
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/\n+$/g, "");
  s = s.replace(/\r?\n/g, "<br />");
  return s.trim();
}
