import { isAdminTiptapRichStorage } from "@/lib/admin-tiptap/storage-format";
import { stripPlaceholderChipMarkup } from "@/lib/admin-tiptap/placeholders";

const ALLOWED = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "span"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  colon: ":",
  tab: "\t",
  newline: "\n",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (full, body: string) => {
    const b = body.toLowerCase();
    if (b.startsWith("#x")) return String.fromCodePoint(Number.parseInt(b.slice(2), 16) || 0xfffd);
    if (b.startsWith("#")) return String.fromCodePoint(Number.parseInt(b.slice(1), 10) || 0xfffd);
    return NAMED_ENTITIES[b] ?? full;
  });
}

/** Tikai http(s), mailto, tel un relatīvas saites; scheme pārbauda pēc entītiju dekodēšanas. */
export function safeBlogHref(raw: string): string | null {
  // eslint-disable-next-line no-control-regex
  const url = decodeHtmlEntities(raw).replace(/[\u0000- \u007f-\u009f]+/g, "").trim();
  if (!url) return null;
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  if (url.startsWith("//")) return null;
  return url;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Allowlist sanitizācija publiskajam blogam (inline no admin Tiptap). Viens piegājiens:
 * atsevišķi `<` / `>` kļūst par entītijām, tāpēc noņemts tags nevar „salīmēt” jaunu
 * (`<<x>script>`). Atribūti netiek pārnesti, izņemot pārbaudītu `href`.
 */
export function sanitizeBlogInlineHtml(raw: string): string {
  if (!raw?.trim()) return "";
  if (!isAdminTiptapRichStorage(raw)) return "";
  let s = stripPlaceholderChipMarkup(raw);
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style\s*>/gi, "");
  return s.replace(/<(\/?)([a-z0-9]+)([^<>]*)>|[<>]/gi, (full, slash: string, tag: string, attrs: string) => {
    if (!tag) return full === "<" ? "&lt;" : "&gt;";
    const t = tag.toLowerCase();
    if (!ALLOWED.has(t)) return "";
    if (slash) return `</${t}>`;
    if (t === "a") {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const url = safeBlogHref(href?.[2] ?? href?.[3] ?? href?.[4] ?? "");
      if (!url) return "";
      return `<a href="${escapeAttr(url)}" rel="noopener noreferrer" target="_blank" class="text-provin-accent underline">`;
    }
    return `<${t}>`;
  });
}

export function blogBlockTextHasInlineHtml(text: string): boolean {
  return isAdminTiptapRichStorage(text);
}
