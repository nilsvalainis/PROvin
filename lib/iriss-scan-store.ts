import "server-only";

import { BlobNotFoundError, del, get, list, put } from "@vercel/blob";
import fs from "fs/promises";
import os from "node:os";
import path from "path";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";
import { emptyIrissScanRecord, type IrissScanListOrder, type IrissScanListRow, type IrissScanRecord } from "@/lib/iriss-scan-types";

const DEFAULT_RELATIVE_DIR = ".data/iriss-scan";
const BLOB_PREFIX = "iriss-scan/";
const LIST_ORDER_FILENAME = "_list-order.json";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** AWS/Netlify u.c. — `/var/task` parasti nav rakstāms; `/tmp` ir (tikai ne-Vercel serverless). */
function isNonVercelServerlessRuntime(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

const VERCEL_FS_FORCE = ["1", "true", "yes", "on"].includes(
  (process.env.ADMIN_IRISS_SCAN_VERCEL_FS ?? "").trim().toLowerCase(),
);

/**
 * Vercel serverless: `process.cwd()/.data` bieži nav rakstāms.
 * Lokālais absolūtais ceļš no `.env.local` deploy vidē tiek ignorēts, lai izvēlētos Blob (kā IRISS pasūtījumi).
 * Opt-in: `ADMIN_IRISS_SCAN_VERCEL_FS=1`.
 */
function isFsPathAllowedOnVercel(resolvedDir: string): boolean {
  if (!process.env.VERCEL) return true;
  if (VERCEL_FS_FORCE) return true;
  const tmpRoot = path.resolve(os.tmpdir());
  const dir = path.resolve(resolvedDir);
  return dir === tmpRoot || dir.startsWith(`${tmpRoot}${path.sep}`);
}

type ResolvedStorage =
  | { kind: "disabled"; reason: "explicit_off" | "vercel_without_blob_token" }
  | { kind: "fs"; dir: string }
  | { kind: "blob"; token: string; prefix: string };

let resolvedMemo: ResolvedStorage | null = null;

function computeResolvedStorage(): ResolvedStorage {
  const raw = process.env.ADMIN_IRISS_SCAN_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) {
    return { kind: "disabled", reason: "explicit_off" };
  }
  if (raw) {
    const abs = path.resolve(raw);
    if (isFsPathAllowedOnVercel(abs)) {
      return { kind: "fs", dir: abs };
    }
  }
  if (process.env.VERCEL) {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) {
      return { kind: "disabled", reason: "vercel_without_blob_token" };
    }
    return { kind: "blob", token, prefix: BLOB_PREFIX };
  }
  if (isNonVercelServerlessRuntime()) {
    return { kind: "fs", dir: path.join(os.tmpdir(), "provin-iriss-scan") };
  }
  return { kind: "fs", dir: path.join(process.cwd(), DEFAULT_RELATIVE_DIR) };
}

function resolveStorage(): ResolvedStorage {
  if (!resolvedMemo) resolvedMemo = computeResolvedStorage();
  return resolvedMemo;
}

export type IrissScanStorageState =
  | { enabled: false; reason: "explicit_off" | "vercel_blob_token_missing" }
  | { enabled: true; persistence: "filesystem"; path: string }
  | { enabled: true; persistence: "vercel_blob" };

export function getIrissScanStorageState(): IrissScanStorageState {
  const r = resolveStorage();
  if (r.kind === "disabled") {
    return {
      enabled: false,
      reason: r.reason === "vercel_without_blob_token" ? "vercel_blob_token_missing" : "explicit_off",
    };
  }
  if (r.kind === "blob") {
    return { enabled: true, persistence: "vercel_blob" };
  }
  return { enabled: true, persistence: "filesystem", path: r.dir };
}

export function isIrissScanStoreEnabled(): boolean {
  return resolveStorage().kind !== "disabled";
}

function filePath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

function listOrderPath(dir: string): string {
  return path.join(dir, LIST_ORDER_FILENAME);
}

function blobRecordPathname(prefix: string, id: string): string {
  return `${prefix}${id}.json`;
}

function listOrderBlobPathname(prefix: string): string {
  return `${prefix}${LIST_ORDER_FILENAME}`;
}

async function streamToUtf8(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

async function readJsonFromBlob(pathname: string, token: string): Promise<unknown | null> {
  const res = await get(pathname, { access: "private", token, useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  try {
    return JSON.parse(await streamToUtf8(res.stream)) as unknown;
  } catch {
    return null;
  }
}

async function listBlobRecordIds(prefix: string, token: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token, cursor, limit: 1000, mode: "expanded" });
    for (const b of page.blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      if (!b.pathname.startsWith(prefix)) continue;
      const relative = b.pathname.slice(prefix.length);
      if (relative === LIST_ORDER_FILENAME) continue;
      if (!relative.endsWith(".json") || relative.includes("/")) continue;
      const id = relative.slice(0, -".json".length);
      if (isSafeIrissScanId(id)) ids.push(id);
    }
    if (page.hasMore && !page.cursor) break;
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  return ids;
}

function normalizeOtherLinks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [""];
  const out = raw.map((x) => sanitizeDraftTextForStorage(typeof x === "string" ? x : "", 2048)).slice(0, 20);
  return out.length > 0 ? out : [""];
}

function normalizeRecord(raw: unknown, id: string): IrissScanRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = deepSanitizeDraftStrings(raw) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  if (str("id") !== id) return null;
  const base = emptyIrissScanRecord(id, new Date().toISOString());
  return {
    ...base,
    id,
    createdAt: str("createdAt") || base.createdAt,
    updatedAt: str("updatedAt") || base.updatedAt,
    pinnedAt: sanitizeDraftTextForStorage(str("pinnedAt"), 64),
    brandModel: sanitizeDraftTextForStorage(str("brandModel"), 400),
    listingLinkMobile: sanitizeDraftTextForStorage(str("listingLinkMobile"), 2048),
    listingLinkAutobid: sanitizeDraftTextForStorage(str("listingLinkAutobid"), 2048),
    listingLinkOpenline: sanitizeDraftTextForStorage(str("listingLinkOpenline"), 2048),
    listingLinkAuto1: sanitizeDraftTextForStorage(str("listingLinkAuto1"), 2048),
    listingLinksOther: normalizeOtherLinks(o.listingLinksOther),
  };
}

export function isSafeIrissScanId(id: string): boolean {
  return typeof id === "string" && id.length <= 64 && UUID_RE.test(id);
}

export async function listIrissScan(): Promise<IrissScanListRow[]> {
  const r = resolveStorage();
  if (r.kind === "disabled") return [];

  if (r.kind === "blob") {
    try {
      const ids = await listBlobRecordIds(r.prefix, r.token);
      const rows: IrissScanListRow[] = [];
      for (const id of ids) {
        const rec = await readIrissScan(id);
        if (rec) rows.push(rec);
      }
      rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
      return rows;
    } catch {
      return [];
    }
  }

  const dir = r.dir;
  try {
    const names = await fs.readdir(dir);
    const rows: IrissScanListRow[] = [];
    for (const name of names) {
      if (!name.endsWith(".json") || name === LIST_ORDER_FILENAME) continue;
      const id = name.slice(0, -5);
      if (!isSafeIrissScanId(id)) continue;
      const rec = await readIrissScan(id);
      if (rec) rows.push(rec);
    }
    rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return rows;
  } catch {
    return [];
  }
}

export async function readIrissScan(id: string): Promise<IrissScanRecord | null> {
  const r = resolveStorage();
  if (r.kind === "disabled" || !isSafeIrissScanId(id)) return null;

  if (r.kind === "blob") {
    const raw = await readJsonFromBlob(blobRecordPathname(r.prefix, id), r.token);
    return normalizeRecord(raw, id);
  }

  try {
    const raw = JSON.parse(await fs.readFile(filePath(r.dir, id), "utf8")) as unknown;
    return normalizeRecord(raw, id);
  } catch {
    return null;
  }
}

export async function writeIrissScan(record: IrissScanRecord): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  if (!isSafeIrissScanId(record.id)) return { ok: false, error: "invalid_id" };
  const normalized = normalizeRecord(record, record.id);
  if (!normalized) return { ok: false, error: "invalid_record" };
  const existing = await readIrissScan(record.id);
  const out: IrissScanRecord = {
    ...normalized,
    createdAt: existing?.createdAt ?? normalized.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (r.kind === "blob") {
    try {
      await put(blobRecordPathname(r.prefix, out.id), JSON.stringify(out, null, 2), {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  try {
    await fs.mkdir(r.dir, { recursive: true });
    const fp = filePath(r.dir, out.id);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(out, null, 2), "utf8");
    await fs.rename(tmp, fp);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createIrissScan(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const rec = emptyIrissScanRecord(id, now);
  const w = await writeIrissScan(rec);
  if (!w.ok) return { ok: false, error: w.error };
  return { ok: true, id };
}

export async function deleteIrissScan(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  if (!isSafeIrissScanId(id)) return { ok: false, error: "invalid_id" };

  if (r.kind === "blob") {
    try {
      await del(blobRecordPathname(r.prefix, id), { token: r.token });
    } catch (e) {
      if (!(e instanceof BlobNotFoundError)) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
    return { ok: true };
  }

  try {
    await fs.unlink(filePath(r.dir, id)).catch(() => undefined);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function normalizeListOrderIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string" || !isSafeIrissScanId(x) || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

export async function readIrissScanListOrder(): Promise<IrissScanListOrder | null> {
  const r = resolveStorage();
  if (r.kind === "disabled") return null;

  if (r.kind === "blob") {
    const raw = await readJsonFromBlob(listOrderBlobPathname(r.prefix), r.token);
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    return {
      pinnedOrder: normalizeListOrderIds(o.pinnedOrder),
      unpinnedOrder: normalizeListOrderIds(o.unpinnedOrder),
    };
  }

  try {
    const raw = JSON.parse(await fs.readFile(listOrderPath(r.dir), "utf8")) as Record<string, unknown>;
    return {
      pinnedOrder: normalizeListOrderIds(raw.pinnedOrder),
      unpinnedOrder: normalizeListOrderIds(raw.unpinnedOrder),
    };
  } catch {
    return null;
  }
}

export async function writeIrissScanListOrder(order: IrissScanListOrder): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  const body = JSON.stringify(
    {
      version: 1,
      pinnedOrder: normalizeListOrderIds(order.pinnedOrder),
      unpinnedOrder: normalizeListOrderIds(order.unpinnedOrder),
    },
    null,
    2,
  );

  if (r.kind === "blob") {
    try {
      await put(listOrderBlobPathname(r.prefix), body, {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  try {
    await fs.mkdir(r.dir, { recursive: true });
    const fp = listOrderPath(r.dir);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, body, "utf8");
    await fs.rename(tmp, fp);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
