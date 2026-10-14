/**
 * Pasūtījumam saglabātais bezmaksas VIN SCAN. Tīra loģika bez I/O.
 */

import { applyCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import { emptyCcVinParsedReport, type CcVinParsedReport } from "@/lib/cc-vin-report-parse";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import {
  VIN_SCAN_STATUSES,
  vinScanNeedsBrowser,
  type VinScanAuction,
  type VinScanIndicator,
  type VinScanStatus,
} from "@/lib/vin-scan/types";
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

export type OrderVinScanRowAction = "import_auction" | "import_csdd" | "import_listing" | "open" | "open_import" | "retry";

/** Avoti, ko Cloudflare bieži bloķē serverim — tos atver pārlūkā un importē ar PROVIN skriptu / ielīmēšanu. */
export const ORDER_VIN_SCAN_BROWSER_IMPORT_IDS: readonly string[] = ["stat_vin", "bid_cars", "checkcar_vin", "bidfax"];
const BLOCKED_HINT_RE = /cloudflare|\b403\b|captcha|challenge|bloķ|blocked|lapa nav atpazīta|just a moment/i;

export function isOrderVinScanBrowserBlocked(id: string, state: OrderVinScanSourceState, hint: string): boolean {
  if (state !== "error") return false;
  if (vinScanNeedsBrowser("unknown", hint)) return true;
  return ORDER_VIN_SCAN_BROWSER_IMPORT_IDS.includes(id) && BLOCKED_HINT_RE.test(hint);
}

export type OrderVinScanSourceRow = {
  id: string;
  label: string;
  state: OrderVinScanSourceState;
  hint: string;
  openUrl: string | null;
  valuable: boolean;
  photoCount: number;
  photoUrls: string[];
  canImportAuction: boolean;
  action: OrderVinScanRowAction;
  /** Cloudflare bloķēts pārlūka avots — neitrāls stāvoklis, nevis „kļūda”. */
  blocked?: boolean;
};

export type OrderVinScanSummary = {
  at: string;
  vin: string;
  status: OrderVinScanRunStatus;
  found: number;
  none: number;
  error: number;
  browser: number;
  errorMessage?: string;
  rows: OrderVinScanSourceRow[];
  noneRows: OrderVinScanSourceRow[];
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
            photoUrls: Array.isArray((o.media as { photoUrls?: unknown }).photoUrls)
              ? (o.media as { photoUrls: unknown[] })
                  .photoUrls.filter((u): u is string => typeof u === "string" && u.trim().startsWith("http"))
                  .map((u) => u.trim())
                  .slice(0, 20)
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

function photoUrlsOf(row: VinScanIndicator): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (raw?: string) => {
    const url = String(raw || "").trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };
  push(row.media?.photoUrl);
  for (const extra of row.media?.photoUrls ?? []) push(extra);
  for (const auction of row.auctions ?? []) push(auction.photoUrl);
  return urls.slice(0, 20);
}

function canImportAuction(row: VinScanIndicator): boolean {
  if (row.status !== "found") return false;
  if ((row.auctions ?? []).length > 0) return true;
  return photoCountOf(row) > 0 || Boolean(row.media?.photoUrl);
}

function rowAction(row: VinScanIndicator, state: OrderVinScanSourceState): OrderVinScanRowAction {
  if (isOrderVinScanBrowserBlocked(row.id, state, row.summary ?? "")) return "open_import";
  if (state === "error") return "retry";
  if ((row.id === "stat_vin" || row.id === "joj_copart_iaai") && canImportAuction(row)) return "import_auction";
  if (row.id === "csdd" && state === "found") return "import_csdd";
  if (row.id === "listing_history" && state === "found") return "import_listing";
  return "open";
}

function rowRank(row: OrderVinScanSourceRow): number {
  if ((row.id === "stat_vin" || row.id === "joj_copart_iaai") && row.state === "found") return 0;
  if (row.id === "csdd" && row.state === "found") return 1;
  if (row.id === "listing_history" && row.state === "found") return 2;
  if (row.state === "found") return 3;
  if (row.state === "error" && row.valuable) return 4;
  if (row.state === "error") return 5;
  return 6;
}

export function buildOrderVinScanSummary(record: OrderVinScanRecord | null | undefined): OrderVinScanSummary | null {
  if (!record) return null;
  const rows: OrderVinScanSourceRow[] = record.indicators.map((row) => {
    const state = sourceState(row.status);
    return {
      id: row.id,
      label: row.label,
      state,
      hint: row.summary.trim(),
      openUrl: row.openUrl,
      valuable: isValuableVinScanSourceId(row.id),
      photoCount: photoCountOf(row),
      photoUrls: photoUrlsOf(row),
      canImportAuction: canImportAuction(row),
      action: rowAction(row, state),
      ...(isOrderVinScanBrowserBlocked(row.id, state, row.summary ?? "") ? { blocked: true } : {}),
    };
  });
  const found = rows.filter((r) => r.state === "found");
  const none = rows.filter((r) => r.state === "none");
  const blocked = rows.filter((r) => r.blocked);
  const error = rows.filter((r) => r.state === "error" && !r.blocked);
  const byRank = (a: OrderVinScanSourceRow, b: OrderVinScanSourceRow) =>
    rowRank(a) - rowRank(b) || a.label.localeCompare(b.label, "lv");
  const visible = [...found, ...error, ...blocked].sort(byRank);
  const noneRows = [...none].sort((a, b) => a.label.localeCompare(b.label, "lv"));
  return {
    at: record.at,
    vin: record.vin,
    status: record.status,
    found: found.length,
    none: none.length,
    error: error.length,
    browser: blocked.length,
    ...(record.error ? { errorMessage: record.error } : {}),
    rows: visible,
    noneRows,
    noneCollapsedLabels: noneRows.map((r) => r.label),
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

export function formatOrderVinScanClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  if (!hour || !minute) return "";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function shouldStartOrderVinScanOnDraftPatch(prevVin: string, incomingVin: string): boolean {
  const prev = prevVin.trim().toUpperCase();
  const next = incomingVin.trim().toUpperCase();
  return Boolean(next) && next !== prev;
}

export function mergeVinScanIndicators(
  prev: readonly VinScanIndicator[],
  incoming: readonly VinScanIndicator[],
): VinScanIndicator[] {
  const map = new Map<string, VinScanIndicator>();
  for (const row of prev) map.set(row.id, row);
  for (const row of incoming) map.set(row.id, row);
  return [...map.values()];
}

export type OrderVinScanDashboardHint = {
  at: string;
  vin: string;
  status: OrderVinScanRunStatus;
  found: number;
  none: number;
  error: number;
  foundLabels: string[];
  hint: string;
};

export const ORDER_VIN_SCAN_DASHBOARD_LIMIT = 8;

export function orderVinScanDashboardHintFromRecord(
  record: OrderVinScanRecord | null | undefined,
): OrderVinScanDashboardHint | null {
  const sum = buildOrderVinScanSummary(record);
  if (!sum || !record) return null;
  const foundLabels = sum.rows.filter((r) => r.state === "found").map((r) => r.label).slice(0, 8);
  const hint = sum.rows.find((r) => r.valuable && r.state === "found")?.hint || foundLabels[0] || "";
  return {
    at: record.at,
    vin: record.vin,
    status: record.status,
    found: sum.found,
    none: sum.none,
    error: sum.error,
    foundLabels,
    hint,
  };
}

export function parseOrderVinScanDashboardHint(raw: unknown): OrderVinScanDashboardHint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const at = typeof o.at === "string" && o.at.trim() ? o.at.trim() : "";
  const vin = typeof o.vin === "string" ? o.vin.trim().toUpperCase() : "";
  if (!at || !vin) return null;
  if (o.status !== "running" && o.status !== "done" && o.status !== "error") return null;
  const found = Math.max(0, Math.floor(Number(o.found) || 0));
  const none = Math.max(0, Math.floor(Number(o.none) || 0));
  const error = Math.max(0, Math.floor(Number(o.error) || 0));
  const foundLabels = Array.isArray(o.foundLabels)
    ? o.foundLabels.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()).slice(0, 8)
    : [];
  const hint = typeof o.hint === "string" ? o.hint.trim().slice(0, 160) : "";
  return { at, vin, status: o.status, found, none, error, foundLabels, hint };
}

export function shouldShowVinScanDashboardCard(args: {
  checkoutLine?: string | null;
  auditComplete?: boolean;
  isB2bPack?: boolean;
  hint: OrderVinScanDashboardHint | null | undefined;
}): boolean {
  if (args.isB2bPack) return false;
  if (args.checkoutLine === "provin_select") return false;
  if (args.auditComplete) return false;
  const hint = args.hint;
  if (!hint) return false;
  if (hint.status === "running") return true;
  return hint.found > 0 || hint.error > 0;
}

export type OrderVinScanDashboardCard = {
  sessionId: string;
  href: string;
  title: string;
  vin: string;
  foundLabels: string[];
  found: number;
  none: number;
  error: number;
  status: OrderVinScanRunStatus;
  hint: string;
};

export function pickOrderVinScanDashboardCards(
  items: readonly {
    sessionId: string;
    title: string;
    vin?: string | null;
    checkoutLine?: string | null;
    auditComplete?: boolean;
    isB2bPack?: boolean;
    hint: OrderVinScanDashboardHint | null | undefined;
  }[],
  limit = ORDER_VIN_SCAN_DASHBOARD_LIMIT,
): OrderVinScanDashboardCard[] {
  const out: OrderVinScanDashboardCard[] = [];
  const sorted = [...items].sort((a, b) => {
    const at = Date.parse(b.hint?.at || "") - Date.parse(a.hint?.at || "");
    return Number.isFinite(at) ? at : 0;
  });
  for (const item of sorted) {
    if (!shouldShowVinScanDashboardCard(item)) continue;
    const hint = item.hint!;
    out.push({
      sessionId: item.sessionId,
      href: `/admin/orders/${encodeURIComponent(item.sessionId)}`,
      title: item.title.trim() || hint.vin || "Pasūtījums",
      vin: (item.vin || hint.vin).trim().toUpperCase(),
      foundLabels: hint.foundLabels,
      found: hint.found,
      none: hint.none,
      error: hint.error,
      status: hint.status,
      hint: hint.hint,
    });
    if (out.length >= limit) break;
  }
  return out;
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
  if (summary.browser) bits.push(`${summary.browser} pārlūks`);
  return hint ? `VIN SCAN: ${hint} · ${bits.join(", ")}` : `VIN SCAN: ${bits.join(", ")}`;
}
