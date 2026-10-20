import "server-only";

import { get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  archiveLogisticsOrder,
  isLogisticsOrderActive,
  wakeLogisticsOrder,
} from "@/lib/iriss-logistics-archive";
import {
  decideLogisticsMapsQuota,
  emptyLogisticsMapsUsageMonth,
  incrementLogisticsMapsUsage,
  logisticsMapsMonthKey,
} from "@/lib/iriss-logistics-maps-quota";
import { previousLogisticsPoints } from "@/lib/iriss-logistics-previous-points";
import { seedLogisticsFromPunkti, type LogisticsPunktiJson } from "@/lib/iriss-logistics-seed";
import {
  IRISS_LOGISTICS_WORKSPACE,
  isLogisticsAuction,
  isLogisticsOrderStatus,
  snapshotLogisticsPoint,
  type LogisticsGeocodeCacheEntry,
  type LogisticsGeocodeStatus,
  type LogisticsListingParsed,
  type LogisticsMapsApi,
  type LogisticsMapsUsageMonth,
  type LogisticsOrder,
  type LogisticsOrderSource,
  type LogisticsOrderStatus,
  type LogisticsPoint,
  type LogisticsPreviousPointRow,
} from "@/lib/iriss-logistics-types";

const DEFAULT_RELATIVE_DIR = ".data/iriss-logistics";
export const IRISS_LOGISTICS_BLOB_PREFIX = "iriss-logistics/";
const POINTS_FILE = "points.json";
const ORDERS_FILE = "orders.json";
const GEOCODE_FILE = "geocode-cache.json";
const USAGE_FILE_PREFIX = "maps-usage-";
const SEED_META_FILE = "seed-meta.json";

type ResolvedStorage =
  | { kind: "disabled"; reason: "explicit_off" | "vercel_without_blob_token" }
  | { kind: "fs"; dir: string }
  | { kind: "blob"; token: string; prefix: string };

let resolvedMemo: ResolvedStorage | null = null;
const quotaLocks = new Map<string, Promise<unknown>>();

function isNonVercelServerlessRuntime(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

function computeResolvedStorage(): ResolvedStorage {
  const raw = process.env.ADMIN_IRISS_LOGISTICS_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return { kind: "disabled", reason: "explicit_off" };
  if (raw) return { kind: "fs", dir: path.resolve(raw) };
  if (process.env.VERCEL) {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
    if (!token) return { kind: "disabled", reason: "vercel_without_blob_token" };
    return {
      kind: "blob",
      token,
      prefix: process.env.ADMIN_IRISS_LOGISTICS_BLOB_PREFIX?.trim() || IRISS_LOGISTICS_BLOB_PREFIX,
    };
  }
  if (isNonVercelServerlessRuntime()) {
    return { kind: "fs", dir: path.join(os.tmpdir(), "provin-iriss-logistics") };
  }
  return { kind: "fs", dir: path.join(process.cwd(), DEFAULT_RELATIVE_DIR) };
}

function resolveStorage(): ResolvedStorage {
  if (!resolvedMemo) resolvedMemo = computeResolvedStorage();
  return resolvedMemo;
}

export function getIrissLogisticsStorageState():
  | { enabled: false; reason: "explicit_off" | "vercel_blob_token_missing" }
  | { enabled: true; persistence: "filesystem"; path: string }
  | { enabled: true; persistence: "vercel_blob" } {
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

export function isIrissLogisticsStoreEnabled(): boolean {
  return resolveStorage().kind !== "disabled";
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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

async function writeJson(
  r: Exclude<ResolvedStorage, { kind: "disabled" }>,
  filename: string,
  body: unknown,
): Promise<void> {
  const text = JSON.stringify(body, null, 2);
  if (r.kind === "blob") {
    await put(`${r.prefix}${filename}`, text, {
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
  await fs.writeFile(fp, text, "utf8");
}

function normalizePoint(raw: unknown): LogisticsPoint | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  const name = str(raw.name, 160);
  if (!id || !name) return null;
  const auction = isLogisticsAuction(raw.auction) ? raw.auction : "cits";
  return {
    id,
    workspace: IRISS_LOGISTICS_WORKSPACE,
    auction,
    name,
    street: str(raw.street, 160),
    postcode: str(raw.postcode, 16),
    city: str(raw.city, 80),
    country: str(raw.country, 4).toUpperCase() || "DE",
    lat: numOrNull(raw.lat),
    lng: numOrNull(raw.lng),
    hours: Array.isArray(raw.hours)
      ? raw.hours
          .filter(isObj)
          .map((h) => ({
            days: str(h.days, 16),
            ...(str(h.from, 8) ? { from: str(h.from, 8) } : {}),
            ...(str(h.to, 8) ? { to: str(h.to, 8) } : {}),
          }))
          .filter((h) => h.days)
      : [],
    hoursText: str(raw.hoursText, 240),
    contactName: str(raw.contactName, 80),
    phone: str(raw.phone, 40),
    email: str(raw.email, 120),
    parkingRule: isObj(raw.parkingRule)
      ? {
          freeDays: numOrNull(raw.parkingRule.freeDays),
          adminFee: numOrNull(raw.parkingRule.adminFee),
          perDay: numOrNull(raw.parkingRule.perDay),
          starts: str(raw.parkingRule.starts, 40) || "after_payment",
        }
      : null,
    rules: str(raw.rules, 800),
    requiredDocs: Array.isArray(raw.requiredDocs) ? raw.requiredDocs.map((x) => str(x, 80)).filter(Boolean) : [],
    notes: str(raw.notes, 1200),
    pickupCodes: Array.isArray(raw.pickupCodes) ? raw.pickupCodes.map((x) => str(x, 80)).filter(Boolean) : [],
    active: raw.active !== false,
    createdAt: str(raw.createdAt, 40) || new Date().toISOString(),
    updatedAt: str(raw.updatedAt, 40) || new Date().toISOString(),
    updatedBy: str(raw.updatedBy, 80),
  };
}

function normalizeListingParsed(raw: unknown): LogisticsListingParsed | null {
  if (!isObj(raw)) return null;
  return {
    make: str(raw.make, 40),
    model: str(raw.model, 80),
    vin: str(raw.vin, 17).toUpperCase(),
    priceEur: numOrNull(raw.priceEur),
    mileageKm: numOrNull(raw.mileageKm),
    address: str(raw.address, 200),
    source: str(raw.source, 40),
    parsedAt: str(raw.parsedAt, 40),
  };
}

function normalizeOrder(raw: unknown): LogisticsOrder | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  if (!id) return null;
  const status: LogisticsOrderStatus = isLogisticsOrderStatus(raw.status) ? raw.status : "organize_pickup";
  const archived = raw.archived === true || status === "picked_up" || status === "delivered" || status === "archived";
  const source: LogisticsOrderSource = raw.source === "private" ? "private" : "auction";
  const geocodeStatus: LogisticsGeocodeStatus =
    raw.geocodeStatus === "ok" ||
    raw.geocodeStatus === "neprecizs" ||
    raw.geocodeStatus === "manuali" ||
    raw.geocodeStatus === "pending" ||
    raw.geocodeStatus === "failed"
      ? raw.geocodeStatus
      : "pending";
  return {
    id,
    workspace: IRISS_LOGISTICS_WORKSPACE,
    source,
    auction: isLogisticsAuction(raw.auction) ? raw.auction : source === "private" ? "cits" : "",
    auctionUrl: str(raw.auctionUrl, 500),
    listingUrl: str(raw.listingUrl, 500),
    listingParsed: normalizeListingParsed(raw.listingParsed),
    make: str(raw.make, 40),
    model: str(raw.model, 80),
    vin: str(raw.vin, 17).toUpperCase(),
    title: str(raw.title, 160),
    priceEur: numOrNull(raw.priceEur),
    mileageKm: numOrNull(raw.mileageKm),
    pickupPointId: str(raw.pickupPointId, 80),
    pickupSnapshot: isObj(raw.pickupSnapshot)
      ? {
          name: str(raw.pickupSnapshot.name, 160),
          auction: isLogisticsAuction(raw.pickupSnapshot.auction) ? raw.pickupSnapshot.auction : "cits",
          street: str(raw.pickupSnapshot.street, 160),
          postcode: str(raw.pickupSnapshot.postcode, 16),
          city: str(raw.pickupSnapshot.city, 80),
          country: str(raw.pickupSnapshot.country, 4),
          lat: numOrNull(raw.pickupSnapshot.lat),
          lng: numOrNull(raw.pickupSnapshot.lng),
          hoursText: str(raw.pickupSnapshot.hoursText, 240),
          contactName: str(raw.pickupSnapshot.contactName, 80),
          phone: str(raw.pickupSnapshot.phone, 40),
          email: str(raw.pickupSnapshot.email, 120),
          parkingRule: isObj(raw.pickupSnapshot.parkingRule)
            ? {
                freeDays: numOrNull(raw.pickupSnapshot.parkingRule.freeDays),
                adminFee: numOrNull(raw.pickupSnapshot.parkingRule.adminFee),
                perDay: numOrNull(raw.pickupSnapshot.parkingRule.perDay),
                starts: str(raw.pickupSnapshot.parkingRule.starts, 40),
              }
            : null,
          rules: str(raw.pickupSnapshot.rules, 800),
        }
      : null,
    pickupRef: str(raw.pickupRef, 80),
    pickupAddress: str(raw.pickupAddress, 240),
    pickupLat: numOrNull(raw.pickupLat),
    pickupLng: numOrNull(raw.pickupLng),
    geocodeStatus,
    pickupDate: str(raw.pickupDate, 40),
    status,
    archived,
    archivedAt: str(raw.archivedAt, 40),
    previousStatus: isLogisticsOrderStatus(raw.previousStatus) ? raw.previousStatus : "",
    statusNote: str(raw.statusNote, 240),
    nextAction: str(raw.nextAction, 240),
    sellerContact: str(raw.sellerContact, 240),
    notes: str(raw.notes, 1200),
    createdAt: str(raw.createdAt, 40) || new Date().toISOString(),
    updatedAt: str(raw.updatedAt, 40) || new Date().toISOString(),
  };
}

async function withQuotaLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = quotaLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const curr = new Promise<void>((r) => {
    release = r;
  });
  quotaLocks.set(
    key,
    prev.then(() => curr),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function loadPunktiJson(): LogisticsPunktiJson {
  const fp = path.join(process.cwd(), "data/iriss-logistics-punkti.json");
  return JSON.parse(readFileSync(fp, "utf8")) as LogisticsPunktiJson;
}

async function ensureSeeded(r: Exclude<ResolvedStorage, { kind: "disabled" }>): Promise<void> {
  const meta = await readJson(r, SEED_META_FILE);
  if (isObj(meta) && meta.seeded === true) return;
  const existingPoints = await readJson(r, POINTS_FILE);
  const existingOrders = await readJson(r, ORDERS_FILE);
  const hasPoints = isObj(existingPoints) && Array.isArray(existingPoints.items) && existingPoints.items.length > 0;
  if (hasPoints) {
    await writeJson(r, SEED_META_FILE, { seeded: true, at: new Date().toISOString(), skipped: true });
    return;
  }
  const seeded = seedLogisticsFromPunkti(loadPunktiJson());
  await writeJson(r, POINTS_FILE, { version: 1, items: seeded.points });
  await writeJson(r, ORDERS_FILE, {
    version: 1,
    items: Array.isArray(isObj(existingOrders) ? existingOrders.items : null)
      ? [...seeded.orders]
      : seeded.orders,
  });
  await writeJson(r, SEED_META_FILE, {
    seeded: true,
    at: new Date().toISOString(),
    pointCount: seeded.points.length,
    orderCount: seeded.orders.length,
  });
}

export async function listLogisticsPoints(): Promise<LogisticsPoint[]> {
  const r = resolveStorage();
  if (r.kind === "disabled") return [];
  await ensureSeeded(r);
  const raw = await readJson(r, POINTS_FILE);
  const items = isObj(raw) && Array.isArray(raw.items) ? raw.items : [];
  return items.map(normalizePoint).filter((p): p is LogisticsPoint => p !== null);
}

export async function writeLogisticsPoints(items: LogisticsPoint[]): Promise<void> {
  const r = resolveStorage();
  if (r.kind === "disabled") throw new Error("store_disabled");
  await writeJson(r, POINTS_FILE, { version: 1, items });
}

export async function listLogisticsOrders(): Promise<LogisticsOrder[]> {
  const r = resolveStorage();
  if (r.kind === "disabled") return [];
  await ensureSeeded(r);
  const raw = await readJson(r, ORDERS_FILE);
  const items = isObj(raw) && Array.isArray(raw.items) ? raw.items : [];
  return items.map(normalizeOrder).filter((p): p is LogisticsOrder => p !== null);
}

export async function writeLogisticsOrders(items: LogisticsOrder[]): Promise<void> {
  const r = resolveStorage();
  if (r.kind === "disabled") throw new Error("store_disabled");
  await writeJson(r, ORDERS_FILE, { version: 1, items });
}

export async function getLogisticsPoint(id: string): Promise<LogisticsPoint | null> {
  const items = await listLogisticsPoints();
  return items.find((p) => p.id === id) ?? null;
}

export async function upsertLogisticsPoint(
  patch: Partial<LogisticsPoint> & Pick<LogisticsPoint, "name" | "auction">,
): Promise<LogisticsPoint> {
  const items = await listLogisticsPoints();
  const now = new Date().toISOString();
  const id = patch.id?.trim() || randomUUID();
  const prev = items.find((p) => p.id === id);
  const next: LogisticsPoint = {
    id,
    workspace: IRISS_LOGISTICS_WORKSPACE,
    auction: patch.auction,
    name: patch.name,
    street: patch.street ?? prev?.street ?? "",
    postcode: patch.postcode ?? prev?.postcode ?? "",
    city: patch.city ?? prev?.city ?? "",
    country: (patch.country ?? prev?.country ?? "DE").toUpperCase(),
    lat: patch.lat !== undefined ? patch.lat : (prev?.lat ?? null),
    lng: patch.lng !== undefined ? patch.lng : (prev?.lng ?? null),
    hours: patch.hours ?? prev?.hours ?? [],
    hoursText: patch.hoursText ?? prev?.hoursText ?? "",
    contactName: patch.contactName ?? prev?.contactName ?? "",
    phone: patch.phone ?? prev?.phone ?? "",
    email: patch.email ?? prev?.email ?? "",
    parkingRule: patch.parkingRule !== undefined ? patch.parkingRule : (prev?.parkingRule ?? null),
    rules: patch.rules ?? prev?.rules ?? "",
    requiredDocs: patch.requiredDocs ?? prev?.requiredDocs ?? [],
    notes: patch.notes ?? prev?.notes ?? "",
    pickupCodes: patch.pickupCodes ?? prev?.pickupCodes ?? [],
    active: patch.active ?? prev?.active ?? true,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    updatedBy: patch.updatedBy ?? prev?.updatedBy ?? "admin",
  };
  const out = prev ? items.map((p) => (p.id === id ? next : p)) : [...items, next];
  await writeLogisticsPoints(out);
  return next;
}

export async function getLogisticsOrder(id: string): Promise<LogisticsOrder | null> {
  const items = await listLogisticsOrders();
  return items.find((p) => p.id === id) ?? null;
}

export async function upsertLogisticsOrder(patch: Partial<LogisticsOrder> & { id?: string }): Promise<LogisticsOrder> {
  const items = await listLogisticsOrders();
  const now = new Date().toISOString();
  const id = patch.id?.trim() || randomUUID();
  const prev = items.find((p) => p.id === id);
  const base: LogisticsOrder = prev ?? {
    id,
    workspace: IRISS_LOGISTICS_WORKSPACE,
    source: "auction",
    auction: "",
    auctionUrl: "",
    listingUrl: "",
    listingParsed: null,
    make: "",
    model: "",
    vin: "",
    title: "",
    priceEur: null,
    mileageKm: null,
    pickupPointId: "",
    pickupSnapshot: null,
    pickupRef: "",
    pickupAddress: "",
    pickupLat: null,
    pickupLng: null,
    geocodeStatus: "pending",
    pickupDate: "",
    status: "organize_pickup",
    archived: false,
    archivedAt: "",
    previousStatus: "",
    statusNote: "",
    nextAction: "",
    sellerContact: "",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
  let next: LogisticsOrder = {
    ...base,
    ...patch,
    id,
    workspace: IRISS_LOGISTICS_WORKSPACE,
    updatedAt: now,
    createdAt: base.createdAt,
  };
  if (patch.pickupPointId && patch.pickupPointId !== base.pickupPointId) {
    const point = await getLogisticsPoint(patch.pickupPointId);
    if (point) {
      next = {
        ...next,
        pickupPointId: point.id,
        pickupSnapshot: snapshotLogisticsPoint(point),
        pickupAddress:
          next.pickupAddress ||
          [point.street, [point.postcode, point.city].filter(Boolean).join(" "), point.country].filter(Boolean).join(", "),
        pickupLat: next.pickupLat ?? point.lat,
        pickupLng: next.pickupLng ?? point.lng,
      };
    }
  }
  const out = prev ? items.map((p) => (p.id === id ? next : p)) : [...items, next];
  await writeLogisticsOrders(out);
  return next;
}

export async function setLogisticsOrderArchiveState(
  id: string,
  action: "picked_up" | "delivered" | "archive" | "wake",
): Promise<LogisticsOrder | null> {
  const items = await listLogisticsOrders();
  const prev = items.find((p) => p.id === id);
  if (!prev) return null;
  const now = new Date().toISOString();
  const next =
    action === "wake"
      ? wakeLogisticsOrder(prev, now)
      : archiveLogisticsOrder(prev, action === "archive" ? "archived" : action, now);
  await writeLogisticsOrders(items.map((p) => (p.id === id ? next : p)));
  return next;
}

export async function countActiveLogisticsOrders(): Promise<number> {
  const orders = await listLogisticsOrders();
  return orders.filter(isLogisticsOrderActive).length;
}

export async function listPreviousLogisticsPoints(nowMs = Date.now()): Promise<LogisticsPreviousPointRow[]> {
  const [orders, points] = await Promise.all([listLogisticsOrders(), listLogisticsPoints()]);
  return previousLogisticsPoints({ orders, points, nowMs });
}

export async function readGeocodeCache(): Promise<Record<string, LogisticsGeocodeCacheEntry>> {
  const r = resolveStorage();
  if (r.kind === "disabled") return {};
  const raw = await readJson(r, GEOCODE_FILE);
  if (!isObj(raw) || !isObj(raw.entries)) return {};
  const out: Record<string, LogisticsGeocodeCacheEntry> = {};
  for (const [k, v] of Object.entries(raw.entries)) {
    if (!isObj(v)) continue;
    const lat = numOrNull(v.lat);
    const lng = numOrNull(v.lng);
    if (lat == null || lng == null) continue;
    out[k] = {
      query: str(v.query, 240) || k,
      lat,
      lng,
      formatted: str(v.formatted, 240),
      precision:
        v.precision === "rooftop" || v.precision === "street" || v.precision === "city" || v.precision === "region"
          ? v.precision
          : "unknown",
      status: v.status === "ok" || v.status === "neprecizs" || v.status === "manuali" ? v.status : "ok",
      cachedAt: str(v.cachedAt, 40),
    };
  }
  return out;
}

export async function writeGeocodeCacheEntry(key: string, entry: LogisticsGeocodeCacheEntry): Promise<void> {
  const r = resolveStorage();
  if (r.kind === "disabled") return;
  const prev = await readGeocodeCache();
  prev[key] = entry;
  await writeJson(r, GEOCODE_FILE, { version: 1, entries: prev });
}

function usageFile(month: string): string {
  return `${USAGE_FILE_PREFIX}${month}.json`;
}

export async function readLogisticsMapsUsage(month = logisticsMapsMonthKey()): Promise<LogisticsMapsUsageMonth> {
  const r = resolveStorage();
  const empty = emptyLogisticsMapsUsageMonth(month);
  if (r.kind === "disabled") return empty;
  const raw = await readJson(r, usageFile(month));
  if (!isObj(raw) || raw.version !== 1) return empty;
  const days: LogisticsMapsUsageMonth["days"] = {};
  if (isObj(raw.days)) {
    for (const [k, v] of Object.entries(raw.days)) {
      if (!isObj(v)) continue;
      days[k] = {
        mapsJs: typeof v.mapsJs === "number" ? v.mapsJs : 0,
        geocoding: typeof v.geocoding === "number" ? v.geocoding : 0,
      };
    }
  }
  return {
    version: 1,
    month,
    mapsJs: typeof raw.mapsJs === "number" ? raw.mapsJs : 0,
    geocoding: typeof raw.geocoding === "number" ? raw.geocoding : 0,
    days,
  };
}

export async function consumeLogisticsMapsQuota(
  api: LogisticsMapsApi,
  at = new Date(),
): Promise<{ ok: true; usage: LogisticsMapsUsageMonth } | { ok: false; notice: string; usage: LogisticsMapsUsageMonth }> {
  const month = logisticsMapsMonthKey(at);
  return withQuotaLock(`maps-${month}`, async () => {
    const usage = await readLogisticsMapsUsage(month);
    const decision = decideLogisticsMapsQuota({ usage, api, at });
    if (!decision.allowed) {
      return { ok: false as const, notice: decision.notice, usage };
    }
    const next = incrementLogisticsMapsUsage(usage, api, at);
    const r = resolveStorage();
    if (r.kind !== "disabled") await writeJson(r, usageFile(month), next);
    return { ok: true as const, usage: next };
  });
}

export function googleMapsBrowserKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

export function googleMapsServerKey(): string {
  return process.env.GOOGLE_MAPS_SERVER_KEY?.trim() || process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim() || googleMapsBrowserKey();
}
