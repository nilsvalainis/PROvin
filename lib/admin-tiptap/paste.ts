/** Noņem Word / Google Docs lieko stilu un atstāj atļauto tagu kopu. */
const ALLOWED_BLOCK = /^(p|h[1-6]|ul|ol|li|br)$/i;
const ALLOWED_INLINE = /^(strong|b|em|i|a|span)$/i;

export function normalizePastedAdminRichHtml(html: string, mode: "plain" | "rich"): string {
  if (mode === "plain") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n");
  }
  let s = html.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(\/?)([a-z0-9]+)([^>]*)>/gi, (full, slash, tag: string) => {
    const t = tag.toLowerCase();
    if (ALLOWED_BLOCK.test(t) || ALLOWED_INLINE.test(t)) {
      if (t === "a" && !slash) return "<a>";
      return full.replace(/\sstyle="[^"]*"/gi, "").replace(/\sclass="[^"]*"/gi, "");
    }
    if (t === "div" && !slash) return "<p>";
    if (t === "div" && slash) return "</p>";
    return "";
  });
  return s;
}
