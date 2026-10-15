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
  type VinScanInspection,
  type VinScanStatus,
} from "@/lib/vin-scan/types";
import { SWEDISH_BROWSER_SOURCE_IDS } from "@/lib/vin-scan/parse-sweden";
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

export type OrderVinScanSourceState =
  | "found"
  | "none"
  | "error"
  | "blocked"
  | "timeout"
  | "config_missing"
  | "browser_only";

export type OrderVinScanRowAction = "import_auction" | "import_csdd" | "import_listing" | "open" | "open_import" | "retry";

/** Avoti, ko Cloudflare bieži bloķē serverim — tos atver pārlūkā un importē ar PROVIN skriptu / ielīmēšanu. */
export const ORDER_VIN_SCAN_BROWSER_IMPORT_IDS: readonly string[] = [
  "stat_vin",
  "bid_cars",
  "checkcar_vin",
  "bidfax",
  "poctra",
  "plc_auction",
  ...SWEDISH_BROWSER_SOURCE_IDS,
];
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
  blocked: number;
  timeout: number;
  configMissing: number;
  browserOnly: number;
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
  const photoUrls = Array.isArray(o.photoUrls)
    ? o.photoUrls.filter((u): u is string => typeof u === "string" && u.trim().startsWith("http")).map((u) => u.trim())
    : undefined;
  const row: VinScanAuction = {
    title: typeof o.title === "string" ? o.title.trim() : "",
    date: typeof o.date === "string" ? o.date.trim() : undefined,
    price: typeof o.price === "string" ? o.price.trim() : undefined,
    venue: typeof o.venue === "string" ? o.venue.trim() : undefined,
    lot: typeof o.lot === "string" && o.lot.trim() ? o.lot.trim() : undefined,
    photoUrl: typeof o.photoUrl === "string" && o.photoUrl.trim() ? o.photoUrl.trim() : undefined,
    photoCount: Number.isFinite(photoCount) && photoCount > 0 ? photoCount : undefined,
    ...(photoUrls?.length ? { photoUrls } : {}),
  };
  if (!row.title && !row.date && !row.price && !row.venue && !row.lot && !row.photoUrl && !row.photoCount && !row.photoUrls?.length) {
    return null;
  }
  return row;
}

function asInspection(v: unknown): VinScanInspection | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const date = typeof o.date === "string" ? o.date.trim().slice(0, 32) : "";
  const result = typeof o.result === "string" ? o.result.trim().slice(0, 80) : "";
  const odometer = typeof o.odometer === "string" ? o.odometer.trim().slice(0, 40) : "";
  if (!date && !result && !odometer) return null;
  return { date, ...(result ? { result } : {}), ...(odometer ? { odometer } : {}) };
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
  const jojFacts =
    o.jojFacts && typeof o.jojFacts === "object" ? (o.jojFacts as VinScanIndicator["jojFacts"]) : undefined;
  return {
    id: id as VinScanSourceId,
    label,
    country,
    status: o.status,
    summary: typeof o.summary === "string" ? o.summary : "",
    detail: typeof o.detail === "string" ? o.detail : "",
    openUrl: typeof o.openUrl === "string" && o.openUrl.trim() ? o.openUrl.trim() : null,
    auctions,
    ...(jojFacts ? { jojFacts } : {}),
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
                  .slice(0, 500)
              : undefined,
          }
        : undefined,
    flags: o.flags && typeof o.flags === "object" ? (o.flags as VinScanIndicator["flags"]) : undefined,
    vehicle: o.vehicle && typeof o.vehicle === "object" ? (o.vehicle as VinScanIndicator["vehicle"]) : undefined,
    mileage: Array.isArray(o.mileage) ? (o.mileage as VinScanIndicator["mileage"]) : undefined,
    inspections: Array.isArray(o.inspections)
      ? o.inspections.map(asInspection).filter((row): row is VinScanInspection => Boolean(row)).slice(0, 40)
      : undefined,
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

function sourceState(status: string, summary: string): OrderVinScanSourceState {
  if (status === "found") return "found";
  if (status === "blocked") return "blocked";
  if (status === "timeout") return "timeout";
  if (status === "config_missing") return "config_missing";
  if (status === "browser_only") return "browser_only";
  if (status === "none" || status === "needs_input" || status === "manual") return "none";
  if (status === "skipped") {
    if (/nav\s+\S*API_KEY|nav konfigurēts|nav CAPSOLVER/i.test(summary)) return "config_missing";
    return "none";
  }
  if (/neatbildēja laikā|\btimeout\b/i.test(summary)) return "timeout";
  if (/nav VEGVESEN_API_KEY|nav CAPSOLVER_API_KEY|config_missing/i.test(summary)) return "config_missing";
  if (/atver pārlūkā|prasa pārlūku|tikai pārlūkā/i.test(summary) && !/bloķ|cloudflare|\b403\b/i.test(summary)) {
    return "browser_only";
  }
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
  for (const auction of row.auctions ?? []) {
    push(auction.photoUrl);
    for (const extra of auction.photoUrls ?? []) push(extra);
  }
  return urls;
}

function canImportAuction(row: VinScanIndicator): boolean {
  if (row.status !== "found") return false;
  if ((row.auctions ?? []).length > 0) return true;
  return photoCountOf(row) > 0 || Boolean(row.media?.photoUrl);
}

function rowAction(row: VinScanIndicator, state: OrderVinScanSourceState): OrderVinScanRowAction {
  if (isOrderVinScanBrowserBlocked(row.id, state === "blocked" ? "error" : state, row.summary ?? "")) return "open_import";
  if (state === "blocked" || state === "browser_only") return "open_import";
  if (state === "error" || state === "timeout") return "retry";
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
    let state = sourceState(row.status, row.summary ?? "");
    const blocked =
      state === "blocked" || isOrderVinScanBrowserBlocked(row.id, "error", row.summary ?? "");
    if (blocked && state === "error") state = "blocked";
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
      ...(blocked ? { blocked: true } : {}),
    };
  });
  const found = rows.filter((r) => r.state === "found");
  const none = rows.filter((r) => r.state === "none");
  const blocked = rows.filter((r) => r.state === "blocked" || r.blocked);
  const timeout = rows.filter((r) => r.state === "timeout");
  const configMissing = rows.filter((r) => r.state === "config_missing");
  const browserOnly = rows.filter((r) => r.state === "browser_only");
  const error = rows.filter((r) => r.state === "error" && !r.blocked);
  const byRank = (a: OrderVinScanSourceRow, b: OrderVinScanSourceRow) =>
    rowRank(a) - rowRank(b) || a.label.localeCompare(b.label, "lv");
  const visible = [...found, ...error, ...timeout, ...blocked, ...configMissing, ...browserOnly].sort(byRank);
  const noneRows = [...none].sort((a, b) => a.label.localeCompare(b.label, "lv"));
  return {
    at: record.at,
    vin: record.vin,
    status: record.status,
    found: found.length,
    none: none.length,
    error: error.length,
    browser: blocked.length + browserOnly.length,
    blocked: blocked.length,
    timeout: timeout.length,
    configMissing: configMissing.length,
    browserOnly: browserOnly.length,
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

function mergeJojFacts(out: CcVinParsedReport, facts: NonNullable<VinScanIndicator["jojFacts"]>) {
  if (facts.vehicleLine && !out.vehicleLine) out.vehicleLine = facts.vehicleLine;
  if (facts.reportDate && !out.reportDate) out.reportDate = facts.reportDate;
  out.sales.push(...facts.sales);
  out.damages.push(...facts.damages);
  out.titles.push(...facts.titles);
  out.insurance.push(...facts.insurance);
  out.mileage.push(...facts.mileage);
  out.notes.push(...facts.notes);
}

export function vinScanAuctionsToCcVinParsed(indicators: readonly VinScanIndicator[]): CcVinParsedReport {
  const out = emptyCcVinParsedReport();
  for (const src of indicators) {
    if (src.status !== "found") continue;
    if (src.jojFacts && (src.jojFacts.sales.length || src.jojFacts.damages.length || src.jojFacts.notes.length)) {
      mergeJojFacts(out, src.jojFacts);
      continue;
    }
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
    for (const url of [
      src.media?.photoUrl,
      ...(src.media?.photoUrls ?? []),
      ...(src.auctions ?? []).flatMap((a) => [a.photoUrl, ...(a.photoUrls ?? [])]),
    ]) {
      const u = String(url || "").trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      photoUrls.push(u);
    }
  }
  const jojNotes = parsed.notes.filter((n) => n.trim()).join("\n\n");
  const lines = [
    next.rawUnprocessedData.trim(),
    jojNotes,
    photoUrls.length ? `VIN SCAN izsoles foto:\n${photoUrls.slice(0, 200).join("\n")}` : "",
  ].filter(Boolean);
  return {
    block: {
      ...next,
      rawUnprocessedData: lines.join("\n\n").slice(0, 20_000),
      aiContextRaw: [next.aiContextRaw.trim(), jojNotes].filter(Boolean).join("\n\n").slice(0, 20_000),
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
  blocked: number;
  timeout: number;
  configMissing: number;
  browserOnly: number;
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
  const problem =
    sum.error > 0
      ? "Ir kļūdas"
      : sum.timeout > 0
        ? "Noildze"
        : sum.blocked > 0
          ? "Bloķē"
          : sum.configMissing > 0
            ? "Nav atslēgas"
            : sum.browserOnly > 0
              ? "Tikai pārlūkā"
              : "";
  const hint = sum.rows.find((r) => r.valuable && r.state === "found")?.hint || foundLabels[0] || problem;
  return {
    at: record.at,
    vin: record.vin,
    status: record.status,
    found: sum.found,
    none: sum.none,
    error: sum.error,
    blocked: sum.blocked,
    timeout: sum.timeout,
    configMissing: sum.configMissing,
    browserOnly: sum.browserOnly,
    foundLabels,
    hint,
  };
}

export function orderVinScanDashboardSubtitle(card: {
  status: string;
  foundLabels: readonly string[];
  hint: string;
  error: number;
  blocked?: number;
  timeout?: number;
  configMissing?: number;
}): string {
  if (card.status === "running") return "pārbauda bezmaksas avotus";
  if (card.foundLabels.length) return card.foundLabels.join(" · ");
  const problems = card.error + (card.blocked ?? 0) + (card.timeout ?? 0) + (card.configMissing ?? 0);
  if (problems > 0) {
    const hint = card.hint.trim();
    if (hint && hint !== "Nav datu") return hint;
    return "Ir kļūdas";
  }
  return card.hint || "Nav datu";
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
  const blocked = Math.max(0, Math.floor(Number(o.blocked) || 0));
  const timeout = Math.max(0, Math.floor(Number(o.timeout) || 0));
  const configMissing = Math.max(0, Math.floor(Number(o.configMissing) || 0));
  const browserOnly = Math.max(0, Math.floor(Number(o.browserOnly) || 0));
  const foundLabels = Array.isArray(o.foundLabels)
    ? o.foundLabels.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()).slice(0, 8)
    : [];
  const hint = typeof o.hint === "string" ? o.hint.trim().slice(0, 160) : "";
  return { at, vin, status: o.status, found, none, error, blocked, timeout, configMissing, browserOnly, foundLabels, hint };
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
  return hint.found > 0 || hint.error > 0 || hint.blocked > 0 || hint.timeout > 0 || hint.configMissing > 0;
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
  blocked: number;
  timeout: number;
  configMissing: number;
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
      blocked: hint.blocked,
      timeout: hint.timeout,
      configMissing: hint.configMissing,
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
  const bits = [`${summary.found} ar datiem`];
  if (summary.none) bits.push(`${summary.none} nav`);
  if (summary.error) bits.push(`${summary.error} kļūda`);
  if (summary.blocked) bits.push(`${summary.blocked} bloķē`);
  if (summary.timeout) bits.push(`${summary.timeout} noildze`);
  if (summary.configMissing) bits.push(`${summary.configMissing} nav atslēgas`);
  if (summary.browserOnly) bits.push(`${summary.browserOnly} pārlūks`);
  return hint ? `VIN SCAN: ${hint} · ${bits.join(", ")}` : `VIN SCAN: ${bits.join(", ")}`;
}
