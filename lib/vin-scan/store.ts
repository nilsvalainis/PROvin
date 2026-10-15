/**
 * VIN SCAN persistents: Blob vai lokāls `.data/vin-scans`. Kešs pēc VIN, TTL 12 h.
 */
import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { get, put } from "@vercel/blob";

import { VIN_SCAN_TTL_MS } from "@/lib/vin-scan/catalog";
import { vinScanIndicatorsAreCacheable } from "@/lib/vin-scan/health";
import type { JojNameDict } from "@/lib/vin-scan/joj-labels";
import { emptyVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
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

async function writeJson(key: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value);
  const blob = resolveBlob();
  if (blob) {
    try {
      await put(`${blob.prefix}${key}.json`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    } catch {
      /* failsistēma */
    }
  }
  const dir = resolveDir();
  if (dir) {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${key}.json`), body, "utf8");
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

export function vinScanSnapshotFresh(snapshot: VinScanSnapshot, ttlMs = VIN_SCAN_TTL_MS): boolean {
  const t = Date.parse(snapshot.scannedAt);
  if (!Number.isFinite(t)) return false;
  if (Date.now() - t >= ttlMs) return false;
  return vinScanIndicatorsAreCacheable(snapshot.indicators);
}

export async function readVinScanSnapshot(vin: string): Promise<VinScanSnapshot | null> {
  const key = snapshotKey(vin);
  if (key.length < 11) return null;
  return asSnapshot(await readJson(key));
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
