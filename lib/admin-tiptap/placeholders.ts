/** Atbalsta {{var}}, {{#var}} un {{/var}} — kā `render-template.ts`. */
export const TEMPLATE_TOKEN_RE = /\{\{([#\/]?)([a-z0-9_]+)\}\}/gi;

export function splitTemplateTokens(text: string): { kind: "text" | "token"; value: string }[] {
  const out: { kind: "text" | "token"; value: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TEMPLATE_TOKEN_RE.source, "gi");
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    out.push({ kind: "token", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

export function escapeHtmlPlain(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PLACEHOLDER_CHIP_ATTR = "data-provin-template-token";

/** Plain / fragment → HTML redaktoram (tokeni kā nelabojami chipi). */
export function injectPlaceholderChipsHtml(fragment: string): string {
  const parts = splitTemplateTokens(fragment);
  return parts
    .map((p) => {
      if (p.kind === "token") {
        const esc = escapeHtmlPlain(p.value);
        return `<span ${PLACEHOLDER_CHIP_ATTR}="" contenteditable="false" class="provin-template-chip">${esc}</span>`;
      }
      return escapeHtmlPlain(p.value);
    })
    .join("");
}

export function stripPlaceholderChipMarkup(html: string): string {
  return html.replace(
    new RegExp(
      `<span[^>]*${PLACEHOLDER_CHIP_ATTR}[^>]*>\\s*(\\{\\{[#\\/]?[a-z0-9_]+\\}\\})\\s*</span>`,
      "gi",
    ),
    "$1",
  );
}
