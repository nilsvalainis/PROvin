/**
 * Vienotas līniju (line-art) sadaļu ikonas — PDF un Admin.
 * Etalons: NOBRAUKUMA VĒSTURE (18px, stroke 1.75, #0061D2 caur currentColor).
 * Brīdinājumu trijstūņi paliek provin-alert / pdf-warn atsevišķi.
 */

import type { SourceBlockKey } from "@/lib/admin-source-blocks";
import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";

/** PROVIN zils — ikonām (PDF burbulī / Admin teksts). */
export const PROVIN_SECTION_ICON_HEX = "#0061D2";

/** Saskaņots ar `.pdf-sec-ico-bubble .pdf-ico` (NOBRAUKUMA VĒSTURE). */
export const SECTION_ICON_PX = 18;

export type SectionIconId =
  | "clock"
  | "shield"
  | "fileText"
  | "search"
  | "history"
  | "trendingUp"
  | "listChecks"
  | "clipboard"
  | "scale"
  | "star"
  | "car"
  | "user"
  | "wallet"
  | "messageSquare"
  | "wrench"
  | "database"
  | "barChart"
  | "layers"
  | "camera";

/**
 * SVG iekšējais saturs (bez <svg>), stroke caur currentColor.
 * viewBox 0 0 24 24.
 */
export const SECTION_ICON_INNER: Record<SectionIconId, string> = {
  clock: `<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75"/><path d="M12 7v6l4 2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>`,
  fileText: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
  search: `<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.75"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
  history: `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 3v5h5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  trendingUp: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 6h6v6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  listChecks: `<path d="m9 11 3 3L22 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  clipboard: `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  scale: `<rect x="2" y="7" width="20" height="10" rx="2" stroke="currentColor" stroke-width="1.75"/><line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>`,
  star: `<polygon fill="none" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>`,
  car: `<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M5 11h14v6a1 1 0 0 1-1 1h-1M5 11H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1m14 0h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="17.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="17.5" r="1.5" fill="currentColor"/>`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/>`,
  wallet: `<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2V5z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="12" r="1" fill="currentColor"/>`,
  messageSquare: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  wrench: `<path d="M14.7 6.3a4.2 4.2 0 0 1 0 6l-6 6a4.2 4.2 0 0 1-6-6l6-6a4.2 4.2 0 0 1 6 0z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10l4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
  database: `<ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" stroke-width="1.75"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="currentColor" stroke-width="1.75"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor" stroke-width="1.75"/><ellipse cx="12" cy="19" rx="9" ry="3" stroke="currentColor" stroke-width="1.75"/>`,
  barChart: `<path d="M12 20V10M18 20V4M6 20v-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
  layers: `<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>`,
  camera: `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.75"/>`,
};

export function sectionIconPdfHtml(id: SectionIconId): string {
  const inner = SECTION_ICON_INNER[id];
  return `<svg class="pdf-ico" width="${SECTION_ICON_PX}" height="${SECTION_ICON_PX}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

/** Admin avotu bloku galvenēm. */
export const SOURCE_BLOCK_ICON: Record<SourceBlockKey, SectionIconId> = {
  csdd: "fileText",
  autodna: "database",
  carvertical: "barChart",
  auto_records: "wrench",
  ltab: "shield",
  tirgus: "trendingUp",
  citi_avoti: "layers",
  listing_analysis: "search",
};

/** Apakšvirsraksti (NOBRAUKUMA / NEGADĪJUMI tabulas admin blokos). */
export const SUBHEADING_ICON = {
  mileage: "clock" as const,
  incidents: "shield" as const,
  listingHistory: "history" as const,
};

/** PDF manuālā bloka virsraksts → ikona (AutoDNA, CarVertical, …). */
export function vendorPdfTitleToIconId(title: string): SectionIconId {
  if (title === SOURCE_BLOCK_LABELS.autodna) return "database";
  if (title === SOURCE_BLOCK_LABELS.carvertical) return "barChart";
  if (title === SOURCE_BLOCK_LABELS.auto_records) return "wrench";
  return "layers";
}
