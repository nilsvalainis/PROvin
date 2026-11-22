/**
 * Admin bagātinātā teksta HTML attīrīšana pēc atļauto saraksta (allowlist).
 *
 * Izvade tiek uzbūvēta no jauna: paliek tikai zemāk uzskaitītie tagi ar pārbaudītiem atribūtiem,
 * viss pārējais (nezināmi tagi, atribūti, komentāri) tiek izmests, bet teksts - escapots.
 * Strādā gan serverī, gan pārlūkā (bez DOM un bez papildu atkarībām).
 */

const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "del",
  "br",
  "p",
  "div",
  "span",
  "a",
  "ul",
  "ol",
  "li",
  "font",
  "mark",
  "sub",
  "sup",
]);

/** Elementi, kuru saturs nav rādāms teksts - izmet kopā ar saturu. */
const DROP_WITH_CONTENT = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "noscript",
  "template",
  "textarea",
  "select",
  "title",
  "head",
  "xmp",
  "noembed",
  "noframes",
  "canvas",
  "audio",
  "video",
  "frameset",
];

const DROP_WITH_CONTENT_RE = new RegExp(
  `<(${DROP_WITH_CONTENT.join("|")})\\b(?:"[^"]*"|'[^']*'|[^>"'])*>[\\s\\S]*?<\\/\\1\\s*>`,
  "gi",
);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  colon: ":",
  tab: "\t",
  newline: "\n",
  lpar: "(",
  rpar: ")",
  sol: "/",
  bsol: "\\",
  semi: ";",
  comma: ",",
  period: ".",
};

function decodeEntitiesOnce(raw: string): string {
  return raw.replace(/&(#x[\da-f]+|#\d+|[a-z]+);?/gi, (full, body: string) => {
    const b = body.toLowerCase();
    if (b.startsWith("#")) {
      const code = b[1] === "x" ? Number.parseInt(b.slice(2), 16) : Number.parseInt(b.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    }
    return NAMED_ENTITIES[b] ?? full;
  });
}

/** Atribūta vērtība pārbaudei: entītijas dekodētas līdz stabilam rezultātam. */
function decodeAttrValue(raw: string): string {
  let prev = raw;
  for (let i = 0; i < 4; i += 1) {
    const next = decodeEntitiesOnce(prev);
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeTextKeepingEntities(raw: string): string {
  return raw.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isSafeCssColor(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/.test(v)) return true;
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(v)) return true;
  if (/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/.test(v)) return true;
  return /^[a-z]{3,24}$/.test(v);
}

const CSS_KEYWORDS = /^(?:inherit|initial|unset|normal|none)$/;

const STYLE_VALIDATORS: Record<string, (value: string) => boolean> = {
  color: isSafeCssColor,
  "background-color": isSafeCssColor,
  background: isSafeCssColor,
  "font-size": (v) =>
    /^\d{1,3}(?:\.\d{1,3})?(?:px|pt|rem|em|%)$/.test(v) ||
    /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/.test(v) ||
    CSS_KEYWORDS.test(v),
  "font-family": (v) => /^[a-z0-9 ,'"_-]{1,160}$/i.test(v),
  "font-weight": (v) => /^(?:bold|bolder|lighter|[1-9]00)$/.test(v) || CSS_KEYWORDS.test(v),
  "font-style": (v) => /^(?:italic|oblique)$/.test(v) || CSS_KEYWORDS.test(v),
  "text-decoration": (v) => /^(?:underline|line-through|none|inherit)(?:\s+(?:underline|line-through))?$/.test(v),
  "text-decoration-line": (v) => /^(?:underline|line-through|none|inherit)(?:\s+(?:underline|line-through))?$/.test(v),
  "text-align": (v) => /^(?:left|right|center|justify|start|end)$/.test(v),
};

/** `style` vērtība -> tikai atļautās deklarācijas; tukša virkne, ja nekas nepaliek. */
export function sanitizeAdminRichInlineStyle(styleRaw: string): string {
  const decoded = decodeAttrValue(styleRaw);
  if (!decoded.trim()) return "";
  const chunks = decoded.split(";");
  const kept: string[] = [];
  let droppedAny = false;
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const idx = chunk.indexOf(":");
    const prop = idx < 0 ? "" : chunk.slice(0, idx).trim().toLowerCase();
    const value = idx < 0 ? "" : chunk.slice(idx + 1).trim();
    const check = STYLE_VALIDATORS[prop];
    if (!check || !value || /[\\<>{}]|\/\*/.test(value) || !check(value.toLowerCase())) {
      droppedAny = true;
      continue;
    }
    kept.push(`${prop}:${value}`);
  }
  if (!kept.length) return "";
  /** Ja nekas nav izmests - saglabā sākotnējo pierakstu (atstarpes), lai glabātais HTML nemainās. */
  return droppedAny ? kept.join(";") : decoded.trim();
}

/** Saitei atļauts tikai http(s) un mailto. Atgriež attīrītu adresi vai `null`. */
export function safeAdminRichHref(raw: string): string | null {
  const v = decodeAttrValue(raw).replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, "");
  if (!v) return null;
  if (/^https?:\/\/[^/]/i.test(v) || /^mailto:[^@\s]+@[^@\s]+$/i.test(v)) return v;
  return null;
}

function parseAttrs(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const name = m[1]!.toLowerCase();
    if (out.has(name)) continue;
    out.set(name, m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function buildOpenTag(tag: string, attrsRaw: string, selfClosing: boolean): string {
  const attrs = parseAttrs(attrsRaw);
  const out: string[] = [];

  if (tag === "a") {
    const href = safeAdminRichHref(attrs.get("href") ?? "");
    if (href) {
      out.push(`href="${escapeAttr(href)}"`);
      out.push('target="_blank"');
      out.push('rel="noopener noreferrer"');
    }
  }
  if (tag === "font") {
    const color = decodeAttrValue(attrs.get("color") ?? "").trim();
    if (color && isSafeCssColor(color)) out.push(`color="${escapeAttr(color)}"`);
    const face = decodeAttrValue(attrs.get("face") ?? "").trim();
    if (face && /^[a-z0-9 ,'_-]{1,160}$/i.test(face)) out.push(`face="${escapeAttr(face)}"`);
    const size = decodeAttrValue(attrs.get("size") ?? "").trim();
    if (/^[+-]?[1-7]$/.test(size)) out.push(`size="${size}"`);
  }
  if (tag !== "br" && attrs.has("style")) {
    const style = sanitizeAdminRichInlineStyle(attrs.get("style") ?? "");
    if (style) out.push(`style="${escapeAttr(style)}"`);
  }

  const attrStr = out.length ? ` ${out.join(" ")}` : "";
  if (tag === "br") return selfClosing ? "<br />" : "<br>";
  return `<${tag}${attrStr}>`;
}

/**
 * Attīra admin bagātinātā teksta HTML. Rezultātu drīkst likt `innerHTML` / `dangerouslySetInnerHTML`.
 * Idempotents: atkārtota izsaukšana rezultātu nemaina.
 */
export function sanitizeAdminRichHtml(html: string | null | undefined): string {
  let s = typeof html === "string" ? html : "";
  if (!s) return "";
  s = s.replace(/\u0000/g, "");

  let prev = "";
  let guard = 0;
  while (s !== prev && guard < 8) {
    prev = s;
    guard += 1;
    s = s.replace(/<!--[\s\S]*?-->/g, "");
    s = s.replace(DROP_WITH_CONTENT_RE, "");
  }
  s = s.replace(/<[!?][^>]*>/g, "");

  const out: string[] = [];
  let cursor = 0;
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(s)) !== null) {
    out.push(escapeTextKeepingEntities(s.slice(cursor, m.index)));
    cursor = m.index + m[0].length;
    const tag = m[2]!.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (m[1] === "/") {
      if (tag !== "br") out.push(`</${tag}>`);
      continue;
    }
    const attrsRaw = m[3] ?? "";
    out.push(buildOpenTag(tag, attrsRaw, /\/\s*$/.test(attrsRaw)));
  }
  out.push(escapeTextKeepingEntities(s.slice(cursor)));
  return out.join("");
}
