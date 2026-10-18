/**
 * Pilnīgs zaudējums / bojāeja no šī pasūtījuma avotiem. Bez EUR tāmēm klientam.
 * Meklē strukturētos laukos un (ar noliegumu / šablonu filtru) komentāros.
 */
import { CSDD_COMMENT_EUCARIS_PLAIN } from "@/lib/admin-csdd-comment-presets";
import {
  CC_VIN_AUCTION_CHECK_PLAIN,
  isCcVinAuctionCheckComment,
} from "@/lib/admin-cc-vin-comment-presets";
import { LTAB_COMMENT_NO_OCTA_CLAIM } from "@/lib/admin-ltab-comment-presets";
import { LISTING_PHOTO_NO_DEFECTS_TEXT } from "@/lib/admin-listing-photo-comment-presets";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { SHARED_SOURCE_COMMENT_TEMPLATES } from "@/lib/admin-source-comment-presets";

export const TOTAL_LOSS_RE =
  /pilnīg[uaos]\s+zaudēj|atzīts par bojāeju|reģistrēta bojāeja|total\s*loss|\btotaled\b|\bsalvage\b|ziņots par pilnīgu|record of totaled|apdrošināšanas total loss/i;

const TEMPLATE_PLAIN_SNIPPETS = [
  CC_VIN_AUCTION_CHECK_PLAIN,
  LTAB_COMMENT_NO_OCTA_CLAIM,
  CSDD_COMMENT_EUCARIS_PLAIN,
  LISTING_PHOTO_NO_DEFECTS_TEXT,
  ...SHARED_SOURCE_COMMENT_TEMPLATES.map((t) => t.text),
]
  .map((s) => s.replace(/\s+/g, " ").trim())
  .filter(Boolean);

const EXPLANATORY_TOTAL_LOSS_RE =
  /var norādīt uz potenciālu pilnīgu zaudēj|automātiski nenozīmē|ieraksti netika atrasti|nav pilnīg/i;

export type TotalLossHit = {
  found: boolean;
  evidence: string;
};

export type TotalLossSourceInput = {
  manualVendorBlocks?: Array<{
    title?: string;
    comments?: string;
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

function squish(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripKnownTemplates(htmlOrPlain: string): string {
  if (!htmlOrPlain.trim()) return "";
  if (isCcVinAuctionCheckComment(htmlOrPlain)) return "";
  let plain = squish(adminRichHtmlToPlainText(htmlOrPlain));
  if (!plain) return "";
  for (const snippet of TEMPLATE_PLAIN_SNIPPETS) {
    if (!snippet) continue;
    if (plain === snippet) return "";
    if (plain.includes(snippet)) plain = squish(plain.replace(snippet, " "));
  }
  return plain;
}

function isNegatedMatch(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 80), index);
  const window = before.replace(/[.,;:()[\]"'«»]/g, " ");
  return /(?:^|\s)(nav|netika|bez|nenozīmē|potenciāl\w*|vai|iespējam\w*|ne|not|without|no)\s+(?:\S+\s+){0,5}$/i.test(
    `${window} `,
  );
}

function isExplanatoryMatch(text: string, index: number): boolean {
  const around = text.slice(Math.max(0, index - 80), index + 90);
  return EXPLANATORY_TOTAL_LOSS_RE.test(around);
}

function matchTotalLoss(text: string): TotalLossHit | null {
  const blob = squish(text);
  if (!blob) return null;
  const re = new RegExp(TOTAL_LOSS_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    const idx = m.index ?? 0;
    if (isNegatedMatch(blob, idx)) continue;
    if (isExplanatoryMatch(blob, idx)) continue;
    const evidence = blob.slice(Math.max(0, idx - 40), idx + 80).trim();
    return { found: true, evidence };
  }
  return null;
}

function structuredParts(input: TotalLossSourceInput): string[] {
  const parts: string[] = [];
  for (const b of input.manualVendorBlocks ?? []) {
    for (const r of b.incidentRows ?? []) {
      parts.push(r.csngDate ?? "", r.lossAmount ?? "", r.incidentNo ?? "");
    }
    for (const t of b.vehicleHistoryTimeline ?? []) {
      parts.push(t.date ?? "", t.description ?? "", t.country ?? "");
    }
  }
  const ltab = input.manualLtabBlock;
  if (ltab) {
    for (const r of ltab.rows ?? []) parts.push(r.csngDate ?? "", r.lossAmount ?? "", r.incidentNo ?? "");
  }
  const cc = input.ccVinBlock;
  if (cc) {
    for (const d of cc.damages ?? []) parts.push(d.date ?? "", d.description ?? "", d.region ?? "");
    for (const r of cc.brands ?? []) parts.push(r.date ?? "", r.label ?? "", r.detail ?? "");
    for (const r of cc.titles ?? []) parts.push(r.date ?? "", r.note ?? "", r.region ?? "");
  }
  const asv = input.asvBlock;
  if (asv) {
    for (const d of asv.damages ?? []) parts.push(d.date ?? "", d.description ?? "", d.region ?? "");
  }
  return parts.filter(Boolean);
}

function commentParts(input: TotalLossSourceInput): string[] {
  const parts: string[] = [];
  for (const b of input.manualVendorBlocks ?? []) {
    const stripped = stripKnownTemplates(b.comments ?? "");
    if (stripped) parts.push(stripped);
  }
  const ltab = input.manualLtabBlock;
  if (ltab) {
    const stripped = stripKnownTemplates(ltab.comments ?? "");
    if (stripped) parts.push(stripped);
  }
  const cc = input.ccVinBlock;
  if (cc) {
    const stripped = stripKnownTemplates(cc.comments ?? "");
    if (stripped) parts.push(stripped);
  }
  const asv = input.asvBlock;
  if (asv) {
    const stripped = stripKnownTemplates(asv.comments ?? "");
    if (stripped) parts.push(stripped);
  }
  return parts;
}

export function detectTotalLossFromPdfInput(input: TotalLossSourceInput): TotalLossHit {
  const structured = matchTotalLoss(structuredParts(input).join("\n"));
  if (structured) return structured;
  const comments = matchTotalLoss(commentParts(input).join("\n"));
  if (comments) return comments;
  return { found: false, evidence: "" };
}

export function headerMentionsTotalLoss(text: string): boolean {
  return /pilnīg|bojāej|total\s*loss|zaudējums/i.test(text);
}
