/**
 * Avotu un prioritāro bloku galveneņu gradienti (PDF + Admin).
 * Shine slāņus Admin pievieno ar atsevišķiem overlay <div>.
 */

import type { SourceBlockKey } from "@/lib/admin-source-blocks";

const G = {
  csdd: "linear-gradient(135deg, #064e3b 0%, #0f5132 42%, #166534 100%)",
  autodna: "linear-gradient(135deg, #0a1628 0%, #1e3a5f 36%, #9a3412 78%, #ea580c 100%)",
  carvertical: "linear-gradient(90deg, #fde047 0%, #eab308 26%, #3f3f46 58%, #0a0a0a 100%)",
  auto_records: "linear-gradient(135deg, #fb923c 0%, #ea580c 38%, #18181b 100%)",
  ltab: "linear-gradient(135deg, #7f1d1d 0%, #5c0a0a 48%, #4c0519 100%)",
  tirgus: "linear-gradient(135deg, #0c4a6e 0%, #1d4ed8 45%, #38bdf8 100%)",
  citi_avoti: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 52%, #ef4444 100%)",
  listing_analysis: "linear-gradient(135deg, #065f46 0%, #14532d 45%, #15803d 100%)",
} as const satisfies Record<SourceBlockKey, string>;

export const SOURCE_BLOCK_HEADER_BG: Record<SourceBlockKey, string> = G;

/** Tailwind klase tekstam uz gradienta (balts vs tumšs „metālisks”). */
export const SOURCE_BLOCK_HEADER_TEXT_CLASS: Record<SourceBlockKey, string> = {
  csdd: "text-white",
  ltab: "text-white",
  tirgus: "text-white",
  autodna: "text-white",
  carvertical: "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
  auto_records: "text-white",
  citi_avoti: "text-white",
  listing_analysis: "text-white",
};

export const APPROVED_BY_IRISS_HEADER_BG =
  "linear-gradient(135deg, #93c5fd 0%, #bfdbfe 22%, #cbd5e1 48%, #94a3b8 72%, #e2e8f0 100%)";

export const VENDOR_FALLBACK_HEADER_BG = "linear-gradient(135deg, #4b5563 0%, #1f2937 100%)";
