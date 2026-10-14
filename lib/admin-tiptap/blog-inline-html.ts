import { isAdminTiptapRichStorage } from "@/lib/admin-tiptap/storage-format";
import { stripPlaceholderChipMarkup } from "@/lib/admin-tiptap/placeholders";

const ALLOWED = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "span"]);

/** Vienkārša allowlist sanitizācija publiskajam blogam (inline no admin Tiptap). */
export function sanitizeBlogInlineHtml(raw: string): string {
  if (!raw?.trim()) return "";
  if (!isAdminTiptapRichStorage(raw)) return raw;
  let s = stripPlaceholderChipMarkup(raw);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!ALLOWED.has(t)) return "";
    if (t === "a") {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const url = (href?.[2] ?? href?.[3] ?? href?.[4] ?? "").trim();
      if (!url || /^javascript:/i.test(url)) return "";
      const esc = url.replace(/"/g, "&quot;");
      return `<a href="${esc}" rel="noopener noreferrer" target="_blank" class="text-provin-accent underline">`;
    }
    if (t === "span") return "<span>";
    return full.replace(attrs, "");
  });
  return s;
}

export function blogBlockTextHasInlineHtml(text: string): boolean {
  return isAdminTiptapRichStorage(text);
}
