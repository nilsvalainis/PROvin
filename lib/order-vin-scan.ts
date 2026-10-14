/**
 * Pasūtījumam saglabātais bezmaksas VIN SCAN. Tīra loģika bez I/O.
 */

import { applyCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import { emptyCcVinParsedReport, type CcVinParsedReport } from "@/lib/cc-vin-report-parse";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import { VIN_SCAN_STATUSES, type VinScanAuction, type VinScanIndicator, type VinScanStatus } from "@/lib/vin-scan/types";
import { isValuableVinScanSourceId } from "@/lib/vin-scan/free-sources";
import { vinScanCatalogItem, type VinScanSourceId } from "@/lib/vin-scan/catalog";

export const ORDER_VIN_SCAN_STATUSES = ["running", "done", "error"] as const;
export type OrderVinScanRunStatus = (typeof ORDER_VIN_SCAN_STATUSES)[number];

export type OrderVinScanRecord = {
  at: string;
  vin: string;
  status: OrderVinScanRunStatus;
  error?: string;
  indicators: VinScanIndicator[];
};

export type OrderVinScanSourceState = "found" | "none" | "error";

export type OrderVinScanSourceRow = {
  id: string;
  label: string;
  state: OrderVinScanSourceState;
  hint: string;
  openUrl: string | null;
  valuable: boolean;
  photoCount: number;
  canImportAuction: boolean;
};

export type OrderVinScanSummary = {
  at: string;
  vin: string;
  status: OrderVinScanRunStatus;
  found: number;
  none: number;
  error: number;
  errorMessage?: string;
  rows: OrderVinScanSourceRow[];
  noneCollapsedLabels: string[];
};

function isStatus(v: unknown): v is VinScanStatus {
  return typeof v === "string" && (VIN_SCAN_STATUSES as readonly string[]).includes(v);
}

function asAuction(v: unknown): VinScanAuction | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const photoCountRaw = o.photoCount;
  const photoCount = typeof photoCountRaw === "number" ? photoCountRaw : Number(photoCountRaw);
  const row: VinScanAuction = {
    title: typeof o.title === "string" ? o.title.trim() : "",
    date: typeof o.date === "string" ? o.date.trim() : undefined,
    price: typeof o.price === "string" ? o.price.trim() : undefined,
    venue: typeof o.venue === "string" ? o.venue.trim() : undefined,
    photoUrl: typeof o.photoUrl === "string" && o.photoUrl.trim() ? o.photoUrl.trim() : undefined,
    photoCount: Number.isFinite(photoCount) && photoCount > 0 ? photoCount : undefined,
  };
  if (!row.title && !row.date && !row.price && !row.venue && !row.photoUrl && !row.photoCount) return null;
  return row;
}

export function parseVinScanIndicator(raw: unknown): VinScanIndicator | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id || !isStatus(o.status)) return null;
  let label = typeof o.label === "string" ? o.label.trim() : "";
  let country = typeof o.country === "string" ? o.country.trim() : "";
  try {
    const meta = vinScanCatalogItem(id as VinScanSourceId);
    label = label || meta.label;
    country = country || meta.country;
  } catch {
    label = label || id;
  }
  const auctions = Array.isArray(o.auctions) ? o.auctions.map(asAuction).filter((row): row is VinScanAuction => Boolean(row)) : [];
  return {
    id: id as VinScanSourceId,
    label,
    country,
    status: o.status,
    summary: typeof o.summary === "string" ? o.summary : "",
    detail: typeof o.detail === "string" ? o.detail : "",
    openUrl: typeof o.openUrl === "string" && o.openUrl.trim() ? o.openUrl.trim() : null,
    auctions,
    media:
      o.media && typeof o.media === "object"
        ? {
            photoUrl: typeof (o.media as { photoUrl?: unknown }).photoUrl === "string" ? (o.media as { photoUrl: string }).photoUrl : undefined,
            photoCount:
              typeof (o.media as { photoCount?: unknown }).photoCount === "number"
                ? (o.media as { photoCount: number }).photoCount
                : undefined,
          }
        : undefined,
    flags: o.flags && typeof o.flags === "object" ? (o.flags as VinScanIndicator["flags"]) : undefined,
    vehicle: o.vehicle && typeof o.vehicle === "object" ? (o.vehicle as VinScanIndicator["vehicle"]) : undefined,
    mileage: Array.isArray(o.mileage) ? (o.mileage as VinScanIndicator["mileage"]) : undefined,
  };
}

export function parseOrderVinScanRecord(raw: unknown): OrderVinScanRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const at = typeof o.at === "string" && o.at.trim() ? o.at.trim() : "";
  const vin = typeof o.vin === "string" ? o.vin.trim().toUpperCase() : "";
  const status = o.status;
  if (!at || !vin) return null;
  if (status !== "running" && status !== "done" && status !== "error") return null;
  const indicators = Array.isArray(o.indicators)
    ? o.indicators.map(parseVinScanIndicator).filter((row): row is VinScanIndicator => Boolean(row))
    : [];
  const error = typeof o.error === "string" && o.error.trim() ? o.error.trim().slice(0, 300) : undefined;
  return { at, vin, status, ...(error ? { error } : {}), indicators };
}

function sourceState(status: string): OrderVinScanSourceState {
  if (status === "found") return "found";
  if (status === "none" || status === "needs_input" || status === "skipped") return "none";
  return "error";
}

function photoCountOf(row: VinScanIndicator): number {
  const fromMedia = row.media?.photoCount ?? 0;
  const fromFlags = row.flags?.photoCount ?? 0;
  const fromAuctions = (row.auctions ?? []).reduce((n, a) => Math.max(n, a.photoCount ?? 0), 0);
  return Math.max(fromMedia, fromFlags, fromAuctions);
}

function canImportAuction(row: VinScanIndicator): boolean {
  if (row.status !== "found") return false;
  if ((row.auctions ?? []).length > 0) return true;
  return photoCountOf(row) > 0 || Boolean(row.media?.photoUrl);
}

export function buildOrderVinScanSummary(record: OrderVinScanRecord | null | undefined): OrderVinScanSummary | null {
  if (!record) return null;
  const rows: OrderVinScanSourceRow[] = record.indicators.map((row) => ({
    id: row.id,
    label: row.label,
    state: sourceState(row.status),
    hint: row.summary.trim(),
    openUrl: row.openUrl,
    valuable: isValuableVinScanSourceId(row.id),
    photoCount: photoCountOf(row),
    canImportAuction: canImportAuction(row),
  }));
  const found = rows.filter((r) => r.state === "found");
  const none = rows.filter((r) => r.state === "none");
  const error = rows.filter((r) => r.state === "error");
  const visible = [...found, ...error.filter((r) => r.valuable), ...error.filter((r) => !r.valuable)];
  return {
    at: record.at,
    vin: record.vin,
    status: record.status,
    found: found.length,
    none: none.length,
    error: error.length,
    ...(record.error ? { errorMessage: record.error } : {}),
    rows: visible,
    noneCollapsedLabels: none.map((r) => r.label),
  };
}

function dateLv(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return raw.trim().slice(0, 32);
}

export function vinScanAuctionsToCcVinParsed(indicators: readonly VinScanIndicator[]): CcVinParsedReport {
  const out = emptyCcVinParsedReport();
  for (const src of indicators) {
    if (src.status !== "found") continue;
    for (const auction of src.auctions ?? []) {
      const date = dateLv(auction.date || "");
      if (auction.venue || auction.title || date) {
        out.sales.push({
          date,
          venue: auction.venue || src.label,
          odometer: "",
          price: auction.price || "",
          status: auction.title || "Izsole",
        });
      }
      const damage = /bojāj|damage|front|rear|side|hail|water|burn/i.exec(auction.title || "");
      if (damage) {
        out.damages.push({
          date,
          region: auction.venue || "",
          amount: "",
          description: auction.title || src.summary,
        });
      }
    }
    for (const mile of src.mileage ?? []) {
      if (!mile.date && !mile.odometer) continue;
      out.mileage.push({ date: dateLv(mile.date), odometer: mile.odometer, country: src.country || "" });
    }
  }
  return out;
}

export function applyVinScanAuctionsToCcVin(
  block: CcVinBlockState,
  indicators: readonly VinScanIndicator[],
): { block: CcVinBlockState; sales: number; damages: number; photoUrls: string[] } {
  const parsed = vinScanAuctionsToCcVinParsed(indicators);
  const next = applyCcVinParsedReport(parsed, block);
  const photoUrls: string[] = [];
  const seen = new Set<string>();
  for (const src of indicators) {
    for (const url of [src.media?.photoUrl, ...(src.auctions ?? []).map((a) => a.photoUrl)]) {
      const u = String(url || "").trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      photoUrls.push(u);
    }
  }
  const lines = [
    next.rawUnprocessedData.trim(),
    photoUrls.length ? `VIN SCAN izsoles foto:\n${photoUrls.slice(0, 40).join("\n")}` : "",
  ].filter(Boolean);
  return {
    block: {
      ...next,
      rawUnprocessedData: lines.join("\n\n").slice(0, 20_000),
    },
    sales: parsed.sales.length,
    damages: parsed.damages.length,
    photoUrls,
  };
}

export function orderVinScanCompactHint(summary: OrderVinScanSummary | null | undefined): string {
  if (!summary) return "";
  if (summary.status === "running") return "VIN SCAN: pārbauda…";
  if (summary.status === "error") {
    return summary.errorMessage ? `VIN SCAN: kļūda (${summary.errorMessage})` : "VIN SCAN: kļūda";
  }
  const valuable = summary.rows.find((r) => r.valuable && r.state === "found");
  const hint = valuable?.hint || "";
  const bits = [`${summary.found} ar datiem`, `${summary.none} nav`, `${summary.error} kļūda`];
  return hint ? `VIN SCAN: ${hint} · ${bits.join(", ")}` : `VIN SCAN: ${bits.join(", ")}`;
}
