import { escapeHtmlPlain, injectPlaceholderChipsHtml, stripPlaceholderChipMarkup } from "@/lib/admin-tiptap/placeholders";

const RICH_TAG_RE = /<\/?(p|h[1-6]|ul|ol|li|a|strong|em)(\s|>|\/)/i;

/** Vai glabātais virknes formāts ir mūsu rich HTML (nevis nejaušs `<` plain tekstā). */
export function isAdminTiptapRichStorage(value: string): boolean {
  const t = (value ?? "").trim();
  if (!t) return false;
  return RICH_TAG_RE.test(t);
}

/** Plain teksts → minimāls HTML (rindkopas + chipi). */
export function plainTextToAdminTiptapHtml(text: string): string {
  const normalized = (text ?? "").replace(/\r\n/g, "\n");
  if (!normalized.trim()) return "<p></p>";
  const blocks = normalized.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const inner = injectPlaceholderChipsHtml(block).replace(/\n/g, "<br />");
      return `<p>${inner || "<br />"}</p>`;
    })
    .join("");
}

/** Ielādēšanai redaktorā — rich paliek, plain tiek ietīts. */
export function storageToAdminTiptapHtml(value: string): string {
  const v = value ?? "";
  if (!v.trim()) return "<p></p>";
  if (isAdminTiptapRichStorage(v)) return stripPlaceholderChipMarkup(v);
  return plainTextToAdminTiptapHtml(v);
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function htmlToPlainParagraphs(html: string): string {
  let t = stripPlaceholderChipMarkup(html);
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n");
  t = t.replace(/<\/h[1-6]>\s*<h[1-6][^>]*>/gi, "\n\n");
  t = t.replace(/<\/li>\s*<li[^>]*>/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  t = decodeBasicEntities(t);
  return t.replace(/\n{3,}/g, "\n\n").trimEnd();
}

/** Vai rich HTML ir tikai „triviāls” (var glabāt kā plain bez satura zuduma). */
function hasSemanticRichMarkup(html: string): boolean {
  return /<\/?(ul|ol|li|strong|em|a|h[1-6])(\s|>|\/)/i.test(html);
}

export function richHtmlEquivalentPlain(html: string): string | null {
  const stripped = stripPlaceholderChipMarkup(html);
  if (hasSemanticRichMarkup(stripped)) return null;
  const plain = htmlToPlainParagraphs(stripped);
  const reencoded = stripPlaceholderChipMarkup(plainTextToAdminTiptapHtml(plain));
  if (htmlToPlainParagraphs(stripped) === htmlToPlainParagraphs(reencoded)) return plain;
  return null;
}

/** Saglabāšanai: plain režīms vai rich bez lieka HTML. */
export function adminTiptapHtmlToStorage(html: string, mode: "plain" | "rich"): string {
  const cleaned = stripPlaceholderChipMarkup(html).trim();
  if (!cleaned || cleaned === "<p></p>") return "";
  if (mode === "plain") {
    return htmlToPlainParagraphs(cleaned);
  }
  const asPlain = richHtmlEquivalentPlain(cleaned);
  if (asPlain != null) return asPlain;
  return cleaned;
}

export function adminTiptapPlainPreview(htmlOrPlain: string): string {
  if (isAdminTiptapRichStorage(htmlOrPlain)) return htmlToPlainParagraphs(htmlOrPlain);
  return htmlOrPlain;
}
