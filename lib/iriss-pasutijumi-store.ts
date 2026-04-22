import "server-only";

import { BlobNotFoundError, del, get, list, put } from "@vercel/blob";
import fs from "fs/promises";
import os from "node:os";
import path from "path";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";
import {
  emptyIrissPasutijums,
  IRISS_MAX_OFFER_ATTACHMENTS,
  type IrissOfferAttachment,
  type IrissOfferRecord,
  type IrissPasutijumiListOrder,
  type IrissPasutijumsListRow,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";

const DEFAULT_RELATIVE_DIR = ".data/iriss-pasutijumi";
const BLOB_PREFIX = "iriss-pasutijumi/";
/** Globāls pasūtījumu saraksta kārtība (nav UUID — atsevišķs JSON). */
const LIST_ORDER_FILENAME = "_list-order.json";
const BACKUP_RELATIVE_DIR = ".data/iriss-pasutijumi-backups";
const BACKUP_BLOB_PREFIX = "iriss-pasutijumi-backups/";
const BACKUP_KEEP_COUNT = 10;

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

function listOrderBlobPathname(prefix: string): string {
  return `${prefix}${LIST_ORDER_FILENAME}`;
}

function listOrderFsPath(dir: string): string {
  return path.join(dir, LIST_ORDER_FILENAME);
}

function backupFsPath(dir: string, id: string, ts: string): string {
  return path.join(dir, `${id}__${ts}.json`);
}

function backupBlobPathname(prefix: string, id: string, ts: string): string {
  return `${prefix}${id}__${ts}.json`;
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

async function trimFsBackups(dir: string, id: string): Promise<void> {
  try {
    const names = await fs.readdir(dir);
    const own = names
      .filter((n) => n.startsWith(`${id}__`) && n.endsWith(".json"))
      .sort()
      .reverse();
    const stale = own.slice(BACKUP_KEEP_COUNT);
    await Promise.all(stale.map((name) => fs.unlink(path.join(dir, name)).catch(() => undefined)));
  } catch {
    /* ignore backup trimming errors */
  }
}

async function trimBlobBackups(token: string, prefix: string, id: string): Promise<void> {
  try {
    const page = await list({ token, prefix: `${prefix}${id}__`, limit: 1000, mode: "expanded" });
    const own = page.blobs
      .filter((b) => b.pathname.endsWith(".json"))
      .map((b) => b.pathname)
      .sort()
      .reverse();
    const stale = own.slice(BACKUP_KEEP_COUNT);
    await Promise.all(stale.map((pathname) => del(pathname, { token }).catch(() => undefined)));
  } catch {
    /* ignore backup trimming errors */
  }
}

function normalizeOtherLinks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [""];
  const mapped = raw
    .map((x) => sanitizeDraftTextForStorage(typeof x === "string" ? x : "", 2048))
    .slice(0, 20);
  return mapped.length > 0 ? mapped : [""];
}

function normalizeOfferAttachments(raw: unknown): IrissOfferAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const id = sanitizeDraftTextForStorage(typeof o.id === "string" ? o.id : "", 64);
      const name = sanitizeDraftTextForStorage(typeof o.name === "string" ? o.name : "", 160);
      const mimeType = sanitizeDraftTextForStorage(typeof o.mimeType === "string" ? o.mimeType : "", 120);
      const dataUrl = sanitizeDraftTextForStorage(typeof o.dataUrl === "string" ? o.dataUrl : "", 15_000_000);
      const sizeRaw = typeof o.size === "number" ? o.size : Number.parseInt(String(o.size ?? "0"), 10);
      const size = Number.isFinite(sizeRaw) ? Math.max(0, Math.min(sizeRaw, 10_000_000)) : 0;
      if (!id || !name || !dataUrl) return null;
      return { id, name, mimeType, size, dataUrl };
    })
    .filter((x): x is IrissOfferAttachment => x !== null)
    .slice(0, IRISS_MAX_OFFER_ATTACHMENTS);
}

function normalizeOffers(raw: unknown): IrissOfferRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const id = sanitizeDraftTextForStorage(typeof o.id === "string" ? o.id : "", 64);
      if (!id) return null;
      const title = sanitizeDraftTextForStorage(typeof o.title === "string" ? o.title : `Piedāvājums ${idx + 1}`, 80);
      const createdAt = sanitizeDraftTextForStorage(typeof o.createdAt === "string" ? o.createdAt : "", 64);
      const updatedAt = sanitizeDraftTextForStorage(typeof o.updatedAt === "string" ? o.updatedAt : "", 64);
      return {
        id,
        title: title || `Piedāvājums ${idx + 1}`,
        brandModel: sanitizeDraftTextForStorage(typeof o.brandModel === "string" ? o.brandModel : "", 320),
        year: sanitizeDraftTextForStorage(typeof o.year === "string" ? o.year : "", 64),
        mileage: sanitizeDraftTextForStorage(typeof o.mileage === "string" ? o.mileage : "", 120),
        priceGermany: sanitizeDraftTextForStorage(typeof o.priceGermany === "string" ? o.priceGermany : "", 120),
        comment: sanitizeDraftTextForStorage(typeof o.comment === "string" ? o.comment : ""),
        firstRegistration: sanitizeDraftTextForStorage(typeof o.firstRegistration === "string" ? o.firstRegistration : "", 120),
        odometerReading: sanitizeDraftTextForStorage(typeof o.odometerReading === "string" ? o.odometerReading : "", 120),
        transmission: sanitizeDraftTextForStorage(typeof o.transmission === "string" ? o.transmission : "", 120),
        location: sanitizeDraftTextForStorage(typeof o.location === "string" ? o.location : "", 240),
        hasFullServiceHistory: Boolean(o.hasFullServiceHistory),
        hasFactoryPaint: Boolean(o.hasFactoryPaint),
        hasNoRustBody: Boolean(o.hasNoRustBody),
        hasSecondWheelSet: Boolean(o.hasSecondWheelSet),
        specialNotes: sanitizeDraftTextForStorage(typeof o.specialNotes === "string" ? o.specialNotes : "", 8_000),
        visualAssessment: sanitizeDraftTextForStorage(typeof o.visualAssessment === "string" ? o.visualAssessment : "", 8_000),
        technicalAssessment: sanitizeDraftTextForStorage(typeof o.technicalAssessment === "string" ? o.technicalAssessment : "", 8_000),
        summary: sanitizeDraftTextForStorage(typeof o.summary === "string" ? o.summary : "", 8_000),
        carPrice: sanitizeDraftTextForStorage(typeof o.carPrice === "string" ? o.carPrice : "", 120),
        deliveryPrice: sanitizeDraftTextForStorage(typeof o.deliveryPrice === "string" ? o.deliveryPrice : "", 120),
        commissionFee: sanitizeDraftTextForStorage(typeof o.commissionFee === "string" ? o.commissionFee : "", 120),
        offerValidDays: sanitizeDraftTextForStorage(typeof o.offerValidDays === "string" ? o.offerValidDays : "", 40),
        attachments: normalizeOfferAttachments(o.attachments),
        createdAt,
        updatedAt,
      };
    })
    .filter((x): x is IrissOfferRecord => x !== null)
    .slice(0, 30);
}

function normalizeRecord(raw: unknown, id: string): IrissPasutijumsRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = deepSanitizeDraftStrings(raw) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const bool = (k: string) => Boolean(o[k]);
  if (str("id") !== id) return null;
  const base = emptyIrissPasutijums(id, new Date().toISOString());
  return {
    ...base,
    id,
    createdAt: str("createdAt") || base.createdAt,
    updatedAt: str("updatedAt") || base.updatedAt,
    pinnedAt: sanitizeDraftTextForStorage(str("pinnedAt"), 64),
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
    dealLeasingOrCredit: bool("dealLeasingOrCredit"),
    dealClientFinancing100: bool("dealClientFinancing100"),
    dealClientFinancing20: bool("dealClientFinancing20"),
    dealVat21Required: bool("dealVat21Required"),
    dealServiceStartDeposit: bool("dealServiceStartDeposit"),
    dealEkki: bool("dealEkki"),
    equipmentRequired: sanitizeDraftTextForStorage(str("equipmentRequired")),
    equipmentDesired: sanitizeDraftTextForStorage(str("equipmentDesired")),
    notes: sanitizeDraftTextForStorage(str("notes")),
    listingLinkMobile: sanitizeDraftTextForStorage(str("listingLinkMobile"), 2048),
    listingLinkAutobid: sanitizeDraftTextForStorage(str("listingLinkAutobid"), 2048),
    listingLinkOpenline: sanitizeDraftTextForStorage(str("listingLinkOpenline"), 2048),
    listingLinkAuto1: sanitizeDraftTextForStorage(str("listingLinkAuto1"), 2048),
    listingLinksOther: normalizeOtherLinks(o.listingLinksOther),
    offers: normalizeOffers(o.offers),
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
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        pinnedAt: rec.pinnedAt,
        brandModel: rec.brandModel.trim() || "—",
        totalBudget: rec.totalBudget.trim() || "—",
        phone: rec.phone.trim() || "—",
        listingLinkMobile: rec.listingLinkMobile,
        listingLinkAutobid: rec.listingLinkAutobid,
        listingLinkOpenline: rec.listingLinkOpenline,
        listingLinkAuto1: rec.listingLinkAuto1,
        listingLinksOther: rec.listingLinksOther,
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
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      pinnedAt: rec.pinnedAt,
      brandModel: rec.brandModel.trim() || "—",
      totalBudget: rec.totalBudget.trim() || "—",
      phone: rec.phone.trim() || "—",
      listingLinkMobile: rec.listingLinkMobile,
      listingLinkAutobid: rec.listingLinkAutobid,
      listingLinkOpenline: rec.listingLinkOpenline,
      listingLinkAuto1: rec.listingLinkAuto1,
      listingLinksOther: rec.listingLinksOther,
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
    const backupTs = updatedAt.replace(/[:.]/g, "-");

    if (r.kind === "blob") {
      const pathname = blobPathname(r.prefix, out.id);
      const serialized = JSON.stringify(out, null, 2);
      if (existing) {
        const backupPath = backupBlobPathname(BACKUP_BLOB_PREFIX, out.id, backupTs);
        await put(backupPath, JSON.stringify(existing, null, 2), {
          access: "private",
          token: r.token,
          contentType: "application/json; charset=utf-8",
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        await trimBlobBackups(r.token, BACKUP_BLOB_PREFIX, out.id);
      }
      await put(pathname, serialized, {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { ok: true };
    }

    await fs.mkdir(r.dir, { recursive: true });
    if (existing) {
      const backupDir = path.join(process.cwd(), BACKUP_RELATIVE_DIR);
      await fs.mkdir(backupDir, { recursive: true });
      await fs.writeFile(backupFsPath(backupDir, out.id, backupTs), JSON.stringify(existing, null, 2), "utf8");
      await trimFsBackups(backupDir, out.id);
    }
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

function normalizeListOrderIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") continue;
    if (!isSafeIrissPasutijumsId(x)) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function parseListOrder(raw: unknown): IrissPasutijumiListOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    pinnedOrder: normalizeListOrderIdList(o.pinnedOrder),
    unpinnedOrder: normalizeListOrderIdList(o.unpinnedOrder),
  };
}

export async function readIrissListOrder(): Promise<IrissPasutijumiListOrder | null> {
  const r = resolveStorage();
  if (r.kind === "disabled") return null;
  if (r.kind === "blob") {
    const raw = await readJsonFromBlob(listOrderBlobPathname(r.prefix), r.token);
    return parseListOrder(raw);
  }
  try {
    const txt = await fs.readFile(listOrderFsPath(r.dir), "utf8");
    return parseListOrder(JSON.parse(txt) as unknown);
  } catch {
    return null;
  }
}

export async function writeIrissListOrder(
  order: IrissPasutijumiListOrder,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = resolveStorage();
    if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
    const pinnedOrder = normalizeListOrderIdList(order.pinnedOrder);
    const unpinnedOrder = normalizeListOrderIdList(order.unpinnedOrder);
    const body = JSON.stringify({ version: 1, pinnedOrder, unpinnedOrder }, null, 2);
    if (r.kind === "blob") {
      await put(listOrderBlobPathname(r.prefix), body, {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { ok: true };
    }
    await fs.mkdir(r.dir, { recursive: true });
    const fp = listOrderFsPath(r.dir);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, body, "utf8");
    await fs.rename(tmp, fp);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function deleteIrissPasutijums(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = resolveStorage();
    if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
    if (!isSafeIrissPasutijumsId(id)) return { ok: false, error: "invalid_id" };

    if (r.kind === "blob") {
      try {
        await del(blobPathname(r.prefix, id), { token: r.token });
      } catch (e) {
        if (e instanceof BlobNotFoundError) return { ok: true };
        throw e;
      }
      return { ok: true };
    }

    try {
      await fs.unlink(filePath(r.dir, id));
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
      if (code !== "ENOENT") throw e;
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
