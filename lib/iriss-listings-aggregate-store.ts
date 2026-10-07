import "server-only";

import { get, put } from "@vercel/blob";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  IRISS_LISTING_PLATFORMS,
  type IrissListingPlatform,
  type IrissListingPriceChange,
  type IrissListingSourceRun,
  type IrissListingSyncRunSummary,
  type IrissListingVehicle,
  type IrissListingsLatestView,
  type IrissListingsRawBundle,
  type IrissListingsSnapshot,
  type IrissListingsStorageState,
} from "@/lib/iriss-listings-types";

const DEFAULT_RELATIVE_DIR = ".data/iriss-sludinajumi";
const DEFAULT_BLOB_PREFIX = "iriss-sludinajumi/";
const LATEST_FILENAME = "latest.json";
const SNAPSHOTS_DIRNAME = "snapshots";
const RAW_DIRNAME = "raw";

type ResolvedStorage =
  | { kind: "disabled"; reason: "explicit_off" | "vercel_without_blob_token" }
  | { kind: "fs"; dir: string }
  | { kind: "blob"; token: string; prefix: string };

let resolvedMemo: ResolvedStorage | null = null;

function isNonVercelServerlessRuntime(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

function computeResolvedStorage(): ResolvedStorage {
  const raw = process.env.ADMIN_IRISS_LISTINGS_DIR?.trim() ?? "";
  const off = new Set(["0", "false", "no", "off", "disabled"]);
  if (off.has(raw.toLowerCase())) {
    return { kind: "disabled", reason: "explicit_off" };
  }
  if (raw) {
    return { kind: "fs", dir: path.resolve(raw) };
  }

  if (process.env.VERCEL) {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
    if (!token) return { kind: "disabled", reason: "vercel_without_blob_token" };
    return {
      kind: "blob",
      token,
      prefix: process.env.ADMIN_IRISS_LISTINGS_BLOB_PREFIX?.trim() || DEFAULT_BLOB_PREFIX,
    };
  }

  if (isNonVercelServerlessRuntime()) {
    return { kind: "fs", dir: path.join(os.tmpdir(), "provin-iriss-sludinajumi") };
  }
  return { kind: "fs", dir: path.join(process.cwd(), DEFAULT_RELATIVE_DIR) };
}

function resolveStorage(): ResolvedStorage {
  if (!resolvedMemo) resolvedMemo = computeResolvedStorage();
  return resolvedMemo;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function int(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

function isPlatform(v: string): v is IrissListingPlatform {
  return (IRISS_LISTING_PLATFORMS as readonly string[]).includes(v);
}

const SOURCE_STATUSES = new Set(["ok", "login_required", "blocked_by_waf", "parse_failed", "fetch_failed", "relay_not_configured", "skipped"]);
const CHANGES = new Set(["new", "price_changed", "unchanged", "gone"]);
const PRICE_FIELDS = new Set(["start", "minimal", "current", "buy_now"]);

function normalizePriceChange(v: unknown): IrissListingPriceChange | null {
  if (!isObj(v)) return null;
  const at = str(v.at);
  const field = str(v.field);
  if (!at || !PRICE_FIELDS.has(field)) return null;
  return { at, field: field as IrissListingPriceChange["field"], from: numOrNull(v.from), to: numOrNull(v.to) };
}

function normalizeVehicle(v: unknown): IrissListingVehicle | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const platform = str(v.platform);
  const externalId = str(v.externalId);
  const change = str(v.change);
  if (!id || !externalId || !isPlatform(platform) || !CHANGES.has(change)) return null;
  const orderIds = strArr(v.orderIds);
  if (orderIds.length === 0) return null;
  return {
    id,
    platform,
    externalId,
    detailUrl: str(v.detailUrl),
    orderIds,
    orderBrandModels: strArr(v.orderBrandModels),
    title: str(v.title),
    manufacturer: str(v.manufacturer),
    year: str(v.year),
    firstRegistration: str(v.firstRegistration),
    mileageKm: numOrNull(v.mileageKm),
    fuel: str(v.fuel),
    transmission: str(v.transmission),
    powerKw: str(v.powerKw),
    location: str(v.location),
    countryCode: str(v.countryCode),
    imageUrl: str(v.imageUrl),
    currency: str(v.currency) || "EUR",
    priceStart: numOrNull(v.priceStart),
    priceMinimal: numOrNull(v.priceMinimal),
    priceCurrent: numOrNull(v.priceCurrent),
    priceBuyNow: numOrNull(v.priceBuyNow),
    vatNote: str(v.vatNote),
    auctionId: str(v.auctionId),
    auctionStartAt: str(v.auctionStartAt),
    auctionEndAt: str(v.auctionEndAt),
    auctionStage: str(v.auctionStage),
    firstSeenAt: str(v.firstSeenAt),
    lastSeenAt: str(v.lastSeenAt),
    missingRuns: int(v.missingRuns),
    change: change as IrissListingVehicle["change"],
    priceHistory: Array.isArray(v.priceHistory)
      ? v.priceHistory.map(normalizePriceChange).filter((x): x is IrissListingPriceChange => x !== null)
      : [],
  };
}

function normalizeSource(v: unknown): IrissListingSourceRun | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const orderId = str(v.orderId);
  const platform = str(v.platform);
  const sourceUrl = str(v.sourceUrl);
  const status = str(v.status);
  if (!id || !orderId || !sourceUrl || !isPlatform(platform) || !SOURCE_STATUSES.has(status)) return null;
  return {
    id,
    orderId,
    orderBrandModel: str(v.orderBrandModel),
    platform,
    sourceUrl,
    status: status as IrissListingSourceRun["status"],
    note: str(v.note),
    vehicleCount: int(v.vehicleCount),
    pagesFetched: int(v.pagesFetched),
    pageCount: int(v.pageCount),
    fetchedAt: str(v.fetchedAt),
  };
}

function normalizeSummary(v: unknown): IrissListingSyncRunSummary | null {
  if (!isObj(v)) return null;
  const startedAt = str(v.startedAt);
  const finishedAt = str(v.finishedAt);
  const runId = str(v.runId);
  if (!startedAt || !finishedAt || !runId) return null;
  return {
    startedAt,
    finishedAt,
    runId,
    totalSources: int(v.totalSources),
    okCount: int(v.okCount),
    loginRequiredCount: int(v.loginRequiredCount),
    blockedByWafCount: int(v.blockedByWafCount),
    parseFailedCount: int(v.parseFailedCount),
    fetchFailedCount: int(v.fetchFailedCount),
    relayNotConfiguredCount: int(v.relayNotConfiguredCount),
    skippedCount: int(v.skippedCount),
    vehicleCount: int(v.vehicleCount),
    newCount: int(v.newCount),
    priceChangedCount: int(v.priceChangedCount),
    goneCount: int(v.goneCount),
  };
}

/** Vecā (v1) `latest.json` ar meklēšanas lapu ierakstiem tiek ignorēta: sākam no tīra v2 stāvokļa. */
function normalizeLatest(raw: unknown): IrissListingsLatestView | null {
  if (!isObj(raw)) return null;
  if (raw.version !== 2) return null;
  const generatedAt = str(raw.generatedAt);
  const summary = normalizeSummary(raw.summary);
  if (!generatedAt || !summary) return null;
  const vehicles = Array.isArray(raw.vehicles)
    ? raw.vehicles.map(normalizeVehicle).filter((x): x is IrissListingVehicle => x !== null)
    : [];
  const sources = Array.isArray(raw.sources)
    ? raw.sources.map(normalizeSource).filter((x): x is IrissListingSourceRun => x !== null)
    : [];
  return { version: 2, generatedAt, summary, sources, vehicles };
}

async function readBlobJson(pathname: string, token: string): Promise<unknown | null> {
  const got = await get(pathname, { access: "private", token, useCache: false });
  if (!got?.stream || got.statusCode !== 200) return null;
  try {
    return JSON.parse(await new Response(got.stream).text()) as unknown;
  } catch {
    return null;
  }
}

async function writeJson(r: Exclude<ResolvedStorage, { kind: "disabled" }>, relPath: string, body: string): Promise<void> {
  if (r.kind === "blob") {
    await put(`${r.prefix}${relPath}`, body, {
      access: "private",
      token: r.token,
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  const fp = path.join(r.dir, relPath);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, body, "utf8");
}

export function getIrissListingsStorageState(): IrissListingsStorageState {
  const r = resolveStorage();
  if (r.kind === "disabled") {
    return {
      enabled: false,
      reason: r.reason === "vercel_without_blob_token" ? "vercel_blob_token_missing" : "explicit_off",
    };
  }
  if (r.kind === "blob") return { enabled: true, persistence: "vercel_blob" };
  return { enabled: true, persistence: "filesystem", path: r.dir };
}

export async function readIrissListingsLatestView(): Promise<IrissListingsLatestView | null> {
  const r = resolveStorage();
  if (r.kind === "disabled") return null;
  if (r.kind === "blob") {
    return normalizeLatest(await readBlobJson(`${r.prefix}${LATEST_FILENAME}`, r.token));
  }
  try {
    const txt = await fs.readFile(path.join(r.dir, LATEST_FILENAME), "utf8");
    return normalizeLatest(JSON.parse(txt) as unknown);
  } catch {
    return null;
  }
}

export async function writeIrissListingsRun(view: IrissListingsLatestView): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = resolveStorage();
    if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
    const snapshot: IrissListingsSnapshot = view;
    await writeJson(r, LATEST_FILENAME, JSON.stringify(view, null, 2));
    await writeJson(r, `${SNAPSHOTS_DIRNAME}/${view.summary.runId}.json`, JSON.stringify(snapshot));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** `IRISS_LISTINGS_STORE_RAW=0` izslēdz. Noklusējumā glabā, lai struktūras maiņu var ātri izpētīt. */
export function isIrissListingsRawStoreEnabled(): boolean {
  return !/^(0|false|no|off)$/i.test((process.env.IRISS_LISTINGS_STORE_RAW ?? "").trim());
}

export async function writeIrissListingsRawBundle(bundle: IrissListingsRawBundle): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = resolveStorage();
    if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
    if (bundle.sources.length === 0) return { ok: true };
    await writeJson(r, `${RAW_DIRNAME}/${bundle.runId}.json`, JSON.stringify(bundle));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
