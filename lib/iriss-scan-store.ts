import "server-only";

import fs from "fs/promises";
import path from "path";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";
import { emptyIrissScanRecord, type IrissScanListOrder, type IrissScanListRow, type IrissScanRecord } from "@/lib/iriss-scan-types";

const DEFAULT_RELATIVE_DIR = ".data/iriss-scan";
const LIST_ORDER_FILENAME = "_list-order.json";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveDir(): string | null {
  const raw = process.env.ADMIN_IRISS_SCAN_DIR?.trim() ?? "";
  if (["0", "false", "no", "off", "disabled"].includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  return path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
}

function filePath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

function listOrderPath(dir: string): string {
  return path.join(dir, LIST_ORDER_FILENAME);
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

export function isIrissScanStoreEnabled(): boolean {
  return Boolean(resolveDir());
}

export function isSafeIrissScanId(id: string): boolean {
  return typeof id === "string" && id.length <= 64 && UUID_RE.test(id);
}

export async function listIrissScan(): Promise<IrissScanListRow[]> {
  const dir = resolveDir();
  if (!dir) return [];
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
  const dir = resolveDir();
  if (!dir || !isSafeIrissScanId(id)) return null;
  try {
    const raw = JSON.parse(await fs.readFile(filePath(dir, id), "utf8")) as unknown;
    return normalizeRecord(raw, id);
  } catch {
    return null;
  }
}

export async function writeIrissScan(record: IrissScanRecord): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = resolveDir();
  if (!dir) return { ok: false, error: "store_disabled" };
  if (!isSafeIrissScanId(record.id)) return { ok: false, error: "invalid_id" };
  const normalized = normalizeRecord(record, record.id);
  if (!normalized) return { ok: false, error: "invalid_record" };
  const existing = await readIrissScan(record.id);
  const out: IrissScanRecord = {
    ...normalized,
    createdAt: existing?.createdAt ?? normalized.createdAt,
    updatedAt: new Date().toISOString(),
  };
  try {
    await fs.mkdir(dir, { recursive: true });
    const fp = filePath(dir, out.id);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(out, null, 2), "utf8");
    await fs.rename(tmp, fp);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createIrissScan(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const dir = resolveDir();
  if (!dir) return { ok: false, error: "store_disabled" };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const rec = emptyIrissScanRecord(id, now);
  const w = await writeIrissScan(rec);
  if (!w.ok) return { ok: false, error: w.error };
  return { ok: true, id };
}

export async function deleteIrissScan(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = resolveDir();
  if (!dir) return { ok: false, error: "store_disabled" };
  if (!isSafeIrissScanId(id)) return { ok: false, error: "invalid_id" };
  try {
    await fs.unlink(filePath(dir, id)).catch(() => undefined);
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
  const dir = resolveDir();
  if (!dir) return null;
  try {
    const raw = JSON.parse(await fs.readFile(listOrderPath(dir), "utf8")) as Record<string, unknown>;
    return {
      pinnedOrder: normalizeListOrderIds(raw.pinnedOrder),
      unpinnedOrder: normalizeListOrderIds(raw.unpinnedOrder),
    };
  } catch {
    return null;
  }
}

export async function writeIrissScanListOrder(order: IrissScanListOrder): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = resolveDir();
  if (!dir) return { ok: false, error: "store_disabled" };
  const body = JSON.stringify(
    {
      version: 1,
      pinnedOrder: normalizeListOrderIds(order.pinnedOrder),
      unpinnedOrder: normalizeListOrderIds(order.unpinnedOrder),
    },
    null,
    2,
  );
  try {
    await fs.mkdir(dir, { recursive: true });
    const fp = listOrderPath(dir);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, body, "utf8");
    await fs.rename(tmp, fp);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
