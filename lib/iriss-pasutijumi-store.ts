import "server-only";

import { get, list, put } from "@vercel/blob";
import fs from "fs/promises";
import os from "node:os";
import path from "path";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";
import {
  emptyIrissPasutijums,
  type IrissPasutijumsListRow,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";

const DEFAULT_RELATIVE_DIR = ".data/iriss-pasutijumi";
const BLOB_PREFIX = "iriss-pasutijumi/";

/** AWS/Netlify u.c. — `/var/task` parasti nav rakstāms; `/tmp` ir (tikai ne-Vercel serverless). */
function isNonVercelServerlessRuntime(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

type ResolvedStorage =
  | { kind: "disabled"; reason: "explicit_off" | "vercel_without_blob_token" }
  | { kind: "fs"; dir: string }
  | { kind: "blob"; token: string; prefix: string };

let resolvedMemo: ResolvedStorage | null = null;

function computeResolvedStorage(): ResolvedStorage {
  const raw = process.env.ADMIN_IRISS_PASUTIJUMI_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) {
    return { kind: "disabled", reason: "explicit_off" };
  }
  if (raw) {
    return { kind: "fs", dir: path.resolve(raw) };
  }
  if (process.env.VERCEL) {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) {
      return { kind: "disabled", reason: "vercel_without_blob_token" };
    }
    return { kind: "blob", token, prefix: BLOB_PREFIX };
  }
  if (isNonVercelServerlessRuntime()) {
    return { kind: "fs", dir: path.join(os.tmpdir(), "provin-iriss-pasutijumi") };
  }
  return { kind: "fs", dir: path.join(process.cwd(), DEFAULT_RELATIVE_DIR) };
}

function resolveStorage(): ResolvedStorage {
  if (!resolvedMemo) resolvedMemo = computeResolvedStorage();
  return resolvedMemo;
}

export type IrissPasutijumiStorageState =
  | { enabled: false; reason: "explicit_off" | "vercel_blob_token_missing" }
  | { enabled: true; persistence: "filesystem"; path: string }
  | { enabled: true; persistence: "vercel_blob" };

export function getIrissPasutijumiStorageState(): IrissPasutijumiStorageState {
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

export function getIrissPasutijumiStorageDir(): string | null {
  const r = resolveStorage();
  return r.kind === "fs" ? r.dir : null;
}

export function isIrissPasutijumiStoreEnabled(): boolean {
  return resolveStorage().kind !== "disabled";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSafeIrissPasutijumsId(id: string): boolean {
  return typeof id === "string" && id.length <= 64 && UUID_RE.test(id);
}

function filePath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

function blobPathname(prefix: string, id: string): string {
  return `${prefix}${id}.json`;
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

function normalizeRecord(raw: unknown, id: string): IrissPasutijumsRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = deepSanitizeDraftStrings(raw) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  if (str("id") !== id) return null;
  const base = emptyIrissPasutijums(id, new Date().toISOString());
  return {
    ...base,
    id,
    createdAt: str("createdAt") || base.createdAt,
    updatedAt: str("updatedAt") || base.updatedAt,
    clientFirstName: sanitizeDraftTextForStorage(str("clientFirstName"), 120),
    clientLastName: sanitizeDraftTextForStorage(str("clientLastName"), 120),
    phone: sanitizeDraftTextForStorage(str("phone"), 64),
    email: sanitizeDraftTextForStorage(str("email"), 320),
    orderDate: sanitizeDraftTextForStorage(str("orderDate"), 32),
    brandModel: sanitizeDraftTextForStorage(str("brandModel"), 400),
    productionYears: sanitizeDraftTextForStorage(str("productionYears"), 120),
    totalBudget: sanitizeDraftTextForStorage(str("totalBudget"), 120),
    engineType: sanitizeDraftTextForStorage(str("engineType"), 200),
    transmission: sanitizeDraftTextForStorage(str("transmission"), 120),
    maxMileage: sanitizeDraftTextForStorage(str("maxMileage"), 120),
    preferredColors: sanitizeDraftTextForStorage(str("preferredColors"), 400),
    nonPreferredColors: sanitizeDraftTextForStorage(str("nonPreferredColors"), 400),
    interiorFinish: sanitizeDraftTextForStorage(str("interiorFinish"), 400),
    equipmentRequired: sanitizeDraftTextForStorage(str("equipmentRequired")),
    equipmentDesired: sanitizeDraftTextForStorage(str("equipmentDesired")),
    notes: sanitizeDraftTextForStorage(str("notes")),
  };
}

async function listBlobIds(prefix: string, token: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token, cursor, limit: 1000, mode: "expanded" });
    for (const b of page.blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      if (!b.pathname.startsWith(prefix)) continue;
      const id = b.pathname.slice(prefix.length, -".json".length);
      if (isSafeIrissPasutijumsId(id)) ids.push(id);
    }
    if (page.hasMore && !page.cursor) break;
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  return ids;
}

export async function listIrissPasutijumi(): Promise<IrissPasutijumsListRow[]> {
  const r = resolveStorage();
  if (r.kind === "disabled") return [];

  if (r.kind === "blob") {
    const ids = await listBlobIds(r.prefix, r.token);
    const rows: IrissPasutijumsListRow[] = [];
    for (const id of ids) {
      const rec = await readIrissPasutijums(id);
      if (!rec) continue;
      rows.push({
        id: rec.id,
        updatedAt: rec.updatedAt,
        brandModel: rec.brandModel.trim() || "—",
        totalBudget: rec.totalBudget.trim() || "—",
        phone: rec.phone.trim() || "—",
      });
    }
    rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return rows;
  }

  const dir = r.dir;
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const rows: IrissPasutijumsListRow[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -5);
    if (!isSafeIrissPasutijumsId(id)) continue;
    const rec = await readIrissPasutijums(id);
    if (!rec) continue;
    rows.push({
      id: rec.id,
      updatedAt: rec.updatedAt,
      brandModel: rec.brandModel.trim() || "—",
      totalBudget: rec.totalBudget.trim() || "—",
      phone: rec.phone.trim() || "—",
    });
  }
  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return rows;
}

export async function readIrissPasutijums(id: string): Promise<IrissPasutijumsRecord | null> {
  const r = resolveStorage();
  if (r.kind === "disabled" || !isSafeIrissPasutijumsId(id)) return null;

  if (r.kind === "blob") {
    const raw = await readJsonFromBlob(blobPathname(r.prefix, id), r.token);
    return normalizeRecord(raw, id);
  }

  try {
    const raw = JSON.parse(await fs.readFile(filePath(r.dir, id), "utf8")) as unknown;
    return normalizeRecord(raw, id);
  } catch {
    return null;
  }
}

export async function writeIrissPasutijums(record: IrissPasutijumsRecord): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = resolveStorage();
    if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
    if (!isSafeIrissPasutijumsId(record.id)) return { ok: false, error: "invalid_id" };
    const sanitized = normalizeRecord(record, record.id);
    if (!sanitized) return { ok: false, error: "invalid_record" };
    const updatedAt = new Date().toISOString();
    const existing = await readIrissPasutijums(record.id);
    const createdAt = existing?.createdAt ?? sanitized.createdAt ?? updatedAt;
    const out: IrissPasutijumsRecord = {
      ...sanitized,
      updatedAt,
      createdAt,
    };

    if (r.kind === "blob") {
      const pathname = blobPathname(r.prefix, out.id);
      const body = JSON.stringify(out, null, 2);
      await put(pathname, body, {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { ok: true };
    }

    await fs.mkdir(r.dir, { recursive: true });
    const fp = filePath(r.dir, out.id);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(out, null, 2), "utf8");
    await fs.rename(tmp, fp);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function createIrissPasutijums(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const rec = emptyIrissPasutijums(id, now);
  const w = await writeIrissPasutijums(rec);
  if (!w.ok) return { ok: false, error: w.error };
  return { ok: true, id };
}
