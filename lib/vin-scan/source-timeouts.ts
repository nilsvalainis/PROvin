import type { VinScanSourceId } from "@/lib/vin-scan/catalog";

const SLOW_SOURCES = new Set<VinScanSourceId>([
  "mnt_ee",
  "lkf_ee",
  "carinfo",
  "nicb",
  "auchistory",
  "regitra",
  "traficom",
  "biluppgifter",
  "listing_history",
]);
const SLOW_TIMEOUT_MS = 45_000;
const DEFAULT_TIMEOUT_MS = 14_000;
const CAPTCHA_TIMEOUT_MS = 90_000;
/** Tiešais HTTP + Hetzner Chrome `/listings/page` (goto ~45 s + CF gaidīšana). */
export const VIN_SCAN_RELAY_PAGE_TIMEOUT_MS = 80_000;

const RELAY_PAGE_SOURCES = new Set<VinScanSourceId>([
  "stat_vin",
  "bid_cars",
  "checkcar_vin",
  "plc_auction",
  "bidfax",
  "poctra",
]);

const CAPTCHA_SOURCES = new Set<VinScanSourceId>([
  "lkf_ee",
  "carinfo",
  "nicb",
  "auchistory",
  "mnt_ee",
  "nummerplade",
  "lt_itpr",
  "carpass",
]);

export function vinScanSourceTimeoutMs(id: VinScanSourceId): number {
  if (RELAY_PAGE_SOURCES.has(id)) return VIN_SCAN_RELAY_PAGE_TIMEOUT_MS;
  if (CAPTCHA_SOURCES.has(id)) return CAPTCHA_TIMEOUT_MS;
  if (SLOW_SOURCES.has(id)) return SLOW_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

/** CapSolver jābeidzas pirms avota ārējā timeout, lai pēc noildzes nepaliktu maksas poll. */
export const CAPSOLVER_TIMEOUT_MARGIN_MS = 8_000;
export const CAPSOLVER_MIN_TIMEOUT_MS = 4_000;

export function capsolverTimeoutMs(outerTimeoutMs: number, elapsedMs = 0): number {
  if (!Number.isFinite(outerTimeoutMs) || outerTimeoutMs <= 0) return 0;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Math.max(0, Math.floor(outerTimeoutMs - elapsed - CAPSOLVER_TIMEOUT_MARGIN_MS));
}

export function capsolverMayStart(outerTimeoutMs: number, elapsedMs = 0): boolean {
  return capsolverTimeoutMs(outerTimeoutMs, elapsedMs) >= CAPSOLVER_MIN_TIMEOUT_MS;
}
