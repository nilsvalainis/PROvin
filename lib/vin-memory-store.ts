import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import {
  mergeObservations,
  normalizeVin,
  parseVinMemoryTable,
  serializeVinMemoryTable,
  type VinMemoryEntry,
  type VinMemoryTable,
  type VinObservationInput,
} from "@/lib/vin-memory";

/**
 * VIN atmiņas krātuve: tas pats Blob/FS, kas pasūtījumu melnrakstiem (nav jaunu atslēgu).
 * Ceļš `{prefix}vin_memory/<WMI>.json` - viens fails uz ražotāja kodu, lai masveidā faili paliek mazi
 * (10 000 VIN ar 3 novērojumiem ir ap 5 MB kopā, pa WMI - simtos KB).
 */

const SUBDIR = "vin_memory";
const WMI_RE = /^[A-HJ-NPR-Z0-9]{3}$/;

function relPath(wmi: string): string {
  if (!WMI_RE.test(wmi)) throw new Error("invalid_wmi");
  return `${SUBDIR}/${wmi}.json`;
}

export function isVinMemoryStoreDurable(): boolean {
  if (getOrderDraftBlobConfig()) return true;
  return Boolean(getOrderDraftStorageDir()) && process.env.VERCEL !== "1";
}

async function readShard(wmi: string): Promise<VinMemoryTable> {
  const rel = relPath(wmi);
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return parseVinMemoryTable(JSON.parse(await new Response(res.stream).text()));
    } catch {
      /* nav vēl */
    }
    if (process.env.VERCEL === "1") return {};
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      return parseVinMemoryTable(JSON.parse(await fs.readFile(path.join(dir, rel), "utf8")));
    } catch {
      /* nav vēl */
    }
  }
  return {};
}

async function writeShard(wmi: string, table: VinMemoryTable): Promise<boolean> {
  const rel = relPath(wmi);
  const payload = serializeVinMemoryTable(table);
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

export async function readVinMemory(vinRaw: string): Promise<VinMemoryEntry | null> {
  const vin = normalizeVin(vinRaw);
  if (!WMI_RE.test(vin.slice(0, 3))) return null;
  const shard = await readShard(vin.slice(0, 3));
  return shard[vin] ?? null;
}

export type VinMemoryWriteResult = { ok: boolean; added: number; updated: number; shards: number; failedShards: string[] };

/** Pievieno novērojumus: grupē pa WMI, lasa un raksta katru failu vienu reizi. */
export async function addVinObservations(inputs: VinObservationInput[], now: Date = new Date()): Promise<VinMemoryWriteResult> {
  const byWmi = new Map<string, VinObservationInput[]>();
  for (const input of inputs) {
    const wmi = normalizeVin(input.vin).slice(0, 3);
    if (!WMI_RE.test(wmi)) continue;
    const list = byWmi.get(wmi) ?? [];
    list.push(input);
    byWmi.set(wmi, list);
  }
  let added = 0;
  let updated = 0;
  const failedShards: string[] = [];
  for (const [wmi, list] of byWmi) {
    const prev = await readShard(wmi);
    const merged = mergeObservations(prev, list, now);
    if (!merged.added && !merged.updated) continue;
    const ok = await writeShard(wmi, merged.table);
    if (!ok) {
      failedShards.push(wmi);
      continue;
    }
    added += merged.added;
    updated += merged.updated;
  }
  return { ok: failedShards.length === 0, added, updated, shards: byWmi.size, failedShards };
}
