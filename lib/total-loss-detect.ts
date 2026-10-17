/**
 * Pilnīgs zaudējums / bojāeja no šī pasūtījuma avotiem. Bez EUR tāmēm klientam.
 */
export const TOTAL_LOSS_RE =
  /pilnīg[uaos]\s+zaudēj|bojāej|total\s*loss|\btotaled\b|\bsalvage\b|ziņots par pilnīgu|record of totaled|apdrošināšanas total loss/i;

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

function blobFromInput(input: TotalLossSourceInput): string {
  const parts: string[] = [];
  for (const b of input.manualVendorBlocks ?? []) {
    parts.push(b.title ?? "", b.comments ?? "");
    for (const r of b.incidentRows ?? []) {
      parts.push(r.csngDate ?? "", r.lossAmount ?? "", r.incidentNo ?? "");
    }
    for (const t of b.vehicleHistoryTimeline ?? []) {
      parts.push(t.date ?? "", t.description ?? "", t.country ?? "");
    }
  }
  const ltab = input.manualLtabBlock;
  if (ltab) {
    parts.push(ltab.comments ?? "");
    for (const r of ltab.rows ?? []) parts.push(r.csngDate ?? "", r.lossAmount ?? "", r.incidentNo ?? "");
  }
  const cc = input.ccVinBlock;
  if (cc) {
    parts.push(cc.comments ?? "");
    for (const d of cc.damages ?? []) parts.push(d.date ?? "", d.description ?? "", d.region ?? "");
    for (const r of cc.brands ?? []) parts.push(r.date ?? "", r.label ?? "", r.detail ?? "");
    for (const r of cc.titles ?? []) parts.push(r.date ?? "", r.note ?? "", r.region ?? "");
  }
  const asv = input.asvBlock;
  if (asv) {
    parts.push(asv.comments ?? "");
    for (const d of asv.damages ?? []) parts.push(d.date ?? "", d.description ?? "", d.region ?? "");
  }
  return parts.filter(Boolean).join("\n");
}

export function detectTotalLossFromPdfInput(input: TotalLossSourceInput): TotalLossHit {
  const blob = blobFromInput(input);
  const m = blob.match(TOTAL_LOSS_RE);
  if (!m) return { found: false, evidence: "" };
  const idx = m.index ?? 0;
  const evidence = blob.slice(Math.max(0, idx - 40), idx + 80).replace(/\s+/g, " ").trim();
  return { found: true, evidence };
}

export function headerMentionsTotalLoss(text: string): boolean {
  return /pilnīg|bojāej|total\s*loss|zaudējums/i.test(text);
}
