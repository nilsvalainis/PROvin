import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import { irissScanOrderId } from "@/lib/iriss-scan-listings";
import { IRISS_SCAN_SOURCES, type IrissScanLinkKey } from "@/lib/iriss-scan-sources";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

export function formatIrissScanTitle(brandModel: string | null | undefined): string {
  const t = (brandModel ?? "").trim();
  return t || "Bez nosaukuma";
}

export function formatIrissScanSourcesText(
  rec: Pick<IrissScanRecord, IrissScanLinkKey>,
): string {
  const parts: string[] = [];
  for (const s of IRISS_SCAN_SOURCES) {
    const n = filledIrissListingLinks(rec[s.key]).length;
    if (n <= 0) continue;
    parts.push(n > 1 ? `${s.label} ${n}` : s.label);
  }
  return parts.join(" · ");
}

export function countIrissScanLinks(rec: Pick<IrissScanRecord, IrissScanLinkKey>): number {
  return IRISS_SCAN_SOURCES.reduce((n, s) => n + filledIrissListingLinks(rec[s.key]).length, 0);
}

export function formatIrissScanLastRead(iso: string | null | undefined): string {
  const raw = (iso ?? "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]} ${m[4]}:${m[5]}`;
}

export function formatIrissScanNewHitsLabel(count: number): string {
  if (count <= 0) return "";
  return `${count} jauni`;
}

export function countIrissScanNewHitsByScan(
  entries: readonly { orderId: string; status: string }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.status !== "jauns") continue;
    const orderId = (e.orderId ?? "").trim();
    if (!orderId.startsWith("scan:")) continue;
    const scanId = orderId.slice("scan:".length).trim();
    if (!scanId) continue;
    out[scanId] = (out[scanId] ?? 0) + 1;
  }
  return out;
}

export function irissScanNewHitsFor(scanId: string, newHitsByScan: Record<string, number>): number {
  return newHitsByScan[scanId] ?? newHitsByScan[irissScanOrderId(scanId)] ?? 0;
}
