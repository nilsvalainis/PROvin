/**
 * Avotu un prioritāro bloku galvenes: viena krāsa ar maigu „metālisku” dziļumu.
 * Krāsas ~25% maigākas (pasteļu / muted metallic), bez agresīvas piesātinājuma.
 */

import type { SourceBlockKey } from "@/lib/admin-source-blocks";

/** Metālisks: vieglāks augšējā kreisajā stūrī, tumšāks apakšējā labajā. */
const G = {
  /** CSDD & Sludinājuma analīze: maigs zaļš */
  csdd: "linear-gradient(148deg, #4a7d68 0%, #3d6b5a 46%, #2f5a4a 100%)",
  /** AutoDNA: maigs tumši zils */
  autodna: "linear-gradient(148deg, #3d5a6e 0%, #455a7a 46%, #2f3f52 100%)",
  /** CarVertical: maigs dzeltens */
  carvertical: "linear-gradient(148deg, #fef3c7 0%, #fde68a 46%, #fcd34d 100%)",
  /** Auto-Records: maigs oranžs */
  auto_records: "linear-gradient(148deg, #fdba8c 0%, #ea9a6a 46%, #d48758 100%)",
  /** LTAB: maigs sarkans */
  ltab: "linear-gradient(148deg, #b85555 0%, #a04444 46%, #8a3a3a 100%)",
  /** Tirgus dati: maigs zils (citāds nekā AutoDNA) */
  tirgus: "linear-gradient(148deg, #4a7d9a 0%, #3d6b8a 46%, #335a72 100%)",
  /** Citi avoti: maigs violets */
  citi_avoti: "linear-gradient(148deg, #9b7bd4 0%, #8b6bc8 46%, #7a5ab0 100%)",
  /** Kā CSDD */
  listing_analysis: "linear-gradient(148deg, #4a7d68 0%, #3d6b5a 46%, #2f5a4a 100%)",
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

/** Approved by IRISS: maigs sudraba / metālisks */
export const APPROVED_BY_IRISS_HEADER_BG =
  "linear-gradient(135deg, #fafbfc 0%, #eef2f6 28%, #e2e8f0 52%, #cbd5e1 78%, #e8edf2 100%)";

export const VENDOR_FALLBACK_HEADER_BG =
  "linear-gradient(148deg, #6b7280 0%, #5a6170 50%, #4b5258 100%)";

export const LISTING_ANALYSIS_BODY_BG =
  "linear-gradient(to bottom, #f2faf2 0%, #ffffff 100%)";
