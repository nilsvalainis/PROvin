/**
 * Klienta PDF — nobraukuma tabulas rindas avota vizuālais kodējums (krāsaina svītriņa).
 */

import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";

export type MileagePdfSourceKey =
  | "csdd"
  | "autodna"
  | "carvertical"
  | "dealer"
  | "tjekbil"
  | "ee"
  | "carinfo"
  | "ltab"
  | "cits";

function normLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function squishLower(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Kartē `UnifiedMileageRow.sourceLabel` uz PDF svītriņas kategoriju.
 * Neizmaina datu vākšanu — tikai vizuālo interpretāciju.
 * Neatpazīti / tukši avoti → `cits` (leģendā „CITS”), nekad „?”.
 */
export function mileageSourceLabelToPdfKey(raw: string): MileagePdfSourceKey {
  const t = normLabel(raw);
  const sq = squishLower(raw);

  if (!t || t === "nezināms avots" || t === "nezinams avots" || sq === "?" || sq === "-?") {
    return "cits";
  }

  if (t === normLabel(SOURCE_BLOCK_LABELS.csdd) || sq === "csdd") return "csdd";

  if (
    t === normLabel(SOURCE_BLOCK_LABELS.autodna) ||
    sq.includes("autodna") ||
    sq === "dna"
  ) {
    return "autodna";
  }

  if (
    t === normLabel(SOURCE_BLOCK_LABELS.carvertical) ||
    sq === "carvertical" ||
    sq === "cv"
  ) {
    return "carvertical";
  }

  if (
    t === normLabel(SOURCE_BLOCK_LABELS.auto_records) ||
    t === "auto records" ||
    raw.trim() === "AUTO RECORDS" ||
    sq === "dealer" ||
    sq === "oficialadileradati"
  ) {
    return "dealer";
  }

  if (t === normLabel(SOURCE_BLOCK_LABELS.ltab) || sq === "ltab") {
    return "ltab";
  }

  if (t === normLabel(SOURCE_BLOCK_LABELS.tjekbil) || sq.includes("tjekbil")) {
    return "tjekbil";
  }
  if (
    t === normLabel(SOURCE_BLOCK_LABELS.mnt_ee) ||
    t === normLabel(SOURCE_BLOCK_LABELS.lkf_ee) ||
    sq.includes("mnt.ee") ||
    sq.includes("lkf.ee") ||
    sq === "igaunija"
  ) {
    return "ee";
  }
  if (t === normLabel(SOURCE_BLOCK_LABELS.carinfo) || sq.includes("car.info") || sq === "carinfo") {
    return "carinfo";
  }

  if (
    t === normLabel(SOURCE_BLOCK_LABELS.citi_avoti) ||
    sq === "citiavoti" ||
    sq === "cits" ||
    t === "citi avoti"
  ) {
    return "cits";
  }

  // Neatpazīts nosaukums (pielāgots „Citi avoti” label, brīvs teksts u.c.) → CITS.
  return "cits";
}

/** Leģendas teksti PDF piezīmei (pilns nosaukums = saīsinājums). */
export const MILEAGE_PDF_SOURCE_LEGEND: Record<MileagePdfSourceKey, { full: string; abbrev: string }> = {
  csdd: { full: "CSDD", abbrev: "CSDD" },
  autodna: { full: "AutoDNA", abbrev: "DNA" },
  carvertical: { full: "Car Vertical", abbrev: "CV" },
  dealer: { full: "OFICIĀLĀ DĪLERA DATI", abbrev: "DEALER" },
  tjekbil: { full: SOURCE_BLOCK_LABELS.tjekbil, abbrev: "DK" },
  ee: { full: "Igaunijas reģistri", abbrev: "EE" },
  carinfo: { full: SOURCE_BLOCK_LABELS.carinfo, abbrev: "INFO" },
  ltab: { full: "LTAB", abbrev: "LTAB" },
  cits: { full: "Citi Avoti", abbrev: "CITS" },
};

/** Secība leģendas izdrukai (PDF). */
export const MILEAGE_PDF_SOURCE_LEGEND_ORDER: MileagePdfSourceKey[] = [
  "csdd",
  "autodna",
  "carvertical",
  "dealer",
  "tjekbil",
  "ee",
  "carinfo",
  "ltab",
  "cits",
];

export function collectMileagePdfSourceKeysFromLabels(labels: Iterable<string>): Set<MileagePdfSourceKey> {
  const out = new Set<MileagePdfSourceKey>();
  for (const raw of labels) {
    out.add(mileageSourceLabelToPdfKey(raw));
  }
  return out;
}

export function mileagePdfLegendKeysInOrder(keys: Set<MileagePdfSourceKey>): MileagePdfSourceKey[] {
  return MILEAGE_PDF_SOURCE_LEGEND_ORDER.filter((k) => keys.has(k));
}
