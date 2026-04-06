/**
 * Avotu un prioritāro bloku galveneņu lineārie gradienti (PDF + Admin).
 */

import type { SourceBlockKey } from "@/lib/admin-source-blocks";

const G = {
  /** CSDD: tumši zaļš → zaļš */
  csdd: "linear-gradient(135deg, #064e3b 0%, #166534 52%, #22c55e 100%)",
  /** AutoDNA: tumši zils → oranžs → balts */
  autodna: "linear-gradient(135deg, #0a1628 0%, #1e3a5f 32%, #ea580c 68%, #ffffff 100%)",
  /** CarVertical: spilgti dzeltens → balts → tumši zils */
  carvertical: "linear-gradient(90deg, #facc15 0%, #fefce8 38%, #ffffff 48%, #1e3a8a 100%)",
  /** Auto-Records: oranžs → melns → balts */
  auto_records: "linear-gradient(135deg, #ea580c 0%, #171717 42%, #ffffff 100%)",
  /** LTAB: tumši sarkans → bordo */
  ltab: "linear-gradient(135deg, #7f1d1d 0%, #5c0a0a 50%, #4c0519 100%)",
  /** Tirgus: tumši zils → balts → rozā */
  tirgus: "linear-gradient(135deg, #0c4a6e 0%, #ffffff 45%, #fbcfe8 85%, #f472b6 100%)",
  /** Citi avoti: violets → gaišs (balts teksts uz violetu–lavandu) */
  citi_avoti: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 42%, #a78bfa 85%, #e9d5ff 100%)",
  /** Sludinājuma analīze: kā CSDD */
  listing_analysis: "linear-gradient(135deg, #064e3b 0%, #166534 52%, #22c55e 100%)",
} as const satisfies Record<SourceBlockKey, string>;

export const SOURCE_BLOCK_HEADER_BG: Record<SourceBlockKey, string> = G;

/** Teksta krāsa uz joslas (balts / tumši zils / tumšs uz gaišu galu). */
export const SOURCE_BLOCK_HEADER_TEXT_CLASS: Record<SourceBlockKey, string> = {
  csdd: "text-white",
  ltab: "text-white",
  tirgus: "text-slate-900",
  autodna: "text-slate-900",
  carvertical: "text-blue-900",
  auto_records: "text-slate-900",
  citi_avoti: "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]",
  listing_analysis: "text-white",
};

/** APPROVED BY IRISS: gaiši zils → sudrabs */
export const APPROVED_BY_IRISS_HEADER_BG =
  "linear-gradient(135deg, #bae6fd 0%, #dbeafe 28%, #e2e8f0 55%, #94a3b8 82%, #cbd5e1 100%)";

export const VENDOR_FALLBACK_HEADER_BG = "linear-gradient(135deg, #4b5563 0%, #1f2937 100%)";
