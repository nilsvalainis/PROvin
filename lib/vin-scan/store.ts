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
import { emptyVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

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
