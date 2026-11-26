import type { VinScanStatus } from "@/lib/vin-scan/types";
import { isUsWmiVin } from "@/lib/vin-scan/vin-decode";

/**
 * Policijas meklēto (zagto) transportlīdzekļu avoti: «Meklēšanā» / «Nav meklēšanā» kartīte.
 * 26.11: Lietuvas policija (lt_itpr) izņemta pilnībā (reCAPTCHA + CapSolver); pievienota Čehijas policija.
 */
export const VIN_SCAN_WANTED_SOURCE_IDS: readonly string[] = ["cz_patrani"];

export function isVinScanWantedSource(id: string): boolean {
  return VIN_SCAN_WANTED_SOURCE_IDS.includes(id);
}

/** Avoti, kas attiecas tikai uz Ziemeļamerikas (ASV/CA/MX) VIN. Citiem to «zagts»/«total loss» ir viltus trauksme. */
const NORTH_AMERICA_ONLY_IDS = new Set(["nicb"]);

/**
 * false: šī avota rinda nedrīkst ieslēgt «Meklēšanā» kartīti vai dot stāsta punktus (piem. NICB vācu auto).
 * Bez VIN (vecs izsaucējs) - paliek kā agrāk.
 */
export function vinScanSourceAppliesToVin(id: string, vin: string | undefined): boolean {
  if (!NORTH_AMERICA_ONLY_IDS.has(id)) return true;
  const clean = String(vin ?? "").trim().toUpperCase();
  if (clean.length < 11) return true;
  return isUsWmiVin(clean);
}

export function vinScanWantedStatusLabel(status: VinScanStatus | "idle" | "checking"): string {
  if (status === "found") return "Meklēšanā";
  if (status === "none") return "Nav meklēšanā";
  return "";
}

export function vinScanWantedDotClass(status: VinScanStatus | "idle" | "checking"): string {
  if (status === "found") return "bg-rose-600";
  if (status === "none") return "bg-emerald-500";
  return "";
}

export function vinScanWantedTileClass(id: string, status: VinScanStatus | "idle" | "checking"): string {
  if (!isVinScanWantedSource(id)) return "";
  if (status === "found") return "border-rose-500/70 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  if (status === "none") return "border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20";
  return "";
}
