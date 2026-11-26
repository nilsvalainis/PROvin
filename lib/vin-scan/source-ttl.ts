/**
 * VIN SCAN keša derīgums pa avotu tipiem.
 * Reģistri mainās lēni, izsoļu arhīvi gandrīz nekad, sludinājumi bieži.
 * Rindas vecums: `row.scannedAt`, ja nav - momentuzņēmuma `scannedAt`.
 */

import { vinScanSourceNeedsRescan, vinScanStatusIsCacheable } from "@/lib/vin-scan/health";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const VIN_SCAN_DEFAULT_ROW_TTL_MS = 12 * HOUR_MS;
export const VIN_SCAN_NONE_ROW_TTL_MS = 3 * DAY_MS;

const REGISTRY_IDS: ReadonlySet<string> = new Set([
  "csdd",
  "mnt_ee",
  "lkf_ee",
  "tjekbil",
  "esyn",
  "dsb",
  "carinfo",
  "rdw",
  "nummerplade",
  "carpass",
  "biluppgifter",
  "vegvesen",
  // Austrijas §57a saraksts (relejs to pats kešo 7 d uz VIN + datums).
  "kfz_at",
]);

const AUCTION_ARCHIVE_IDS: ReadonlySet<string> = new Set([
  "stat_vin",
  "bid_cars",
  "bidfax",
  "poctra",
  "checkcar_vin",
  "plc_auction",
  "carfax_eu",
]);

const RECALL_IDS: ReadonlySet<string> = new Set([
  "nhtsa_recalls",
  "nhtsa_complaints",
  "recall_vw",
  "recall_bmw",
  "recall_mercedes",
  "recall_volvo",
  "recall_toyota",
  "eu_safety_gate",
]);

/** Cik ilgi rindu drīkst ņemt no keša. 0 = vienmēr skenēt vēlreiz. */
export function vinScanRowTtlMs(id: string, status: string): number {
  if (!vinScanStatusIsCacheable(status)) return 0;
  if (id === "vin_decode") return 30 * DAY_MS;
  if (id === "listing_history") return 12 * HOUR_MS;
  // Viens AutoDNA pieprasījums uz VIN diennaktī (23.11).
  if (id === "autodna_precheck") return DAY_MS;
  if (REGISTRY_IDS.has(id)) return status === "found" ? 7 * DAY_MS : VIN_SCAN_NONE_ROW_TTL_MS;
  if (AUCTION_ARCHIVE_IDS.has(id)) return status === "found" ? 30 * DAY_MS : VIN_SCAN_NONE_ROW_TTL_MS;
  if (RECALL_IDS.has(id)) return 7 * DAY_MS;
  return VIN_SCAN_DEFAULT_ROW_TTL_MS;
}

type TtlRow = { id: string; status: string; summary?: string; scannedAt?: string };

/** Rindas skenēšanas laiks ms; NaN, ja nav nolasāms. */
export function vinScanRowScannedAtMs(row: TtlRow, snapshotScannedAt: string): number {
  const own = typeof row.scannedAt === "string" ? Date.parse(row.scannedAt) : Number.NaN;
  if (Number.isFinite(own)) return own;
  return Date.parse(snapshotScannedAt);
}

/** Rinda ir found/none un vēl derīga pēc sava avota TTL. */
export function vinScanRowWithinTtl(row: TtlRow, snapshotScannedAt: string, nowMs = Date.now()): boolean {
  const ttl = vinScanRowTtlMs(row.id, row.status);
  if (ttl <= 0) return false;
  const at = vinScanRowScannedAtMs(row, snapshotScannedAt);
  if (!Number.isFinite(at)) return false;
  return nowMs - at < ttl;
}

/**
 * Momentuzņēmums ir svaigs, ja WMI dekodējums ir found un derīgs, un katra cita rinda
 * ir vai nu derīga pēc sava TTL, vai statuss, kam atkārtota skenēšana nepalīdz (needs_input, browser_only u.c.).
 */
export function vinScanIndicatorsFresh(
  indicators: readonly TtlRow[],
  snapshotScannedAt: string,
  nowMs = Date.now(),
): boolean {
  if (!indicators.length) return false;
  const decode = indicators.find((row) => row.id === "vin_decode");
  if (!decode || decode.status !== "found" || !vinScanRowWithinTtl(decode, snapshotScannedAt, nowMs)) return false;
  return indicators
    .filter((row) => row.id !== "vin_decode")
    .every((row) => {
      if (vinScanStatusIsCacheable(row.status)) return vinScanRowWithinTtl(row, snapshotScannedAt, nowMs);
      return !vinScanSourceNeedsRescan(row.status, row.summary ?? "");
    });
}

/** Ieliek katrai rindai savu `scannedAt` (esošo patur), lai vecums nepazūd, kad momentuzņēmums tiek pārrakstīts. */
export function stampVinScanRows<T extends TtlRow>(rows: readonly T[], fallbackIso: string, overwrite = false): T[] {
  // Nederīgs laiks -> 1970, lai rinda skaitītos novecojusi, nevis pārņemtu jaunā momentuzņēmuma laiku.
  const at = Number.isFinite(Date.parse(fallbackIso)) ? fallbackIso : new Date(0).toISOString();
  return rows.map((row) => {
    if (!overwrite && typeof row.scannedAt === "string" && Number.isFinite(Date.parse(row.scannedAt))) return row;
    return { ...row, scannedAt: at };
  });
}

/** Pārlūka importam: tikai importētā rinda saņem jaunu laiku. */
export function stampVinScanRowById<T extends TtlRow>(rows: readonly T[], id: string, iso: string): T[] {
  return rows.map((row) => (row.id === id ? { ...row, scannedAt: iso } : row));
}

/**
 * Daļējai pārskenēšanai: rindas, ko drīkst ņemt no iepriekšējā momentuzņēmuma.
 * `force` - neņem neko. Atgrieztās rindas jau satur savu `scannedAt`.
 */
export function pickReusableVinScanRows<T extends TtlRow>(
  prevIndicators: readonly T[],
  snapshotScannedAt: string,
  nowMs: number,
  force: boolean,
): T[] {
  if (force) return [];
  return stampVinScanRows(
    prevIndicators.filter((row) => vinScanRowWithinTtl(row, snapshotScannedAt, nowMs)),
    snapshotScannedAt,
  );
}
