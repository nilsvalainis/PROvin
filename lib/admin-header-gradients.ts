/**
 * Galvenes: neitrāli avoti (pelēks) + eksperta bloki (zaļš / zils).
 * Avotu „identitāte” — tikai mazā krāsainā iezīme Admin (SOURCE_BLOCK_BRAND_DOT).
 */

import type { SourceBlockKey } from "@/lib/admin-source-blocks";

/** Vienota neitrāla josla ārējiem avotiem (CSDD, AutoDNA, …). */
export const NEUTRAL_AVOTU_HEADER_BG = "#E2E8F0";

/** Sludinājuma analīze: tumši zaļš (eksperts). */
export const LISTING_ANALYSIS_HEADER_BG =
  "linear-gradient(148deg, #3d6b5a 0%, #2f5a4a 46%, #264a3d 100%)";

/** Sludinājuma analīzes bloka iekšpuse: blāvi zaļš → balts. */
export const LISTING_ANALYSIS_BODY_BG =
  "linear-gradient(to bottom, #F0F9F0 0%, #ffffff 100%)";

/** APPROVED BY IRISS: karaliski / pusnakts zils. */
export const APPROVED_BY_IRISS_HEADER_BG =
  "linear-gradient(135deg, #2563eb 0%, #1d4ed8 42%, #1e40af 78%, #172554 100%)";

/** APPROVED BY IRISS ķermenis — maigi zilgans. */
export const APPROVED_BY_IRISS_BODY_BG = "#F0F4F8";

export const VENDOR_FALLBACK_HEADER_BG = NEUTRAL_AVOTU_HEADER_BG;

const G: Record<SourceBlockKey, string> = {
  csdd: NEUTRAL_AVOTU_HEADER_BG,
  autodna: NEUTRAL_AVOTU_HEADER_BG,
  carvertical: NEUTRAL_AVOTU_HEADER_BG,
  auto_records: NEUTRAL_AVOTU_HEADER_BG,
  ltab: NEUTRAL_AVOTU_HEADER_BG,
  tirgus: NEUTRAL_AVOTU_HEADER_BG,
  citi_avoti: NEUTRAL_AVOTU_HEADER_BG,
  listing_analysis: LISTING_ANALYSIS_HEADER_BG,
};

export const SOURCE_BLOCK_HEADER_BG: Record<SourceBlockKey, string> = G;

/** Avotu joslā: tumši pelēks; sludinājumam — balts uz zaļu. */
export const SOURCE_BLOCK_HEADER_TEXT_CLASS: Record<SourceBlockKey, string> = {
  csdd: "text-slate-700",
  autodna: "text-slate-700",
  carvertical: "text-slate-700",
  auto_records: "text-slate-700",
  ltab: "text-slate-700",
  tirgus: "text-slate-700",
  citi_avoti: "text-slate-700",
  listing_analysis: "text-white",
};

/** Mazā krāsainā iezīme blakus nosaukumam (Admin). */
export const SOURCE_BLOCK_BRAND_DOT: Record<SourceBlockKey, string> = {
  csdd: "bg-emerald-500",
  autodna: "bg-blue-700",
  carvertical: "bg-amber-400",
  auto_records: "bg-orange-500",
  ltab: "bg-red-600",
  tirgus: "bg-sky-600",
  citi_avoti: "bg-violet-600",
  listing_analysis: "bg-emerald-300",
};
