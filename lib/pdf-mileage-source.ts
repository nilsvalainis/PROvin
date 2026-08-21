/**
 * Klienta PDF — nobraukuma tabulas rindas avota vizuālais kodējums (krāsaina svītriņa).
 */

import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { CC_VIN_PDF_SOURCE_LABEL } from "@/lib/cc-vin-report";

export type MileagePdfSourceKey =
  | "csdd"
  | "autodna"
  | "carvertical"
  | "dealer"
  | "tjekbil"
  | "ee"
  | "carinfo"
  | "ltab"
  | "intl"
  | "sslv"
  | "cits";

function normLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Bez atstarpēm un bez garumzīmēm — „DĪLERA DATI” un „DILERA DATI” ir viens avots. */
function squishLower(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
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
    sq === "oficialadileradati" ||
    sq === "razotajaundileradati" ||
    sq === "dileradati"
  ) {
    return "dealer";
  }

  if (sq === squishLower(CC_VIN_PDF_SOURCE_LABEL) || sq === "starptautiskavesture") {
    return "intl";
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
  if (
    t === normLabel(SOURCE_BLOCK_LABELS.carinfo) ||
    sq.includes("car.info") ||
    sq === "carinfo" ||
    sq.includes("zviedrijasregistri")
  ) {
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

  if (
    sq === "sslv" ||
    sq === "ss.com" ||
    sq.includes("ss.lv") ||
    t === "sludinājums" ||
    t === normLabel(SOURCE_BLOCK_LABELS.listing_analysis) ||
    t === "tirgus dati"
  ) {
    return "sslv";
  }

  // Neatpazīts nosaukums (pielāgots „Citi avoti” label, brīvs teksts u.c.) → CITS.
  return "cits";
}

/** Leģendas teksti PDF piezīmei (pilns nosaukums = saīsinājums). */
export const MILEAGE_PDF_SOURCE_LEGEND: Record<MileagePdfSourceKey, { full: string; abbrev: string }> = {
  csdd: { full: "CSDD", abbrev: "CSDD" },
  autodna: { full: "AutoDNA", abbrev: "DNA" },
  carvertical: { full: "carVertical", abbrev: "CV" },
  dealer: { full: "DĪLERA DATI", abbrev: "DEALER" },
  tjekbil: { full: SOURCE_BLOCK_LABELS.tjekbil, abbrev: "DK" },
  ee: { full: "Igaunijas reģistri", abbrev: "EE" },
  carinfo: { full: SOURCE_BLOCK_LABELS.carinfo, abbrev: "SE" },
  ltab: { full: "LTAB", abbrev: "LTAB" },
  intl: { full: CC_VIN_PDF_SOURCE_LABEL, abbrev: "INTL" },
  sslv: { full: "ss.lv", abbrev: "SS.LV" },
  cits: { full: "Citi avoti", abbrev: "CITS" },
};

/**
 * Avotu punktu krāsas — viens kods visā PDF: laikposms, nobraukums, negadījumi,
 * „Kas tika pārbaudīts”, sadaļu augšmalas akcents.
 */
export const MILEAGE_PDF_SOURCE_COLOR: Record<MileagePdfSourceKey, string> = {
  csdd: "#16A34A",
  autodna: "#1E3A8A",
  carvertical: "#EAB308",
  dealer: "#EA580C",
  tjekbil: "#BE123C",
  ee: "#0E7490",
  carinfo: "#0F766E",
  ltab: "#DC2626",
  intl: "#7C3AED",
  sslv: "#059669",
  cits: "#94A3B8",
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
  "intl",
  "sslv",
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
