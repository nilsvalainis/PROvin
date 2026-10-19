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
  isMarketplacePlatform,
  isMarketplaceProviderId,
  MARKETPLACE_TTL_DAYS,
  type MarketplaceAutoCronState,
  type MarketplaceAutoCronStatus,
  type MarketplaceListingsState,
  type MarketplaceRunRecord,
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

function parseRun(v: unknown): MarketplaceRunRecord | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 80);
  const orderId = str(v.orderId, 80);
  if (!id || !orderId) return null;
  return {
    id,
    orderId,
    tenantScope: "iriss",
    providers: Array.isArray(v.providers)
      ? v.providers.map((p) => str(p, 40)).filter(isMarketplaceProviderId)
      : [],
    query: {
      make: str((v.query as { make?: unknown } | undefined)?.make, 40),
      model: str((v.query as { model?: unknown } | undefined)?.model, 60),
      yearFrom: numOrNull((v.query as { yearFrom?: unknown } | undefined)?.yearFrom),
      yearTo: numOrNull((v.query as { yearTo?: unknown } | undefined)?.yearTo),
      mileageFrom: numOrNull((v.query as { mileageFrom?: unknown } | undefined)?.mileageFrom),
      mileageTo: numOrNull((v.query as { mileageTo?: unknown } | undefined)?.mileageTo),
      priceFrom: numOrNull((v.query as { priceFrom?: unknown } | undefined)?.priceFrom),
      priceTo: numOrNull((v.query as { priceTo?: unknown } | undefined)?.priceTo),
      fuel: str((v.query as { fuel?: unknown } | undefined)?.fuel, 40),
      gearbox: str((v.query as { gearbox?: unknown } | undefined)?.gearbox, 40),
      powerFromKw: numOrNull((v.query as { powerFromKw?: unknown } | undefined)?.powerFromKw),
      powerToKw: numOrNull((v.query as { powerToKw?: unknown } | undefined)?.powerToKw),
      displacementFromCc: numOrNull((v.query as { displacementFromCc?: unknown } | undefined)?.displacementFromCc),
      displacementToCc: numOrNull((v.query as { displacementToCc?: unknown } | undefined)?.displacementToCc),
      body: str((v.query as { body?: unknown } | undefined)?.body, 40),
      drive: str((v.query as { drive?: unknown } | undefined)?.drive, 40),
      countries: Array.isArray((v.query as { countries?: unknown } | undefined)?.countries)
        ? ((v.query as { countries?: unknown[] }).countries ?? []).map((c) => str(c, 8)).filter(Boolean).slice(0, 8)
        : [],
    },
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
    note: str(v.note, 240),
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
    ? raw.entries
        .filter(isObj)
        .map((e) => ({
          runId: str(e.runId, 80),
          orderId: str(e.orderId, 80),
          providerId: str(e.providerId, 40),
          items: typeof e.items === "number" ? e.items : 0,
          usd: typeof e.usd === "number" ? e.usd : 0,
          monthUsd: typeof e.monthUsd === "number" ? e.monthUsd : 0,
          at: str(e.at, 40),
          trigger: e.trigger === "auto" ? ("auto" as const) : ("manual" as const),
        }))
        .filter((e): e is MarketplaceUsageEntry => Boolean(e.runId) && isMarketplaceProviderId(e.providerId))
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
