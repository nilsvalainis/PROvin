/**
 * PROVIN SELECT konsultācijas admin cilņu „luksofors” (tukšs / daļēji / gatavs).
 */

import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { csddTrafficLevel, ltabTrafficLevel } from "@/lib/admin-block-traffic-status";
import type { ConsultationSlotDraft } from "@/lib/admin-consultation-draft-types";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

function linkAndPriceLevel(listingUrl: string, salePrice: string): TrafficFillLevel {
  const l = listingUrl.trim();
  const p = salePrice.trim();
  if (!l && !p) return "empty";
  if (l && p) return "complete";
  return "partial";
}

function threeTextAreasLevel(a: string, b: string, c: string): TrafficFillLevel {
  const filled = [a, b, c].map((x) => x.trim().length > 0);
  const n = filled.filter(Boolean).length;
  if (n === 0) return "empty";
  if (n === 3) return "complete";
  return "partial";
}

function aggregateLevels(levels: TrafficFillLevel[]): TrafficFillLevel {
  if (levels.length === 0) return "empty";
  if (levels.every((x) => x === "complete")) return "complete";
  if (levels.every((x) => x === "empty")) return "empty";
  return "partial";
}

export function consultationSlotTabLevel(slot: ConsultationSlotDraft): TrafficFillLevel {
  const blocks = mergeSourceBlocksWithDefaults(slot.sourceBlocks as WorkspaceSourceBlocks);
  return aggregateLevels([
    linkAndPriceLevel(slot.listingUrl, slot.salePrice),
    csddTrafficLevel(blocks.csdd),
    ltabTrafficLevel(blocks.ltab),
    threeTextAreasLevel(slot.ieteikumiApskatei, slot.cenasAtbilstiba, slot.kopsavilkums),
  ]);
}

export function consultationClientTabLevel(p: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}): TrafficFillLevel {
  const n = [p.customerName, p.customerEmail, p.customerPhone].map((x) => x.trim().length > 0);
  const c = n.filter(Boolean).length;
  if (c === 0) return "empty";
  if (c === 3) return "complete";
  return "partial";
}

export function consultationSummaryTabLevel(irissApproved: string): TrafficFillLevel {
  const t = irissApproved.trim();
  if (!t) return "empty";
  return "complete";
}
