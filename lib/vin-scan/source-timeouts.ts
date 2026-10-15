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
/** Hetzner Chrome `/listings/page`: palaišana + Cloudflare izaicinājuma gaidīšana un atkārtojums. */
export const VIN_SCAN_RELAY_PAGE_TIMEOUT_MS = 100_000;

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
