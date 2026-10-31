import "server-only";

import { get, put } from "@vercel/blob";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { marketplaceMonthKey, emptyMarketplaceUsageMonth, MARKETPLACE_RUNS_KEEP } from "@/lib/marketplace/cost-caps";
import { marketplaceListingExpiresAt, marketplaceListingIsExpired, marketplaceListingVehicleId } from "@/lib/marketplace/to-listing-vehicle";
import {
  emptyMarketplaceAutoCronState,
  emptyMarketplaceListingsState,
  isMarketplaceOwnerKind,
  isMarketplacePlatform,
  isMarketplaceProviderId,
  isMarketplaceVehicleCategory,
  MARKETPLACE_TTL_DAYS,
  type MarketplaceAutoCronState,
  type MarketplaceAutoCronStatus,
  type MarketplaceListingsState,
  type MarketplaceQuery,
  type MarketplaceRunRecord,
  type MarketplaceSourceLink,
  type MarketplaceStoredListing,
  type MarketplaceUsageEntry,
  type MarketplaceUsageMonth,
} from "@/lib/marketplace/types";

const DEFAULT_RELATIVE_DIR = ".data/iriss-marketplace";
const LISTINGS_FILENAME = "listings.json";
const AUTO_CRON_FILENAME = "auto-cron.json";

type ResolvedStorage =
  | { kind: "disabled" }
  | { kind: "fs"; dir: string }
  | { kind: "blob"; token: string; prefix: string };

function resolveStorage(): ResolvedStorage {
  const raw = process.env.ADMIN_IRISS_MARKETPLACE_DIR?.trim() ?? "";
  const off = new Set(["0", "false", "no", "off", "disabled"]);
  if (off.has(raw.toLowerCase())) return { kind: "disabled" };
  if (raw) return { kind: "fs", dir: path.resolve(raw) };
  if (process.env.VERCEL) {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
    if (!token) return { kind: "disabled" };
    return { kind: "blob", token, prefix: process.env.ADMIN_IRISS_MARKETPLACE_BLOB_PREFIX?.trim() || "iriss-marketplace/" };
  }
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
    return { kind: "fs", dir: path.join(os.tmpdir(), "provin-iriss-marketplace") };
  }
  return { kind: "fs", dir: path.join(process.cwd(), DEFAULT_RELATIVE_DIR) };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = 240): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseStoredListing(v: unknown): MarketplaceStoredListing | null {
  if (!isObj(v)) return null;
  const platform = str(v.platform, 20);
  const providerId = str(v.providerId, 40);
  const externalId = str(v.externalId, 80);
  const listingUrl = str(v.listingUrl, 500);
  const orderId = str(v.orderId, 80);
  if (!isMarketplacePlatform(platform) || !isMarketplaceProviderId(providerId) || !externalId || !listingUrl || !orderId) {
    return null;
  }
  const fetchedAt = str(v.fetchedAt, 40) || new Date().toISOString();
  const compare = isObj(v.priceCompare) ? v.priceCompare : {};
  return {
    platform,
    providerId,
    externalId,
    listingUrl,
    title: str(v.title, 180),
    make: str(v.make, 40),
    model: str(v.model, 60),
    year: str(v.year, 8),
    mileageKm: numOrNull(v.mileageKm),
    priceEur: numOrNull(v.priceEur),
    fuel: str(v.fuel, 40),
    gearbox: str(v.gearbox, 40),
    powerKw: str(v.powerKw, 12),
    locationCountry: str(v.locationCountry, 8).toUpperCase(),
    fetchedAt,
    ...(str(v.vin, 17).length === 17 ? { vin: str(v.vin, 17).toUpperCase() } : {}),
    ...(str(v.sellerName, 80) ? { sellerName: str(v.sellerName, 80) } : {}),
    ...(str(v.location, 80) ? { location: str(v.location, 80) } : {}),
    ...(Array.isArray(v.imageUrls)
      ? { imageUrls: v.imageUrls.map((u) => str(u, 600)).filter((u) => /^https?:\/\//.test(u)).slice(0, 12) }
      : {}),
    ...(Array.isArray(v.sourceLinks)
      ? {
          sourceLinks: v.sourceLinks
            .map((row) => {
              if (!isObj(row)) return null;
              const platform = str(row.platform, 20);
              const url = str(row.url, 500);
              if (!isMarketplacePlatform(platform) || !url) return null;
              return { platform, url };
            })
            .filter((row): row is MarketplaceSourceLink => Boolean(row)),
        }
      : {}),
    id: str(v.id, 40) || marketplaceListingVehicleId(platform, externalId),
    orderId,
    tenantScope: "iriss",
    groupId: str(v.groupId, 80) || `one-${externalId}`,
    priceCompare: {
      sampleSize: typeof compare.sampleSize === "number" ? compare.sampleSize : 0,
      medianEur: numOrNull(compare.medianEur),
      p25Eur: numOrNull(compare.p25Eur),
      p75Eur: numOrNull(compare.p75Eur),
      deltaPct: numOrNull(compare.deltaPct),
      note: str(compare.note, 180),
    },
    expiresAt: str(v.expiresAt, 40) || marketplaceListingExpiresAt(fetchedAt, MARKETPLACE_TTL_DAYS),
  };
}

function parseQuery(raw: unknown): MarketplaceQuery {
  const q = isObj(raw) ? raw : {};
  const category = str(q.vehicleCategory, 8);
  const features = Array.isArray(q.features)
    ? q.features.map((f) => str(f, 40)).filter(Boolean).slice(0, 12)
    : [];
  return {
    make: str(q.make, 40),
    model: str(q.model, 60),
    yearFrom: numOrNull(q.yearFrom),
    yearTo: numOrNull(q.yearTo),
    mileageFrom: numOrNull(q.mileageFrom),
    mileageTo: numOrNull(q.mileageTo),
    priceFrom: numOrNull(q.priceFrom),
    priceTo: numOrNull(q.priceTo),
    fuel: str(q.fuel, 120),
    gearbox: str(q.gearbox, 40),
    powerFromKw: numOrNull(q.powerFromKw),
    powerToKw: numOrNull(q.powerToKw),
    displacementFromCc: numOrNull(q.displacementFromCc),
    displacementToCc: numOrNull(q.displacementToCc),
    body: str(q.body, 120),
    drive: str(q.drive, 40),
    countries: Array.isArray(q.countries)
      ? q.countries.map((c) => str(c, 8)).filter(Boolean).slice(0, 8)
      : [],
    vehicleCategory: isMarketplaceVehicleCategory(category) ? category : "car",
    features,
  };
}

function parseRun(v: unknown): MarketplaceRunRecord | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 80);
  const orderId = str(v.orderId, 80);
  if (!id || !orderId) return null;
  const ownerKind = str(v.ownerKind, 12);
  return {
    id,
    orderId,
    tenantScope: "iriss",
    ...(isMarketplaceOwnerKind(ownerKind) ? { ownerKind } : {}),
    providers: Array.isArray(v.providers)
      ? v.providers.map((p) => str(p, 40)).filter(isMarketplaceProviderId)
      : [],
    query: parseQuery(v.query),
    maxItems: typeof v.maxItems === "number" ? v.maxItems : 0,
    maxUsd: typeof v.maxUsd === "number" ? v.maxUsd : 0,
    estimatedUsd: typeof v.estimatedUsd === "number" ? v.estimatedUsd : 0,
    chargedUsd: typeof v.chargedUsd === "number" ? v.chargedUsd : 0,
    monthUsd: typeof v.monthUsd === "number" ? v.monthUsd : 0,
    itemCount: typeof v.itemCount === "number" ? v.itemCount : 0,
    keptCount: typeof v.keptCount === "number" ? v.keptCount : 0,
    rejectedCount: typeof v.rejectedCount === "number" ? v.rejectedCount : 0,
    startedAt: str(v.startedAt, 40),
    finishedAt: str(v.finishedAt, 40),
    status: v.status === "partial" || v.status === "blocked" || v.status === "failed" ? v.status : "ok",
    trigger: v.trigger === "auto" ? "auto" : "manual",
    note: str(v.note, 500),
    apifyRunIds: Array.isArray(v.apifyRunIds)
      ? v.apifyRunIds.map((id) => str(id, 80)).filter(Boolean).slice(0, 12)
      : [],
  };
}

function parseUsageEntry(v: unknown): MarketplaceUsageEntry | null {
  if (!isObj(v)) return null;
  const runId = str(v.runId, 80);
  const providerId = str(v.providerId, 40);
  if (!runId || !isMarketplaceProviderId(providerId)) return null;
  return {
    runId,
    orderId: str(v.orderId, 80),
    providerId,
    items: typeof v.items === "number" ? v.items : 0,
    usd: typeof v.usd === "number" ? v.usd : 0,
    monthUsd: typeof v.monthUsd === "number" ? v.monthUsd : 0,
    at: str(v.at, 40),
    trigger: v.trigger === "auto" ? "auto" : "manual",
  };
}

export function normalizeMarketplaceListingsState(raw: unknown, nowMs = Date.now()): MarketplaceListingsState {
  if (!isObj(raw) || raw.version !== 1) return emptyMarketplaceListingsState();
  const items = Array.isArray(raw.items)
    ? raw.items.map(parseStoredListing).filter((x): x is MarketplaceStoredListing => x !== null)
    : [];
  const runs = Array.isArray(raw.runs) ? raw.runs.map(parseRun).filter((x): x is MarketplaceRunRecord => x !== null) : [];
  return {
    version: 1,
    updatedAt: str(raw.updatedAt, 40),
    items: items.filter((item) => !marketplaceListingIsExpired(item.expiresAt, nowMs)),
    runs: runs.slice(-MARKETPLACE_RUNS_KEEP),
  };
}

async function readJson(r: Exclude<ResolvedStorage, { kind: "disabled" }>, filename: string): Promise<unknown | null> {
  if (r.kind === "blob") {
    try {
      const got = await get(`${r.prefix}${filename}`, { access: "private", token: r.token, useCache: false });
      if (!got?.stream || got.statusCode !== 200) return null;
      return JSON.parse(await new Response(got.stream).text()) as unknown;
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(await fs.readFile(path.join(r.dir, filename), "utf8")) as unknown;
  } catch {
    return null;
  }
}

async function writeJson(r: Exclude<ResolvedStorage, { kind: "disabled" }>, filename: string, body: string): Promise<void> {
  if (r.kind === "blob") {
    await put(`${r.prefix}${filename}`, body, {
      access: "private",
      token: r.token,
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  const fp = path.join(r.dir, filename);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, body, "utf8");
}

export function getMarketplaceStorageEnabled(): boolean {
  return resolveStorage().kind !== "disabled";
}

export async function readMarketplaceListingsState(): Promise<MarketplaceListingsState> {
  const r = resolveStorage();
  if (r.kind === "disabled") return emptyMarketplaceListingsState();
  const raw = await readJson(r, LISTINGS_FILENAME);
  return normalizeMarketplaceListingsState(raw);
}

export async function writeMarketplaceListingsState(
  state: MarketplaceListingsState,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  try {
    const clean = normalizeMarketplaceListingsState(state);
    await writeJson(r, LISTINGS_FILENAME, JSON.stringify(clean, null, 2));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function readMarketplaceUsageMonth(month = marketplaceMonthKey()): Promise<MarketplaceUsageMonth> {
  const r = resolveStorage();
  const empty = emptyMarketplaceUsageMonth(month);
  if (r.kind === "disabled") return empty;
  const raw = await readJson(r, `usage-${month}.json`);
  if (!isObj(raw) || raw.version !== 1) return empty;
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(parseUsageEntry).filter((e): e is MarketplaceUsageEntry => e !== null)
    : [];
  return { version: 1, month, capUsd: typeof raw.capUsd === "number" ? raw.capUsd : empty.capUsd, entries };
}

export async function writeMarketplaceUsageMonth(
  usage: MarketplaceUsageMonth,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  try {
    await writeJson(r, `usage-${usage.month}.json`, JSON.stringify(usage, null, 2));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function parseAutoCronStatus(v: unknown): MarketplaceAutoCronStatus {
  if (v === "ok" || v === "skipped" || v === "budžets sasniegts" || v === "failed") return v;
  return "skipped";
}

export function normalizeMarketplaceAutoCronState(raw: unknown): MarketplaceAutoCronState {
  const empty = emptyMarketplaceAutoCronState();
  if (!isObj(raw) || raw.version !== 1) return empty;
  const skipped = Array.isArray(raw.skipped)
    ? raw.skipped
        .filter(isObj)
        .map((s) => ({ orderId: str(s.orderId, 80), reason: str(s.reason, 180) }))
        .filter((s) => s.orderId)
    : [];
  return {
    version: 1,
    updatedAt: str(raw.updatedAt, 40),
    lastStartedAt: str(raw.lastStartedAt, 40),
    lastFinishedAt: str(raw.lastFinishedAt, 40),
    status: parseAutoCronStatus(raw.status),
    reason: str(raw.reason, 240),
    loadedOrderIds: Array.isArray(raw.loadedOrderIds)
      ? raw.loadedOrderIds.map((id) => str(id, 80)).filter(Boolean).slice(0, 400)
      : [],
    skipped: skipped.slice(0, 400),
    loadedCount: typeof raw.loadedCount === "number" ? raw.loadedCount : 0,
    skippedCount: typeof raw.skippedCount === "number" ? raw.skippedCount : skipped.length,
    estimatedUsd: typeof raw.estimatedUsd === "number" ? raw.estimatedUsd : 0,
    chargedUsd: typeof raw.chargedUsd === "number" ? raw.chargedUsd : 0,
  };
}

export async function readMarketplaceAutoCronState(): Promise<MarketplaceAutoCronState> {
  const r = resolveStorage();
  if (r.kind === "disabled") return emptyMarketplaceAutoCronState();
  const raw = await readJson(r, AUTO_CRON_FILENAME);
  return normalizeMarketplaceAutoCronState(raw);
}

export async function writeMarketplaceAutoCronState(
  state: MarketplaceAutoCronState,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  try {
    await writeJson(r, AUTO_CRON_FILENAME, JSON.stringify(normalizeMarketplaceAutoCronState(state), null, 2));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function purgeExpiredMarketplaceListings(nowMs = Date.now()): Promise<{ removed: number }> {
  const prev = await readMarketplaceListingsState();
  const items = prev.items.filter((item) => !marketplaceListingIsExpired(item.expiresAt, nowMs));
  const removed = prev.items.length - items.length;
  if (removed === 0) return { removed: 0 };
  await writeMarketplaceListingsState({ ...prev, updatedAt: new Date(nowMs).toISOString(), items });
  return { removed };
}

export function marketplaceItemsForOrder(state: MarketplaceListingsState, orderId: string): MarketplaceStoredListing[] {
  return state.items.filter((item) => item.orderId === orderId);
}
