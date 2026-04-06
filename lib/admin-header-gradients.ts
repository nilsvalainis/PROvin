/**
 * Avotu un prioritāro bloku galvenes: viena krāsa ar maigu „metālisku” dziļumu
 * (tikai tā paša toņa gaišākas/tumšākas malas — bez raibām krāsu pārēm).
 */

import type { SourceBlockKey } from "@/lib/admin-source-blocks";

/** Metālisks: vieglāks augšējā kreisajā stūrī, tumšāks apakšējā labajā. */
const G = {
  /** CSDD & Sludinājuma analīze: tumši zaļš */
  csdd: "linear-gradient(148deg, #1a5f3f 0%, #14532d 46%, #0d3d2a 100%)",
  /** AutoDNA: tumši zils */
  autodna: "linear-gradient(148deg, #1a3048 0%, #1e3a5f 46%, #0f2135 100%)",
  /** CarVertical: spilgti dzeltens */
  carvertical: "linear-gradient(148deg, #fde047 0%, #facc15 46%, #eab308 100%)",
  /** Auto-Records: oranžs */
  auto_records: "linear-gradient(148deg, #fb923c 0%, #ea580c 46%, #c2410c 100%)",
  /** LTAB: tumši sarkans */
  ltab: "linear-gradient(148deg, #a31e1e 0%, #7f1d1d 46%, #5c0a0a 100%)",
  /** Tirgus dati: tumši zils (citāds metālisks nekā AutoDNA) */
  tirgus: "linear-gradient(148deg, #1a4a6e 0%, #0c4a6e 46%, #0a3d55 100%)",
  /** Citi avoti: violets */
  citi_avoti: "linear-gradient(148deg, #6d28d9 0%, #5b21b6 46%, #4c1d95 100%)",
  /** Kā CSDD */
  listing_analysis: "linear-gradient(148deg, #1a5f3f 0%, #14532d 46%, #0d3d2a 100%)",
} as const satisfies Record<SourceBlockKey, string>;

export const SOURCE_BLOCK_HEADER_BG: Record<SourceBlockKey, string> = G;

/** Teksts uz joslas: balts uz tumšiem; dzeltens — tumšs. */
export const SOURCE_BLOCK_HEADER_TEXT_CLASS: Record<SourceBlockKey, string> = {
  csdd: "text-white",
  ltab: "text-white",
  tirgus: "text-white",
  autodna: "text-white",
  carvertical: "text-slate-900",
  auto_records: "text-white",
  citi_avoti: "text-white",
  listing_analysis: "text-white",
};

/** Approved by IRISS: sudraba / metāliski pelēks (premium zīmogs) */
export const APPROVED_BY_IRISS_HEADER_BG =
  "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 28%, #cbd5e1 52%, #94a3b8 78%, #d1d5db 100%)";

export const VENDOR_FALLBACK_HEADER_BG =
  "linear-gradient(148deg, #52525b 0%, #3f3f46 50%, #27272a 100%)";
