import "server-only";

import fs from "fs/promises";
import path from "path";
import { del, get, list, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import {
  emptyArchiveCounts,
  parseAuctionIngestState,
  recentVinBrowse,
  summarizeVinMemory,
  type AuctionIngestState,
  type VinMemoryArchiveCounts,
  type VinMemoryBrowseRow,
} from "@/lib/vin-memory-auction";
import { parseVinMemoryTable, VIN_MEMORY_SOURCES, type VinMemoryEntry, type VinMemorySource } from "@/lib/vin-memory";

/**
 * VIN atmiņas masveida kursors un arhīva skaitītāji.
 * Tas pats Blob/FS prefikss, kas pasūtījumu melnrakstiem: `vin_memory/_*.json`.
 * WMI šķembas (`AAA.json`) šie faili nepārklāj.
 */

const CURSOR_REL = "vin_memory/_auction_ingest.json";
const COUNTS_REL = "vin_memory/_archive_counts.json";
const COUNTS_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const WMI_FILE_RE = /(?:^|\/)([A-HJ-NPR-Z0-9]{3})\.json$/;

export type StoredArchiveCounts = VinMemoryArchiveCounts & {
  countedAt: string;
  shards: number;
  partial: boolean;
  recent: VinMemoryBrowseRow[];
};

function durable(): boolean {
  if (getOrderDraftBlobConfig()) return true;
  return Boolean(getOrderDraftStorageDir()) && process.env.VERCEL !== "1";
}

async function readText(rel: string): Promise<string | null> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return await new Response(res.stream).text();
    } catch {
      /* nav vēl */
    }
    if (process.env.VERCEL === "1") return null;
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      return await fs.readFile(path.join(dir, rel), "utf8");
    } catch {
      /* nav vēl */
    }
  }
  return null;
}

async function writeText(rel: string, payload: string): Promise<boolean> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${rel}`, payload, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return true;
    } catch {
      if (process.env.VERCEL === "1") return false;
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      const fp = path.join(dir, rel);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(`${fp}.tmp`, payload, "utf8");
      await fs.rename(`${fp}.tmp`, fp);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function auctionIngestStoreDurable(): boolean {
  return durable();
}

export async function readAuctionIngestState(): Promise<AuctionIngestState | null> {
  const text = await readText(CURSOR_REL);
  if (!text) return null;
  try {
    return parseAuctionIngestState(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function writeAuctionIngestState(state: AuctionIngestState): Promise<boolean> {
  return writeText(CURSOR_REL, JSON.stringify(state));
}

function parseCounts(raw: unknown): StoredArchiveCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<StoredArchiveCounts>;
  if (typeof r.countedAt !== "string" || typeof r.vins !== "number" || typeof r.observations !== "number" || !r.bySource) return null;
  const base = emptyArchiveCounts();
  for (const source of Object.keys(base.bySource) as Array<keyof typeof base.bySource>) {
    const row = r.bySource[source];
    if (!row || typeof row !== "object") continue;
    const vins = (row as { vins?: unknown }).vins;
    const observations = (row as { observations?: unknown }).observations;
    if (typeof vins === "number") base.bySource[source].vins = vins;
    if (typeof observations === "number") base.bySource[source].observations = observations;
  }
  if (!Array.isArray(r.recent)) return null;
  const recent: VinMemoryBrowseRow[] = [];
  for (const row of r.recent) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<VinMemoryBrowseRow>;
    if (typeof item.vin !== "string" || typeof item.updatedAt !== "string") continue;
    recent.push({
      vin: item.vin,
      updatedAt: item.updatedAt,
      model: typeof item.model === "string" ? item.model : "",
      km: typeof item.km === "number" ? item.km : null,
      date: typeof item.date === "string" ? item.date : "",
      firstRegistration: typeof item.firstRegistration === "string" ? item.firstRegistration : "",
      sources: Array.isArray(item.sources)
        ? item.sources.filter((s): s is VinMemorySource => typeof s === "string" && (VIN_MEMORY_SOURCES as readonly string[]).includes(s))
        : [],
      observations: typeof item.observations === "number" ? item.observations : 0,
    });
  }
  return {
    ...base,
    countedAt: r.countedAt,
    shards: typeof r.shards === "number" ? r.shards : 0,
    partial: r.partial === true,
    recent,
  };
}

async function readShardEntries(pathname: string, token: string | null): Promise<VinMemoryEntry[]> {
  try {
    if (token) {
      const res = await get(pathname, { access: "private", token, useCache: false });
      if (!res?.stream) return [];
      return Object.values(parseVinMemoryTable(JSON.parse(await new Response(res.stream).text())));
    }
    return Object.values(parseVinMemoryTable(JSON.parse(await fs.readFile(pathname, "utf8"))));
  } catch {
    return [];
  }
}

async function scanShardEntries(): Promise<{ entries: VinMemoryEntry[]; shards: number }> {
  const entries: VinMemoryEntry[] = [];
  let shards = 0;
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    let cursor: string | undefined;
    do {
      const page = await list({ token: blob.token, prefix: `${blob.prefix}vin_memory/`, cursor, limit: 1000 });
      for (const b of page.blobs) {
        if (!WMI_FILE_RE.test(b.pathname)) continue;
        shards += 1;
        entries.push(...(await readShardEntries(b.pathname, blob.token)));
      }
      cursor = page.cursor;
    } while (cursor);
    return { entries, shards };
  }
  const dir = getOrderDraftStorageDir();
  if (!dir || process.env.VERCEL === "1") return { entries, shards };
  let names: string[] = [];
  try {
    names = await fs.readdir(path.join(dir, "vin_memory"));
  } catch {
    return { entries, shards };
  }
  for (const name of names) {
    if (!WMI_FILE_RE.test(name)) continue;
    shards += 1;
    entries.push(...(await readShardEntries(path.join(dir, "vin_memory", name), null)));
  }
  return { entries, shards };
}

/** Skaitītāji no WMI šķembām. Kešs 6 h, lai admin lapa neizlasa visu arhīvu katrā atvēršanā. */
export async function readVinMemoryArchiveCounts(opts: { refresh?: boolean; now?: Date } = {}): Promise<StoredArchiveCounts | null> {
  if (!durable()) return null;
  const now = opts.now ?? new Date();
  if (!opts.refresh) {
    const cachedText = await readText(COUNTS_REL);
    if (cachedText) {
      try {
        const cached = parseCounts(JSON.parse(cachedText));
        if (cached && now.getTime() - Date.parse(cached.countedAt) < COUNTS_MAX_AGE_MS) return cached;
      } catch {
        /* pārrēķina */
      }
    }
  }
  const scanned = await scanShardEntries();
  const counts = summarizeVinMemory(scanned.entries);
  const stored: StoredArchiveCounts = {
    ...counts,
    countedAt: now.toISOString(),
    shards: scanned.shards,
    partial: false,
    recent: recentVinBrowse(scanned.entries),
  };
  await writeText(COUNTS_REL, JSON.stringify(stored));
  return stored;
}

async function deleteRel(rel: string): Promise<boolean> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await del(`${blob.prefix}${rel}`, { token: blob.token });
      return true;
    } catch {
      if (process.env.VERCEL === "1") return false;
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      await fs.unlink(path.join(dir, rel));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return true;
      return false;
    }
  }
  return false;
}

/** Dzēš masveida kursoru un skaitītāju kešu. VIN šķembas paliek. */
export async function deleteAuctionIngestLedger(): Promise<{ ok: boolean; cursor: boolean; counts: boolean }> {
  const cursor = await deleteRel(CURSOR_REL);
  const counts = await deleteRel(COUNTS_REL);
  return { ok: cursor && counts, cursor, counts };
}

/** Pēc VIN dzēšanas skaitītāju kešs vairs nav derīgs. */
export async function forgetArchiveCountsCache(): Promise<boolean> {
  return deleteRel(COUNTS_REL);
}
