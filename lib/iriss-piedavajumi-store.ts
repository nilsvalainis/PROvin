import "server-only";

/**
 * j70: Piedāvājumu krātuve. Tā pati IRISS JSON krātuve kā pasūtījumiem (Vercel Blob vai lokāla mape):
 *   piedavajumi/<id>.json        pilns ieraksts
 *   piedavajumi/_index.json      saraksta rindas (bez N lasījumiem)
 *   piedavajumi/tokens/<hash>.json   publiskās saites hash -> id
 *   piedavajumi/decisions/<id>.json  klienta lēmums (pirmais uzvar visās instancēs)
 * Migrācija nav vajadzīga: jauni faili, vecie dati netiek aiztikti.
 */

import { createHash, randomBytes } from "node:crypto";
import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  getIrissPasutijumiBlobConfig,
  getIrissPasutijumiStorageDir,
  isIrissPasutijumiStoreEnabled,
} from "@/lib/iriss-pasutijumi-store";
import {
  applyIrissPdExpiry,
  irissPdRowEffectiveStatus,
  irissPdToListRow,
  normalizeIrissPdListRow,
  normalizeIrissPiedavajums,
} from "@/lib/iriss-piedavajumi";
import { isSafeIrissPdId, isSafeIrissPdToken, type IrissPdListRow, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const DIR = "piedavajumi/";
const INDEX_REL = `${DIR}_index.json`;

const writeLocks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  writeLocks.set(key, next);
  void next.finally(() => {
    if (writeLocks.get(key) === next) writeLocks.delete(key);
  });
  return next;
}

export function isIrissPdStoreEnabled(): boolean {
  return isIrissPasutijumiStoreEnabled();
}

async function readJson(rel: string): Promise<unknown | null> {
  const blob = getIrissPasutijumiBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return JSON.parse(await new Response(res.stream).text()) as unknown;
    } catch {
      return null;
    }
    return null;
  }
  const dir = getIrissPasutijumiStorageDir();
  if (!dir) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(dir, rel), "utf8")) as unknown;
  } catch {
    return null;
  }
}

async function writeJson(rel: string, doc: unknown, opts: { once?: boolean } = {}): Promise<"ok" | "exists" | "failed"> {
  if (!isIrissPasutijumiStoreEnabled()) return "failed";
  const raw = JSON.stringify(doc);
  const blob = getIrissPasutijumiBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${rel}`, raw, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: !opts.once,
        contentType: "application/json",
      });
      return "ok";
    } catch {
      if (opts.once && (await readJson(rel)) != null) return "exists";
      return "failed";
    }
  }
  const dir = getIrissPasutijumiStorageDir();
  if (!dir) return "failed";
  const dest = path.join(dir, rel);
  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if (opts.once) {
      await fs.writeFile(dest, raw, { encoding: "utf8", flag: "wx" });
      return "ok";
    }
    const tmp = `${dest}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await fs.writeFile(tmp, raw, "utf8");
    await fs.rename(tmp, dest);
    return "ok";
  } catch {
    if (opts.once && (await readJson(rel)) != null) return "exists";
    return "failed";
  }
}

function recordRel(id: string): string {
  return `${DIR}${id}.json`;
}

export function hashIrissPdToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function newIrissPdToken(): string {
  return randomBytes(18).toString("base64url");
}

async function readIndex(): Promise<IrissPdListRow[]> {
  const raw = await readJson(INDEX_REL);
  const rows = raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown }).rows) ? (raw as { rows: unknown[] }).rows : [];
  return rows.map(normalizeIrissPdListRow).filter((r): r is IrissPdListRow => Boolean(r));
}

export async function listIrissPdRows(): Promise<IrissPdListRow[]> {
  if (!isIrissPdStoreEnabled()) return [];
  return readIndex();
}

export async function readIrissPd(id: string): Promise<IrissPiedavajums | null> {
  if (!isSafeIrissPdId(id) || !isIrissPdStoreEnabled()) return null;
  return normalizeIrissPiedavajums(await readJson(recordRel(id)));
}

/** Ieraksts + indeksa rinda (vienā slēdzenē, lai paralēlas saglabāšanas nepazaudē rindas). */
export async function writeIrissPd(rec: IrissPiedavajums): Promise<boolean> {
  if (!isSafeIrissPdId(rec.id)) return false;
  return withLock("index", async () => {
    if ((await writeJson(recordRel(rec.id), rec)) !== "ok") return false;
    const rows = await readIndex();
    const row = irissPdToListRow(rec);
    const i = rows.findIndex((r) => r.id === rec.id);
    if (i >= 0) rows[i] = row;
    else rows.push(row);
    if (rec.linkToken) {
      await writeJson(`${DIR}tokens/${hashIrissPdToken(rec.linkToken)}.json`, { id: rec.id }, { once: true });
    }
    return (await writeJson(INDEX_REL, { rows })) === "ok";
  });
}

/** Jauns ieraksts ar nākamo numuru (PD-0001...). `build` saņem numuru. */
export async function createIrissPd(
  build: (number: number) => IrissPiedavajums,
): Promise<{ ok: true; record: IrissPiedavajums } | { ok: false; error: string }> {
  if (!isIrissPdStoreEnabled()) return { ok: false, error: "store_disabled" };
  const number = await withLock("number", async () => {
    const rows = await readIndex();
    return rows.reduce((m, r) => Math.max(m, r.number), 0) + 1;
  });
  const rec = build(number);
  const ok = await writeIrissPd(rec);
  return ok ? { ok: true, record: rec } : { ok: false, error: "write_failed" };
}

export async function readIrissPdByToken(token: string): Promise<IrissPiedavajums | null> {
  if (!isSafeIrissPdToken(token) || !isIrissPdStoreEnabled()) return null;
  const raw = await readJson(`${DIR}tokens/${hashIrissPdToken(token)}.json`);
  const id = raw && typeof raw === "object" ? (raw as { id?: unknown }).id : null;
  if (!isSafeIrissPdId(id)) return null;
  const rec = await readIrissPd(id);
  // Tokens jāsakrīt ar pašreizējo (ja kādreiz tiktu nomainīts, vecā saite vairs nedarbojas).
  return rec && rec.linkToken === token ? rec : null;
}

export type IrissPdClaimedDecision = { decision: "approve"; decidedAt: string; contactName: string; contactPhone: string };

/** Pirmais apstiprinājums uzvar (Blob allowOverwrite: false / lokāli "wx"). */
export async function claimIrissPdDecision(
  id: string,
  doc: IrissPdClaimedDecision,
): Promise<{ won: boolean } | null> {
  if (!isSafeIrissPdId(id)) return null;
  const res = await writeJson(`${DIR}decisions/${id}.json`, doc, { once: true });
  if (res === "ok") return { won: true };
  if (res === "exists") return { won: false };
  return null;
}

/**
 * Automātiska «Beidzies termiņš» pāreja: pārraksta tikai tos ierakstus, kam termiņš jau pagājis.
 * Sauc saraksta ielādē (lēti - pārbauda indeksu, lasa tikai mainītos).
 */
export async function refreshIrissPdExpiries(nowMs: number): Promise<number> {
  const rows = await listIrissPdRows();
  let changed = 0;
  for (const row of rows) {
    if (irissPdRowEffectiveStatus(row, nowMs) !== "expired" || row.status === "expired") continue;
    const rec = await readIrissPd(row.id);
    const next = rec ? applyIrissPdExpiry(rec, nowMs) : null;
    if (next && (await writeIrissPd(next))) changed += 1;
  }
  return changed;
}

/** Viena ieraksta lasīšana ar termiņa pārbaudi (detaļa, publiskā saite). */
export async function readIrissPdFresh(id: string, nowMs: number): Promise<IrissPiedavajums | null> {
  const rec = await readIrissPd(id);
  if (!rec) return null;
  const next = applyIrissPdExpiry(rec, nowMs);
  if (!next) return rec;
  await writeIrissPd(next);
  return next;
}

/** Piedāvājumi, kas piesaistīti šim pasūtījumam (klients vai izveidotais pasūtījums). */
export async function listIrissPdRowsForOrder(orderId: string): Promise<IrissPdListRow[]> {
  if (!isSafeIrissPdId(orderId)) return [];
  const rows = await listIrissPdRows();
  return rows.filter((r) => r.clientOrderId === orderId || r.approvedOrderId === orderId);
}
