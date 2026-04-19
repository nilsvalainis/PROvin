import "server-only";

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

/** Vercel/AWS u.c. — `/var/task` parasti nav rakstāms; `/tmp` ir. */
function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

function resolveDir(): string | null {
  const raw = process.env.ADMIN_IRISS_PASUTIJUMI_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), "provin-iriss-pasutijumi");
  }
  return path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
}

export function getIrissPasutijumiStorageDir(): string | null {
  return resolveDir();
}

export function isIrissPasutijumiStoreEnabled(): boolean {
  return resolveDir() !== null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSafeIrissPasutijumsId(id: string): boolean {
  return typeof id === "string" && id.length <= 64 && UUID_RE.test(id);
}

function filePath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
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

export async function listIrissPasutijumi(): Promise<IrissPasutijumsListRow[]> {
  const dir = resolveDir();
  if (!dir) return [];
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
  const dir = resolveDir();
  if (!dir || !isSafeIrissPasutijumsId(id)) return null;
  try {
    const raw = JSON.parse(await fs.readFile(filePath(dir, id), "utf8")) as unknown;
    return normalizeRecord(raw, id);
  } catch {
    return null;
  }
}

export async function writeIrissPasutijums(record: IrissPasutijumsRecord): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const dir = resolveDir();
    if (!dir) return { ok: false, error: "store_disabled" };
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
    await fs.mkdir(dir, { recursive: true });
    const fp = filePath(dir, out.id);
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
  const dir = resolveDir();
  if (!dir) return { ok: false, error: "store_disabled" };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const rec = emptyIrissPasutijums(id, now);
  const w = await writeIrissPasutijums(rec);
  if (!w.ok) return { ok: false, error: w.error };
  return { ok: true, id };
}
