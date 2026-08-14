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

/** No AI / Markdown atbildes — nekad neielikt `*` kā punktus PDF laukā. */
export function normalizeAiClientPlainText(text: string): string {
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

/** AI ✨ ģenerēts teksts klienta PDF laukam — bez `*` punktiem. */
export function aiPlainTextToRichHtml(text: string): string {
  return plainTextToMinimalRichHtml(normalizeAiClientPlainText(text));
}

const EXPERT_BOLD_OPEN = "\uE010";
const EXPERT_BOLD_CLOSE = "\uE011";

/**
 * Ja rindkopai trūkst **bold** ievada, ietin pirmo teikumu (vai pirmos vārdus) **…**.
 * Nodrošina vienotu vizuālo stilu, pat ja modelis aizmirst Markdown.
 */
export function ensureExpertBoldParagraphOpeners(text: string): string {
  const blocks = text
    .split(/\n\n+/)
    .flatMap((block) => {
      const lines = block
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 1) return lines;
      return block.trim() ? [block.trim()] : [];
    });

  return blocks
    .map((para) => {
      const p = para.trim();
      if (!p) return p;
      if (/^\*\*[^*\n]+?\*\*/.test(p)) return p;

      const sentence = p.match(/^([^.!?\n]{2,110}?[.!?])(\s+|$)([\s\S]*)/);
      if (sentence) {
        const hook = sentence[1]!.replace(/^\*\*|\*\*$/g, "").trim();
        const rest = (sentence[3] ?? "").trimStart();
        if (!hook) return p;
        return rest ? `**${hook}** ${rest}` : `**${hook}**`;
      }

      const words = p.split(/\s+/).filter(Boolean);
      if (words.length === 0) return p;
      const hookLen = Math.min(Math.max(3, Math.ceil(words.length / 4)), Math.min(8, words.length));
      const hook = words.slice(0, hookLen).join(" ");
      const rest = words.slice(hookLen).join(" ");
      return rest ? `**${hook}** ${rest}` : `**${hook}**`;
    })
    .join("\n\n");
}

/** Noņem sarakstu prefiksus no AI eksperta komentāra (ja modelis tomēr izmanto "- "). */
export function normalizeAiExpertParagraphText(text: string): string {
  let t = sanitizeDraftTextForStorage(text);
  t = t.replace(/^\s*[-•*–]\s+/gm, "");
  t = t.replace(/^\s*\d+[\.)]\s+/gm, "");
  t = t.replace(/^(?:ANOMĀLIJA|NEATBILSTĪBA):\s*/gim, "**Neatbilstība:** ");
  t = t.replace(/\r\n/g, "\n");
  t = t.trim();
  return ensureExpertBoldParagraphOpeners(t);
}

/** Dziļās avotu analīzes ✨ — saglabā **bold** kā <strong> admin redaktoram un PDF. */
export function aiExpertSourceCommentToRichHtml(text: string): string {
  let t = normalizeAiExpertParagraphText(text);
  t = t.replace(/\*\*([^*\n]+)\*\*/g, `${EXPERT_BOLD_OPEN}$1${EXPERT_BOLD_CLOSE}`);
  t = escapeHtmlPlain(t);
  t = t
    .replace(/\uE010/g, "<strong>")
    .replace(/\uE011/g, "</strong>");
  return t.replace(/\r?\n/g, "<br />");
}

function parseCssDeclarations(styleRaw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const chunk of styleRaw.split(";")) {
    const idx = chunk.indexOf(":");
    if (idx < 0) continue;
    const key = chunk.slice(0, idx).trim().toLowerCase();
    const val = chunk.slice(idx + 1).trim();
    if (key && val) out[key] = val;
  }
  return out;
}

function isBoldFontWeight(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === "bold" || v === "bolder") return true;
  const n = Number.parseInt(v, 10);
  return !Number.isNaN(n) && n >= 600;
}

function hasUnderlineDecoration(decl: Record<string, string>): boolean {
  const deco = `${decl["text-decoration"] ?? ""} ${decl["text-decoration-line"] ?? ""}`;
  return deco.includes("underline");
}

function hasLineThroughDecoration(decl: Record<string, string>): boolean {
  const deco = `${decl["text-decoration"] ?? ""} ${decl["text-decoration-line"] ?? ""}`;
  return deco.includes("line-through");
}

function buildPreservedInlineStyle(decl: Record<string, string>): string {
  const allowed: string[] = [];
  const color = decl.color;
  if (color && isSafePdfColor(color)) allowed.push(`color:${color}`);
  const background = decl["background-color"] ?? decl.background;
  if (background && isSafePdfColor(background)) allowed.push(`background-color:${background}`);
  const fontSize = decl["font-size"];
  if (fontSize && /^\d+(?:\.\d+)?(?:px|pt|rem|em)$/.test(fontSize)) {
    allowed.push(`font-size:${fontSize}`);
  }
  const fontFamily = decl["font-family"];
  if (fontFamily) {
    const first = fontFamily.replace(/['"]/g, "").split(",")[0]?.trim().toLowerCase() ?? "";
    if (ADMIN_RICH_PDF_FONT_WHITELIST.has(first)) {
      allowed.push(`font-family:${fontFamily}`);
    }
  }
  return allowed.join(";");
}

/**
 * `execCommand("foreColor")` vecākos pārlūkos rada `<font color>`, nevis `<span style>`.
 * Bez šīs normalizācijas PDF konvertācija krāsu pazaudē (tags tiek noņemts kā nezināms).
 */
function normalizeLegacyFontTags(html: string): string {
  let s = html;
  s = s.replace(/<font(\s[^>]*)?>/gi, (_full, attrsRaw: string | undefined) => {
    const attrs = attrsRaw ?? "";
    const styles: string[] = [];
    const color = /\scolor\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const colorVal = (color?.[2] ?? color?.[3] ?? color?.[4] ?? "").trim();
    if (colorVal && isSafePdfColor(colorVal)) styles.push(`color:${colorVal}`);
    const face = /\sface\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const faceVal = (face?.[2] ?? face?.[3] ?? face?.[4] ?? "").trim();
    if (faceVal) styles.push(`font-family:${faceVal}`);
    const inline = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrs);
    if (inline?.[1]) styles.push(inline[1]);
    return styles.length ? `<span style="${styles.join(";")}">` : "<span>";
  });
  s = s.replace(/<\/font>/gi, "</span>");
  return s;
}

export const ADMIN_RICH_DEFAULT_HIGHLIGHT = "#fde68a";

/** `<mark>` (izcēlums) → span ar fona krāsu, lai vienota apstrāde PDF un lasīšanai. */
function normalizeMarkTags(html: string): string {
  return html
    .replace(/<mark(\s[^>]*)?>/gi, (_full, attrsRaw: string | undefined) => {
      const inline = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrsRaw ?? "");
      const decl = parseCssDeclarations(inline?.[1] ?? "");
      const bg = decl["background-color"] ?? decl.background ?? "";
      const safe = bg && isSafePdfColor(bg) ? bg : ADMIN_RICH_DEFAULT_HIGHLIGHT;
      return `<span style="background-color:${safe}">`;
    })
    .replace(/<\/mark>/gi, "</span>");
}

/** Pārvērš `span style="font-weight:bold"` u.c. par semantiskajiem tagiem — PDF un ielīmēšanai. */
export function promoteInlineStyleSemantics(html: string): string {
  let prev = "";
  let s = html;
  let guard = 0;
  while (s !== prev && guard < 64) {
    prev = s;
    guard += 1;
    s = s.replace(
      /<span(\s[^>]*)?style="([^"]*)"([^>]*)>([\s\S]*?)<\/span>/gi,
      (_full, _before, styleRaw, _after, inner) => {
        const decl = parseCssDeclarations(styleRaw);
        const preservedStyle = buildPreservedInlineStyle(decl);
        const bold = decl["font-weight"] ? isBoldFontWeight(decl["font-weight"]) : false;
        const italic =
          decl["font-style"] === "italic" || decl["font-style"] === "oblique";
        const underline = hasUnderlineDecoration(decl);
        const strike = hasLineThroughDecoration(decl);

        let out = inner;
        if (strike) out = `<s>${out}</s>`;
        if (underline) out = `<u>${out}</u>`;
        if (italic) out = `<em>${out}</em>`;
        if (bold) out = `<strong>${out}</strong>`;
        if (preservedStyle) out = `<span style="${preservedStyle}">${out}</span>`;
        return out;
      },
    );
  }
  return s;
}

function stripWordPasteBoilerplate(html: string): string {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(?:\/?)(?:o:p|xml|meta|link|style|head|title|body)[^>]*>/gi, "");
  s = s.replace(/\sclass="[^"]*"/gi, "");
  s = s.replace(/\sclass='[^']*'/gi, "");
  s = s.replace(/\sid="[^"]*"/gi, "");
  s = s.replace(/\sdata-[\w-]+="[^"]*"/gi, "");
  return s;
}

function stripFontFamilyAndSizeFromInlineStyles(html: string): string {
  return html.replace(/\sstyle="([^"]*)"/gi, (_match, styleRaw) => {
    const allowed: string[] = [];
    for (const chunk of styleRaw.split(";")) {
      const idx = chunk.indexOf(":");
      if (idx < 0) continue;
      const prop = chunk.slice(0, idx).trim().toLowerCase();
      const val = chunk.slice(idx + 1).trim();
      if (!val) continue;
      if (prop === "font-family" || prop === "font-size") continue;
      if (prop === "color" && isSafePdfColor(val)) allowed.push(`color:${val}`);
      if ((prop === "background-color" || prop === "background") && isSafePdfColor(val)) {
        allowed.push(`background-color:${val}`);
      }
    }
    return allowed.length ? ` style="${allowed.join(";")}"` : "";
  });
}

function stripDecorativeInlineStylesFromSemanticTags(html: string): string {
  return html.replace(
    /<(strong|b|em|i|u|s|strike|del)(\s[^>]*?)\sstyle="[^"]*"([^>]*)>/gi,
    "<$1$2$3>",
  );
}

/**
 * Ielīmēts HTML → editora noklusējuma fonts/izmērs; saglabā treknrakstu, kursīvu, pasvītrojumu,
 * pārsvītrojumu, teksta krāsu un izcēlumu.
 */
export function normalizePastedAdminRichHtml(html: string): string {
  let s = coerceAdminRichHtmlForDisplay(html);
  s = stripWordPasteBoilerplate(s);
  s = normalizeLegacyFontTags(s);
  s = normalizeMarkTags(s);
  s = promoteInlineStyleSemantics(s);
  s = stripFontFamilyAndSizeFromInlineStyles(s);
  s = stripDecorativeInlineStylesFromSemanticTags(s);
  s = s.replace(/<span\s*>([\s\S]*?)<\/span>/gi, "$1");
  return s.trim();
}

/**
 * Redaktora `innerHTML` → glabāšanai vienots formāts: `<font>` un `<mark>` vietā `<span style>`.
 * Tā glabātais HTML vienmēr ir tāds, kādu PDF konvertācija prot lasīt.
 */
export function normalizeEditorRichHtmlForStorage(html: string): string {
  let s = coerceAdminRichHtmlForDisplay(html);
  if (!s.trim()) return "";
  s = normalizeLegacyFontTags(s);
  s = normalizeMarkTags(s);
  s = s.replace(/<span\s*>([\s\S]*?)<\/span>/gi, "$1");
  return s;
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
    if ((prop === "background-color" || prop === "background") && isSafePdfColor(val)) {
      allowed.push(`background-color:${val}`);
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

/** Iekšējie tagi, ko PDF drīkst saturēt. Viss cits tiek izmests kopā ar aizverošo tagu. */
const PDF_INLINE_TAG_ALIASES: Record<string, "strong" | "em" | "u" | "s" | "span"> = {
  strong: "strong",
  b: "strong",
  em: "em",
  i: "em",
  u: "u",
  s: "s",
  strike: "s",
  del: "s",
  span: "span",
  font: "span",
  mark: "span",
};

type OpenPdfTag = { kind: "strong" | "em" | "u" | "s" | "span"; style: string };

function openTagHtml(tag: OpenPdfTag): string {
  if (tag.kind !== "span") return `<${tag.kind}>`;
  return tag.style ? `<span style="${tag.style}">` : "";
}

function closeTagHtml(tag: OpenPdfTag): string {
  if (tag.kind !== "span") return `</${tag.kind}>`;
  return tag.style ? "</span>" : "";
}

/**
 * Pārraksta atlikušos iekšējos tagus drošā, vienmēr līdzsvarotā HTML.
 *
 * Iepriekš to darīja regex + PUA marķieri, kas pie `<font color>` vai `<span>` bez stila
 * atstāja aizverošu `</span>` bez atverošā — PDF krāsa pazuda vai izjuka izkārtojums.
 */
function renderPdfSafeInlineHtml(input: string): string {
  const out: string[] = [];
  const stack: OpenPdfTag[] = [];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let cursor = 0;

  const pushText = (raw: string) => {
    if (!raw) return;
    out.push(escapeHtmlPlain(decodeBasicHtmlEntities(raw)));
  };

  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(input)) !== null) {
    pushText(input.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const isClosing = match[1] === "/";
    const kind = PDF_INLINE_TAG_ALIASES[match[2]!.toLowerCase()];
    if (!kind) continue;

    if (!isClosing) {
      let style = "";
      if (kind === "span") {
        const inline = /\sstyle\s*=\s*"([^"]*)"/i.exec(match[3] ?? "");
        style = sanitizePdfInlineStyle(inline?.[1] ?? "");
      }
      const tag: OpenPdfTag = { kind, style };
      stack.push(tag);
      out.push(openTagHtml(tag));
      continue;
    }

    const at = [...stack].reverse().findIndex((t) => t.kind === kind);
    if (at < 0) continue;
    const index = stack.length - 1 - at;
    /** Aizver visu virs meklētā taga, pēc tam atver atpakaļ — koriģē pārklājošos tagus. */
    const above = stack.splice(index + 1);
    for (const t of [...above].reverse()) out.push(closeTagHtml(t));
    const target = stack.pop();
    if (target) out.push(closeTagHtml(target));
    for (const t of above) {
      stack.push(t);
      out.push(openTagHtml(t));
    }
  }
  pushText(input.slice(cursor));
  for (const t of [...stack].reverse()) out.push(closeTagHtml(t));
  return out.join("");
}

/**
 * Admin bagātinātais HTML → drošs PDF HTML: `strong`, `em`, `u`, `s` un `span`
 * ar krāsu / izcēluma fonu / izmēru / fontu. Pārējie tagi tiek noņemti.
 */
export function adminRichHtmlToPdfSafeHtml(html: string): string {
  let s = coerceAdminRichHtmlForDisplay(html);
  if (!s.trim()) return "";

  s = normalizeLegacyFontTags(s);
  s = normalizeMarkTags(s);
  s = promoteInlineStyleSemantics(s);
  s = normalizeRichHtmlBlockLineBreaks(s);
  s = renderPdfSafeInlineHtml(s);
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/\n+$/g, "");
  s = s.replace(/\r?\n/g, "<br />");
  return s.trim();
}
