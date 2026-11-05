/**
 * Pilnīgs zaudējums / bojāeja no šī pasūtījuma avotiem. Bez EUR tāmēm klientam.
 * Kartīti „Pilnīgs zaudējums” nosaka TIKAI strukturētie avotu lauki (negadījumu rindas,
 * vēstures laika līnija, CC VIN zīmoli/tituli/bojājumi, ASV bojājumi, reģistru statusi).
 * Brīvteksta / AI komentāri kartīti NEIESLĒDZ: tajos bieži ir glosāriji, noliegumi,
 * „ierakstu nav” u.tml., kas deva viltus „Pilnīgs zaudējums”.
 */

import { CSDD_COMMENT_EUCARIS_PLAIN } from "@/lib/admin-csdd-comment-presets";
import {
  CC_VIN_AUCTION_CHECK_PLAIN,
  isCcVinAuctionCheckComment,
} from "@/lib/admin-cc-vin-comment-presets";
import { LTAB_COMMENT_NO_OCTA_CLAIM } from "@/lib/admin-ltab-comment-presets";
import {
  LISTING_PHOTO_NO_DEFECTS_LEGACY_TEXT,
  LISTING_PHOTO_NO_DEFECTS_TEXT,
} from "@/lib/admin-listing-photo-comment-presets";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { SHARED_SOURCE_COMMENT_TEMPLATES } from "@/lib/admin-source-comment-presets";

const NB = "(?<![\\p{L}\\p{N}])";
const NA = "(?![\\p{L}\\p{N}])";

/**
 * Pozitīvie atslēgvārdi (LV, EN, EE, DE, FR). `pilnīg… zaudēj` atļauj arī salipušu
 * formu („pilnīguzaudējumu”), ko dod AutoDNA PDF teksta izvilkums.
 */
export const TOTAL_LOSS_RE = new RegExp(
  [
    "pilnīg[uaos]\\s*zaudēj",
    "atzīts par bojāeju",
    "reģistrēta bojāeja",
    "total\\s*loss",
    `${NB}totaled${NA}`,
    `${NB}salvage${NA}`,
    "ziņots par pilnīgu",
    "record of totaled",
    "apdrošināšanas total loss",
    "majanduslikus\\s+mõttes\\s+hävinenud",
    `${NB}hävinenud${NA}`,
    "totalschaden",
    "véhicule\\s+gravement\\s+endommagé",
    `${NB}épave${NA}`,
    // FR saīsinājums tikai lielajiem burtiem (skat. matchTotalLoss).
    `${NB}VGE${NA}`,
  ].join("|"),
  "iu",
);

/** Komentāru brīdinājumam: arī „norakstīts / norakstījums” (kartīti tas neieslēdz). */
const COMMENT_TOTAL_LOSS_RE = new RegExp(
  `${TOTAL_LOSS_RE.source}|${NB}norakst(?:īt|ījum)\\p{L}*`,
  "iu",
);

const TEMPLATE_PLAIN_SNIPPETS = [
  CC_VIN_AUCTION_CHECK_PLAIN,
  LTAB_COMMENT_NO_OCTA_CLAIM,
  CSDD_COMMENT_EUCARIS_PLAIN,
  LISTING_PHOTO_NO_DEFECTS_TEXT,
  LISTING_PHOTO_NO_DEFECTS_LEGACY_TEXT,
  ...SHARED_SOURCE_COMMENT_TEMPLATES.map((t) => t.text),
]
  .map((s) => s.replace(/\s+/g, " ").trim())
  .filter(Boolean);

const EXPLANATORY_TOTAL_LOSS_RE =
  /var norādīt uz potenciālu pilnīgu zaudēj|automātiski nenozīmē|ieraksti netika atrasti|nav pilnīg/i;

/** Glosārija / skaidrojuma rinda (carVertical definīcijas), nevis ieraksts. */
const GLOSSARY_LINE_RE = new RegExp(
  `${NB}(?:nozīmē|tiek atzīts|var tikt|ir tad, (?:ja|kad)|ja remont\\p{L}*|kad remont\\p{L}*|means|is when|is declared when|definīcij\\p{L}*|skaidrojum\\p{L}*)${NA}`,
  "iu",
);

/** Salvage skaitās tikai ar statusa / titula / zīmola / sertifikāta kontekstu. */
const SALVAGE_CONTEXT_RE = /title|brand|record|certificate|sertifikāt|statuss|status/i;

/** Noliegums PĒC atrastā vārda (tajā pašā teikumā, ~40 zīmes), arī „X: No” / „X: Nē” / „X: 0”. */
const AFTER_NEGATION_RE = new RegExp(
  `^[^.!?\\n;]{0,40}?(?:${NB}(?:nav|netika|nebija|nē|none|nein|puudub|ei\\s+ole)${NA}|${NB}not\\s+(?:found|recorded|reported|detected|registered)|:\\s*(?:no|nē|nav|none|nein|ei|0|-)${NA})`,
  "iu",
);

export type TotalLossHit = {
  found: boolean;
  evidence: string;
};

export type TotalLossSourceInput = {
  manualVendorBlocks?: Array<{
    title?: string;
    comments?: string;
    /** Reģistru bloki (MNT EE, Traficom, …): strukturēts statusu teksts. */
    statusRecords?: string;
    incidentRows?: Array<{ csngDate?: string; lossAmount?: string; incidentNo?: string }>;
    vehicleHistoryTimeline?: Array<{ date?: string; description?: string; country?: string }>;
  }> | null;
  manualLtabBlock?: {
    comments?: string;
    rows?: Array<{ csngDate?: string; lossAmount?: string; incidentNo?: string }>;
  } | null;
  ccVinBlock?: {
    comments?: string;
    damages?: Array<{ date?: string; description?: string; region?: string }>;
    brands?: Array<{ date?: string; label?: string; detail?: string }>;
    titles?: Array<{ date?: string; note?: string; region?: string }>;
  } | null;
  asvBlock?: {
    comments?: string;
    damages?: Array<{ date?: string; description?: string; region?: string }>;
  } | null;
};

function isNegatedBefore(text: string, index: number): boolean {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  const before = text.slice(Math.max(lineStart, index - 80), index);
  const window = before.replace(/[.,;:()[\]"'«»]/g, " ");
  return /(?:^|\s)(nav|netika|bez|nenozīmē|potenciāl\w*|vai|iespējam\w*|ne|not|without|no)\s+(?:\S+\s+){0,5}$/i.test(
    `${window} `,
  );
}

function isNegatedAfter(text: string, endIndex: number): boolean {
  return AFTER_NEGATION_RE.test(text.slice(endIndex, endIndex + 60));
}

function lineAround(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const endNl = text.indexOf("\n", index);
  return text.slice(start, endNl < 0 ? text.length : endNl);
}

function sentenceAround(line: string, index: number): string {
  let start = 0;
  for (const m of line.slice(0, index).matchAll(/[.!?]\s+/g)) start = (m.index ?? 0) + m[0].length;
  const rest = line.slice(index);
  const endM = rest.match(/[.!?](?:\s|$)/);
  const end = endM ? index + (endM.index ?? 0) + 1 : line.length;
  return line.slice(start, end);
}

/** Jautājums („Vai tas ir norakstīts?”) vai glosārija skaidrojums. */
function isQuestionOrGlossary(line: string, indexInLine: number): boolean {
  const sentence = sentenceAround(line, indexInLine).trim();
  if (/\?\s*$/.test(sentence)) return true;
  // carVertical BUJ: „… Vai tas ir norakstīts?” tajā pašā rindā.
  if (/(?:^|[.!?:\-]\s*)(?:vai|is it)\s[^?]{0,80}\?/i.test(line)) return true;
  if (GLOSSARY_LINE_RE.test(sentence)) return true;
  // „… atzīts par norakstāmu” bez gada teikumā = definīcija, nevis notikums.
  if (/atzīts par norakstām/i.test(sentence) && !/(?:19|20)\d{2}/.test(sentence)) return true;
  return false;
}

/** „Copart salvage izsole” / „Salvage auction records: 0” = nav statusa. */
function isWeakSalvage(matchText: string, text: string, index: number): boolean {
  if (!/^salvage$/i.test(matchText)) return false;
  const after = text.slice(index + matchText.length, index + matchText.length + 20);
  if (/^\s*(?:auction|izsol)/i.test(after)) return true;
  return !SALVAGE_CONTEXT_RE.test(lineAround(text, index));
}

function matchTotalLoss(text: string, pattern: RegExp = TOTAL_LOSS_RE): TotalLossHit | null {
  const blob = text.replace(/[ \t]+/g, " ").trim();
  if (!blob) return null;
  const re = new RegExp(pattern.source, "giu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    const idx = m.index ?? 0;
    const end = idx + m[0].length;
    const line = lineAround(blob, idx);
    // „vge” mazajiem burtiem nav FR statuss.
    if (/^vge$/i.test(m[0]) && m[0] !== "VGE") continue;
    if (isNegatedBefore(blob, idx)) continue;
    if (isNegatedAfter(blob, end)) continue;
    if (EXPLANATORY_TOTAL_LOSS_RE.test(line)) continue;
    if (isQuestionOrGlossary(line, idx - (blob.lastIndexOf("\n", idx) + 1))) continue;
    if (isWeakSalvage(m[0], blob, idx)) continue;
    const evidence = blob.slice(Math.max(0, idx - 40), idx + 80).trim();
    return { found: true, evidence };
  }
  return null;
}

/** Katrs strukturētais ieraksts ir sava rinda, lai noliegumi / konteksts nepārlec uz kaimiņu. */
function structuredLines(input: TotalLossSourceInput): string[] {
  const lines: string[] = [];
  const row = (...cells: Array<string | undefined>) => {
    const joined = cells
      .map((c) => (c ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ");
    if (joined) lines.push(joined);
  };
  for (const b of input.manualVendorBlocks ?? []) {
    for (const r of b.incidentRows ?? []) row(r.csngDate, r.lossAmount, r.incidentNo);
    for (const t of b.vehicleHistoryTimeline ?? []) row(t.date, t.description, t.country);
    for (const line of (b.statusRecords ?? "").split(/\n+/)) row(line);
  }
  for (const r of input.manualLtabBlock?.rows ?? []) row(r.csngDate, r.lossAmount, r.incidentNo);
  const cc = input.ccVinBlock;
  if (cc) {
    for (const d of cc.damages ?? []) row(d.date, d.description, d.region);
    for (const r of cc.brands ?? []) row(r.date, r.label, r.detail);
    for (const r of cc.titles ?? []) row(r.date, r.note, r.region);
  }
  for (const d of input.asvBlock?.damages ?? []) row(d.date, d.description, d.region);
  return lines;
}

/** Viena teksta pārbaude ar visiem noliegumu / glosārija filtriem (testiem un diagnostikai). */
export function textIndicatesTotalLoss(text: string): boolean {
  return matchTotalLoss(text) != null;
}

/**
 * Pilnīgs zaudējums tikai no strukturētiem avotu laukiem. `comments` (operatora vai AI)
 * netiek skatīti, lai viltus kartīte nerastos no skaidrojumiem / noliegumiem.
 */
export function detectTotalLossFromPdfInput(input: TotalLossSourceInput): TotalLossHit {
  return matchTotalLoss(structuredLines(input).join("\n")) ?? { found: false, evidence: "" };
}

/** Plain teksts bez zināmajiem sagatavju teikumiem (CC VIN izsoļu pārbaude, LTAB, CSDD, …). */
function stripKnownTemplates(htmlOrPlain: string): string {
  if (!htmlOrPlain.trim()) return "";
  if (isCcVinAuctionCheckComment(htmlOrPlain)) return "";
  const plain = adminRichHtmlToPlainText(htmlOrPlain).replace(/\r\n?/g, "\n");
  const flat = plain.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  let changed = false;
  let out = flat;
  for (const snippet of TEMPLATE_PLAIN_SNIPPETS) {
    if (!snippet) continue;
    if (out === snippet) return "";
    if (out.includes(snippet)) {
      out = out.replace(snippet, " ").replace(/\s+/g, " ").trim();
      changed = true;
    }
  }
  // Bez sagatavēm saglabā rindas (jautājumu / glosārija pārbaude ir pa rindām).
  return changed ? out : plain.trim();
}

export type TotalLossCommentField = { label: string; text: string };
export type TotalLossCommentMention = { label: string; quote: string };

/**
 * Komentāros (operatora vai AI) minēts pilnīgs zaudējums / norakstījums. Ar tiem pašiem
 * nolieguma, jautājuma un glosārija filtriem kā strukturētajiem laukiem. Kartīti NEIESLĒDZ:
 * izmanto tikai pirms PDF brīdinājumam, ja avotu datos tā nav.
 */
export function findTotalLossCommentMentions(
  fields: readonly TotalLossCommentField[] | null | undefined,
): TotalLossCommentMention[] {
  const out: TotalLossCommentMention[] = [];
  for (const f of fields ?? []) {
    const hit = matchTotalLoss(stripKnownTemplates(f.text ?? ""), COMMENT_TOTAL_LOSS_RE);
    if (hit) out.push({ label: f.label, quote: hit.evidence });
  }
  return out;
}

/** Komentāru lauki no PDF ievades (ja nav padoti klienta drukātie lauki). */
export function totalLossCommentFieldsFromInput(input: TotalLossSourceInput): TotalLossCommentField[] {
  const out: TotalLossCommentField[] = [];
  for (const b of input.manualVendorBlocks ?? []) {
    if (b.comments?.trim()) out.push({ label: b.title?.trim() || "Avots", text: b.comments });
  }
  if (input.manualLtabBlock?.comments?.trim()) out.push({ label: "LTAB", text: input.manualLtabBlock.comments });
  if (input.ccVinBlock?.comments?.trim()) out.push({ label: "CC VIN", text: input.ccVinBlock.comments });
  if (input.asvBlock?.comments?.trim()) out.push({ label: "ASV", text: input.asvBlock.comments });
  return out;
}

export function headerMentionsTotalLoss(text: string): boolean {
  return /pilnīg|bojāej|total\s*loss|zaudējums/i.test(text);
}
