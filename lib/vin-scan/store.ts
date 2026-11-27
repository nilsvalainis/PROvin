/**
 * VIN SCAN persistents: Blob vai lokāls `.data/vin-scans`. Kešs pēc VIN, TTL pa avotiem (source-ttl.ts).
 */
import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { get, put } from "@vercel/blob";

import { ORDER_VIN_SCAN_BROWSER_IMPORT_IDS } from "@/lib/order-vin-scan";
import { overlayVinScanBrowserImports, type VinScanBrowserImport } from "@/lib/vin-scan/browser-import-overlay";
import { vinScanIndicatorsFresh } from "@/lib/vin-scan/source-ttl";
import type { JojNameDict } from "@/lib/vin-scan/joj-labels";
import { thecarapiDetailPathAllowed } from "@/lib/vin-scan/parse-thecarapi";
import { emptyVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
import { normalizeThecarapiAdminRecords, type ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";
import type { VinScanIndicator, VinScanParse } from "@/lib/vin-scan/types";

export type VinScanSnapshot = {
  vin: string;
  plates: VinScanPlates;
  scannedAt: string;
  indicators: VinScanIndicator[];
};

export type VinScanHistoryEntry = {
  vin: string;
  scannedAt: string;
  found: number;
  none: number;
};

const DEFAULT_RELATIVE_DIR = ".data/vin-scans";
const DEFAULT_BLOB_SUBPREFIX = "vin-scans/";
const INDEX_KEY = "_history";
const HISTORY_MAX = 40;
/** JoJ /search-vin ir $0.50: found kešs pēc VIN, 30 dienas. */
export const JOJ_VIN_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 404 / nav ierakstu: kešs max 7 dienas, tad atkārtots HTTP. */
export const JOJ_VIN_NONE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** /usa/damages un /usa/titles: $0.01, gandrīz statiskas vārdnīcas. */
export const JOJ_DICT_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type BlobConfig = { token: string; prefix: string };

function resolveBlob(): BlobConfig | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!token) return null;
  const explicit = (process.env.VIN_SCAN_BLOB_PREFIX ?? "").trim();
  if (explicit) return { token, prefix: explicit.endsWith("/") ? explicit : `${explicit}/` };
  const draftPrefix = (process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX ?? "").trim();
  if (!draftPrefix) return null;
  const base = draftPrefix.endsWith("/") ? draftPrefix : `${draftPrefix}/`;
  return { token, prefix: `${base}${DEFAULT_BLOB_SUBPREFIX}` };
}

function resolveDir(): string | null {
  const raw = process.env.VIN_SCAN_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  if (process.env.VERCEL === "1") return path.join(os.tmpdir(), "provin-vin-scans");
  return path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
}

function snapshotKey(vin: string): string {
  return vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
}

async function readJson(key: string): Promise<unknown | null> {
  const blob = resolveBlob();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${key}.json`, { access: "private", token: blob.token, useCache: false });
      if (res && res.statusCode === 200 && res.stream) {
        const text = await new Response(res.stream).text();
        return JSON.parse(text) as unknown;
      }
    } catch {
      /* failsistēma */
    }
  }
  const dir = resolveDir();
  if (!dir) return null;
  try {
    const text = await fs.readFile(path.join(dir, `${key}.json`), "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isEphemeralDir(dir: string): boolean {
  const normalized = path.resolve(dir);
  const tmp = path.resolve(os.tmpdir());
  return normalized === tmp || normalized.startsWith(`${tmp}${path.sep}`);
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value);
  const blob = resolveBlob();
  let blobOk = false;
  if (blob) {
    try {
      await put(`${blob.prefix}${key}.json`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      blobOk = true;
    } catch (e) {
      console.warn(
        JSON.stringify({
          vinScanStore: true,
          event: "blob_write_failed",
          keyKind:
            key === INDEX_KEY
              ? "history"
              : key.startsWith("joj-")
                ? "joj"
                : key.includes("thecarapi")
                  ? "thecarapi"
                  : key.includes(".browser.")
                    ? "browser_import"
                    : "snapshot",
          msg: e instanceof Error ? e.message.slice(0, 160) : "error",
        }),
      );
    }
  }
  const dir = resolveDir();
  if (dir) {
    const filePath = path.join(dir, `${key}.json`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body, "utf8");
  }
  if (blob && !blobOk && (!dir || isEphemeralDir(dir))) {
    throw new Error("blob_write_failed");
  }
}

function asSnapshot(raw: unknown): VinScanSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const vin = typeof o.vin === "string" ? o.vin : "";
  if (!vin) return null;
  if (typeof o.scannedAt !== "string" || !Array.isArray(o.indicators)) return null;
  const plates = o.plates && typeof o.plates === "object" ? { ...emptyVinScanPlates(), ...(o.plates as VinScanPlates) } : emptyVinScanPlates();
  return { vin, plates, scannedAt: o.scannedAt, indicators: o.indicators as VinScanIndicator[] };
}

/** Svaigs pēc katras rindas TTL (`lib/vin-scan/source-ttl.ts`), nevis viena 12 h robeža. */
export function vinScanSnapshotFresh(snapshot: VinScanSnapshot, nowMs = Date.now()): boolean {
  return vinScanIndicatorsFresh(snapshot.indicators, snapshot.scannedAt, nowMs);
}

function browserImportKey(vin: string, sourceId: string): string | null {
  const key = snapshotKey(vin);
  const id = sourceId.trim();
  if (key.length < 11 || !ORDER_VIN_SCAN_BROWSER_IMPORT_IDS.includes(id) || !/^[a-z0-9_]+$/.test(id)) return null;
  return `${key}.browser.${id}`;
}

function asBrowserImport(raw: unknown, vin: string, id: string): VinScanBrowserImport | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.vin !== "string" || snapshotKey(o.vin) !== snapshotKey(vin)) return null;
  if (o.id !== id || typeof o.importedAt !== "string" || !Number.isFinite(Date.parse(o.importedAt))) return null;
  const row = o.row as VinScanIndicator | undefined;
  if (!row || typeof row !== "object" || row.id !== id || typeof row.status !== "string") return null;
  return { vin: o.vin, id, importedAt: o.importedAt, row };
}

/**
 * Pārlūka imports savā atslēgā (`<VIN>.browser.<avots>`): momentuzņēmumu var pārrakstīt paralēla skenēšana
 * vai cits imports, šo ierakstu - tikai tā paša avota jaunāks imports.
 */
export async function writeVinScanBrowserImport(vin: string, row: VinScanIndicator, importedAt: string): Promise<void> {
  const key = browserImportKey(vin, row.id);
  if (!key) return;
  const body: VinScanBrowserImport = { vin: vin.trim().toUpperCase(), id: row.id, importedAt, row };
  await writeJson(key, body);
}

export async function readVinScanBrowserImports(vin: string): Promise<VinScanBrowserImport[]> {
  const all = await Promise.all(
    ORDER_VIN_SCAN_BROWSER_IMPORT_IDS.map(async (id) => {
      const key = browserImportKey(vin, id);
      if (!key) return null;
      return asBrowserImport(await readJson(key).catch(() => null), vin, id);
    }),
  );
  return all.filter((item): item is VinScanBrowserImport => Boolean(item));
}

/** Momentuzņēmums ar virsū uzliktiem derīgiem pārlūka importiem (sk. browser-import-overlay.ts). */
export async function readVinScanSnapshot(vin: string, nowMs = Date.now()): Promise<VinScanSnapshot | null> {
  const key = snapshotKey(vin);
  if (key.length < 11) return null;
  const snapshot = asSnapshot(await readJson(key));
  if (!snapshot) return null;
  const imports = await readVinScanBrowserImports(vin);
  if (!imports.length) return snapshot;
  return {
    ...snapshot,
    indicators: overlayVinScanBrowserImports(snapshot.indicators, snapshot.scannedAt, imports, nowMs),
  };
}

export async function writeVinScanSnapshot(snapshot: VinScanSnapshot): Promise<void> {
  const key = snapshotKey(snapshot.vin);
  if (key.length < 11) return;
  await writeJson(key, snapshot);
  const prev = (await readJson(INDEX_KEY)) as { entries?: VinScanHistoryEntry[] } | null;
  const entries = Array.isArray(prev?.entries) ? prev.entries : [];
  const found = snapshot.indicators.filter((i) => i.status === "found").length;
  const none = snapshot.indicators.filter((i) => i.status === "none").length;
  const next: VinScanHistoryEntry[] = [
    { vin: snapshot.vin, scannedAt: snapshot.scannedAt, found, none },
    ...entries.filter((e) => e.vin !== snapshot.vin),
  ].slice(0, HISTORY_MAX);
  await writeJson(INDEX_KEY, { entries: next });
}

export async function listVinScanHistory(): Promise<VinScanHistoryEntry[]> {
  const prev = (await readJson(INDEX_KEY)) as { entries?: VinScanHistoryEntry[] } | null;
  return Array.isArray(prev?.entries) ? prev.entries : [];
}

export type JojVinCache = {
  vin: string;
  cachedAt: string;
  parse: VinScanParse;
  httpStatus?: number;
};

function jojCacheKey(vin: string): string {
  return `joj-${snapshotKey(vin)}`;
}

export function jojVinCacheTtlMs(parse: VinScanParse, httpStatus?: number): number {
  if (parse.status === "none" || httpStatus === 404) return JOJ_VIN_NONE_CACHE_TTL_MS;
  return JOJ_VIN_CACHE_TTL_MS;
}

export function asJojVinCache(raw: unknown, nowMs = Date.now()): JojVinCache | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const vin = typeof o.vin === "string" ? o.vin : "";
  const cachedAt = typeof o.cachedAt === "string" ? o.cachedAt : "";
  if (!vin || !cachedAt || !o.parse || typeof o.parse !== "object") return null;
  const t = Date.parse(cachedAt);
  const parse = o.parse as VinScanParse;
  if (parse.status !== "found" && parse.status !== "none" && parse.status !== "unknown") return null;
  const httpStatus =
    typeof o.httpStatus === "number" && Number.isFinite(o.httpStatus) ? o.httpStatus : undefined;
  if (!Number.isFinite(t) || nowMs - t >= jojVinCacheTtlMs(parse, httpStatus)) return null;
  return { vin, cachedAt, parse, ...(httpStatus != null ? { httpStatus } : {}) };
}

export async function readJojVinCache(vin: string): Promise<JojVinCache | null> {
  const key = snapshotKey(vin);
  if (key.length < 11) return null;
  return asJojVinCache(await readJson(jojCacheKey(vin)));
}

export async function writeJojVinCache(
  vin: string,
  parse: VinScanParse,
  extra?: { httpStatus?: number; cachedAt?: string },
): Promise<void> {
  const key = snapshotKey(vin);
  if (key.length < 11) return;
  const body: JojVinCache = {
    vin: vin.trim().toUpperCase(),
    cachedAt: extra?.cachedAt ?? new Date().toISOString(),
    parse,
    ...(extra?.httpStatus != null ? { httpStatus: extra.httpStatus } : {}),
  };
  await writeJson(jojCacheKey(vin), body);
}

const JOJ_DICT_KEY = "joj-dicts-usa";

export type JojDictCache = {
  cachedAt: string;
  dict: JojNameDict;
};

function asJojDictCache(raw: unknown): JojDictCache | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const cachedAt = typeof o.cachedAt === "string" ? o.cachedAt : "";
  const dict = o.dict && typeof o.dict === "object" ? (o.dict as JojNameDict) : null;
  if (!cachedAt || !dict || typeof dict.damages !== "object" || typeof dict.titles !== "object") return null;
  const t = Date.parse(cachedAt);
  if (!Number.isFinite(t) || Date.now() - t >= JOJ_DICT_CACHE_TTL_MS) return null;
  return {
    cachedAt,
    dict: {
      damages: dict.damages && typeof dict.damages === "object" ? dict.damages : {},
      titles: dict.titles && typeof dict.titles === "object" ? dict.titles : {},
    },
  };
}

export async function readJojDictCache(): Promise<JojDictCache | null> {
  return asJojDictCache(await readJson(JOJ_DICT_KEY));
}

export async function writeJojDictCache(dict: JojNameDict): Promise<void> {
  const body: JojDictCache = { cachedAt: new Date().toISOString(), dict };
  await writeJson(JOJ_DICT_KEY, body);
}

/** TheCarApi VIN vēsture: found 30 dienas, none 7 dienas. 5xx/401/403/429/timeout nekešo. */
export const THECARAPI_VIN_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const THECARAPI_VIN_NONE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const THECARAPI_DETAIL_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const THECARAPI_DETAIL_ACTIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type ThecarapiVinCacheRef = { site: string; id: string; active: boolean; detailPath?: string };

export type ThecarapiVinCache = {
  vin: string;
  cachedAt: string;
  parse: VinScanParse;
  httpStatus?: number;
  etag?: string;
  refs?: ThecarapiVinCacheRef[];
  records?: ThecarapiAdminRecord[];
  recordsComplete?: boolean;
};

export type ThecarapiDetailCache = {
  site: string;
  id: string;
  cachedAt: string;
  etag?: string;
  active: boolean;
  json: unknown;
};

export type ThecarapiUsage = {
  month: string;
  count: number;
};

function thecarapiVinKey(vin: string): string | null {
  const key = snapshotKey(vin);
  if (key.length < 11) return null;
  return `vin_scan/thecarapi/${key}`;
}

function thecarapiPairKey(site: string, id: string, kind: "detail" | "images"): string | null {
  const s = site.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const i = id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  if (!s || !i || s.includes("..") || i.includes("..")) return null;
  return `vin_scan/thecarapi/${kind}/${s}_${i}`;
}

function thecarapiDetailStorageKey(site: string, id: string): string | null {
  return thecarapiPairKey(site, id, "detail");
}

function thecarapiImageStorageKey(site: string, id: string): string | null {
  return thecarapiPairKey(site, id, "images");
}

function thecarapiUsageKey(month: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  return `vin_scan/thecarapi/_usage_${month}`;
}

function thecarapiVinTtlMs(parse: VinScanParse): number {
  return parse.status === "none" ? THECARAPI_VIN_NONE_CACHE_TTL_MS : THECARAPI_VIN_CACHE_TTL_MS;
}

export function asThecarapiVinCache(raw: unknown, nowMs = Date.now(), allowExpired = false): ThecarapiVinCache | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const vin = typeof o.vin === "string" ? o.vin : "";
  const cachedAt = typeof o.cachedAt === "string" ? o.cachedAt : "";
  if (!vin || !cachedAt || !o.parse || typeof o.parse !== "object") return null;
  const parse = o.parse as VinScanParse;
  if (parse.status !== "found" && parse.status !== "none") return null;
  const t = Date.parse(cachedAt);
  if (!Number.isFinite(t)) return null;
  if (!allowExpired && nowMs - t >= thecarapiVinTtlMs(parse)) return null;
  const httpStatus = typeof o.httpStatus === "number" && Number.isFinite(o.httpStatus) ? o.httpStatus : undefined;
  const etag = typeof o.etag === "string" && o.etag.trim() ? o.etag : undefined;
  const refs = Array.isArray(o.refs)
    ? o.refs
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const rec = item as { site?: unknown; id?: unknown; active?: unknown; detailPath?: unknown };
          const site = typeof rec.site === "string" ? rec.site : "";
          const id = typeof rec.id === "string" ? rec.id : "";
          if (!site || !id) return null;
          const detailPath =
            typeof rec.detailPath === "string" && thecarapiDetailPathAllowed(rec.detailPath) ? rec.detailPath : "";
          return { site, id, active: rec.active === true, ...(detailPath ? { detailPath } : {}) };
        })
        .filter((item): item is ThecarapiVinCacheRef => Boolean(item))
    : undefined;
  return {
    vin,
    cachedAt,
    parse,
    ...(httpStatus != null ? { httpStatus } : {}),
    ...(etag ? { etag } : {}),
    ...(refs && refs.length ? { refs } : {}),
    ...(Array.isArray(o.records) ? { records: normalizeThecarapiAdminRecords(o.records) } : {}),
    ...(o.recordsComplete === true ? { recordsComplete: true } : {}),
  };
}

export async function readThecarapiVinCache(vin: string, nowMs = Date.now()): Promise<ThecarapiVinCache | null> {
  const key = thecarapiVinKey(vin);
  if (!key) return null;
  return asThecarapiVinCache(await readJson(key), nowMs, false);
}

export async function readThecarapiVinCacheRaw(vin: string): Promise<ThecarapiVinCache | null> {
  const key = thecarapiVinKey(vin);
  if (!key) return null;
  return asThecarapiVinCache(await readJson(key), Date.now(), true);
}

export async function writeThecarapiVinCache(
  vin: string,
  parse: VinScanParse,
  extra?: {
    httpStatus?: number;
    cachedAt?: string;
    etag?: string;
    refs?: ThecarapiVinCacheRef[];
    records?: ThecarapiAdminRecord[];
    recordsComplete?: boolean;
  },
): Promise<void> {
  const key = thecarapiVinKey(vin);
  if (!key) return;
  if (parse.status !== "found" && parse.status !== "none") return;
  const body: ThecarapiVinCache = {
    vin: vin.trim().toUpperCase(),
    cachedAt: extra?.cachedAt ?? new Date().toISOString(),
    parse,
    ...(extra?.httpStatus != null ? { httpStatus: extra.httpStatus } : {}),
    ...(extra?.etag ? { etag: extra.etag } : {}),
    ...(extra?.refs?.length ? { refs: extra.refs } : {}),
    ...(extra?.records?.length ? { records: extra.records } : {}),
    ...(extra?.recordsComplete ? { recordsComplete: true } : {}),
  };
  await writeJson(key, body);
}

export async function readThecarapiImageCache(site: string, id: string, nowMs = Date.now()): Promise<ThecarapiDetailCache | null> {
  const key = thecarapiImageStorageKey(site, id);
  if (!key) return null;
  return asThecarapiDetailCache(await readJson(key), nowMs, false);
}

export async function readThecarapiImageCacheRaw(site: string, id: string): Promise<ThecarapiDetailCache | null> {
  const key = thecarapiImageStorageKey(site, id);
  if (!key) return null;
  return asThecarapiDetailCache(await readJson(key), Date.now(), true);
}

export async function writeThecarapiImageCache(entry: ThecarapiDetailCache): Promise<void> {
  const key = thecarapiImageStorageKey(entry.site, entry.id);
  if (!key) return;
  await writeJson(key, entry);
}

function detailTtlMs(active: boolean): number {
  return active ? THECARAPI_DETAIL_ACTIVE_CACHE_TTL_MS : THECARAPI_DETAIL_CACHE_TTL_MS;
}

export function asThecarapiDetailCache(raw: unknown, nowMs = Date.now(), allowExpired = false): ThecarapiDetailCache | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const site = typeof o.site === "string" ? o.site : "";
  const id = typeof o.id === "string" ? o.id : "";
  const cachedAt = typeof o.cachedAt === "string" ? o.cachedAt : "";
  if (!site || !id || !cachedAt || !("json" in o)) return null;
  const t = Date.parse(cachedAt);
  if (!Number.isFinite(t)) return null;
  const active = o.active === true;
  if (!allowExpired && nowMs - t >= detailTtlMs(active)) return null;
  const etag = typeof o.etag === "string" && o.etag.trim() ? o.etag : undefined;
  return { site, id, cachedAt, active, json: o.json, ...(etag ? { etag } : {}) };
}

export async function readThecarapiDetailCache(site: string, id: string, nowMs = Date.now()): Promise<ThecarapiDetailCache | null> {
  const key = thecarapiDetailStorageKey(site, id);
  if (!key) return null;
  return asThecarapiDetailCache(await readJson(key), nowMs, false);
}

export async function readThecarapiDetailCacheRaw(site: string, id: string): Promise<ThecarapiDetailCache | null> {
  const key = thecarapiDetailStorageKey(site, id);
  if (!key) return null;
  return asThecarapiDetailCache(await readJson(key), Date.now(), true);
}

export async function writeThecarapiDetailCache(entry: ThecarapiDetailCache): Promise<void> {
  const key = thecarapiDetailStorageKey(entry.site, entry.id);
  if (!key) return;
  await writeJson(key, entry);
}

export async function readThecarapiMonthlyUsage(month: string): Promise<number> {
  const key = thecarapiUsageKey(month);
  if (!key) return 0;
  const raw = await readJson(key);
  if (!raw || typeof raw !== "object") return 0;
  const count = (raw as { count?: unknown }).count;
  return typeof count === "number" && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export async function writeThecarapiMonthlyUsage(month: string, count: number): Promise<void> {
  const key = thecarapiUsageKey(month);
  if (!key) return;
  const body: ThecarapiUsage = { month, count: Math.max(0, Math.floor(count)) };
  await writeJson(key, body);
}

/** Pasūtījumi, kuros TheCarApi bildes vēl gaida avotu (cron atkārtojumiem; neliels indekss). */
export type ThecarapiPhotoWaitEntry = { sessionId: string; vin: string; nextAt: string; updatedAt: string };

const THECARAPI_PHOTO_WAIT_KEY = "vin_scan/thecarapi/_photo_wait";
export const THECARAPI_PHOTO_WAIT_INDEX_MAX = 200;

export function asThecarapiPhotoWaitIndex(raw: unknown): ThecarapiPhotoWaitEntry[] {
  const list = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { entries?: unknown }).entries : null;
  if (!Array.isArray(list)) return [];
  const out: ThecarapiPhotoWaitEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const sessionId = typeof rec.sessionId === "string" ? rec.sessionId : "";
    const vin = typeof rec.vin === "string" ? snapshotKey(rec.vin) : "";
    const nextAt = typeof rec.nextAt === "string" && Number.isFinite(Date.parse(rec.nextAt)) ? rec.nextAt : "";
    if (!/^[A-Za-z0-9_]{1,200}$/.test(sessionId) || vin.length < 11 || !nextAt) continue;
    const updatedAt = typeof rec.updatedAt === "string" ? rec.updatedAt.slice(0, 40) : "";
    out.push({ sessionId, vin, nextAt, updatedAt });
  }
  return out.slice(-THECARAPI_PHOTO_WAIT_INDEX_MAX);
}

export async function readThecarapiPhotoWaitIndex(): Promise<ThecarapiPhotoWaitEntry[]> {
  return asThecarapiPhotoWaitIndex(await readJson(THECARAPI_PHOTO_WAIT_KEY));
}

export async function writeThecarapiPhotoWaitIndex(entries: readonly ThecarapiPhotoWaitEntry[]): Promise<void> {
  await writeJson(THECARAPI_PHOTO_WAIT_KEY, { entries: entries.slice(-THECARAPI_PHOTO_WAIT_INDEX_MAX) });
}
