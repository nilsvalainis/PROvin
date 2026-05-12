/**
 * Klienta PDF — nobraukuma tabulas rindas avota vizuālais kodējums (krāsaina svītriņa).
 */

import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";

export type MileagePdfSourceKey = "csdd" | "autodna" | "carvertical" | "dealer" | "cits" | "unknown";

function normLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function squishLower(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Kartē `UnifiedMileageRow.sourceLabel` uz PDF svītriņas kategoriju.
 * Neizmaina datu vākšanu — tikai vizuālo interpretāciju.
 */
export function mileageSourceLabelToPdfKey(raw: string): MileagePdfSourceKey {
  const t = normLabel(raw);
  const sq = squishLower(raw);

  if (t === normLabel(SOURCE_BLOCK_LABELS.csdd)) return "csdd";

  if (t === normLabel(SOURCE_BLOCK_LABELS.autodna) || sq.includes("autodna")) return "autodna";

  if (t === normLabel(SOURCE_BLOCK_LABELS.carvertical) || sq === "carvertical") return "carvertical";

  if (
    t === normLabel(SOURCE_BLOCK_LABELS.auto_records) ||
    t === "auto records" ||
    raw.trim() === "AUTO RECORDS"
  ) {
    return "dealer";
  }

  if (t === normLabel(SOURCE_BLOCK_LABELS.citi_avoti) || sq === "citiavoti") {
    return "cits";
  }

  return "unknown";
}

/** Leģendas teksti PDF piezīmei (pilns nosaukums = saīsinājums). */
export const MILEAGE_PDF_SOURCE_LEGEND: Record<
  Exclude<MileagePdfSourceKey, "unknown">,
  { full: string; abbrev: string }
> = {
  csdd: { full: "CSDD", abbrev: "CSDD" },
  autodna: { full: "AutoDNA", abbrev: "DNA" },
  carvertical: { full: "Car Vertical", abbrev: "CV" },
  dealer: { full: "OFICIĀLĀ DĪLERA DATI", abbrev: "DEALER" },
  cits: { full: "Citi Avoti", abbrev: "CITS" },
};

/** Secība leģendas izdrukai (PDF). */
export const MILEAGE_PDF_SOURCE_LEGEND_ORDER: Exclude<MileagePdfSourceKey, "unknown">[] = [
  "csdd",
  "autodna",
  "carvertical",
  "dealer",
  "cits",
];

export function collectMileagePdfSourceKeysFromLabels(labels: Iterable<string>): Set<MileagePdfSourceKey> {
  const out = new Set<MileagePdfSourceKey>();
  for (const raw of labels) {
    out.add(mileageSourceLabelToPdfKey(raw));
  }
  return out;
}

export function mileagePdfLegendKeysInOrder(keys: Set<MileagePdfSourceKey>): Exclude<MileagePdfSourceKey, "unknown">[] {
  return MILEAGE_PDF_SOURCE_LEGEND_ORDER.filter((k) => keys.has(k));
}
