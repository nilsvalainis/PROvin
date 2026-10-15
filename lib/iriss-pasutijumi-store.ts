import "server-only";

import { del, get, list, put } from "@vercel/blob";
import fs from "fs/promises";
import os from "node:os";
import path from "path";
import { deepSanitizeDraftStrings, sanitizeDraftTextForStorage } from "@/lib/admin-draft-sanitize";
import { formatIrissOrderPowerKwLabel } from "@/lib/engine-power-kw";
import { parseIrissPasutijumsListingLinks } from "@/lib/iriss-listing-link-lists";
import { parseIrissListingOrderOv, type IrissListingOrderOv } from "@/lib/iriss-listing-order-ov";
import { attachmentAfterBlobPut, parseDataUrlPayload } from "@/lib/iriss-offer-attachment-blob";
import { withAutoEcarstradeLinks } from "@/lib/iriss-pasutijumi-ecarstrade-links";
import {
  isIrissRecordDeleted,
  markIrissRecordDeleted,
  pickIrissPasutijumsAuditFields,
  restoreIrissRecord,
} from "@/lib/iriss-pasutijumi-audit-fields";
import { irissPasutijumsToListRow } from "@/lib/iriss-pasutijumi-list-row";
import {
  irissRevisionMatches,
  irissWorkspaceRevision,
  IRISS_STALE_REVISION,
  nextIrissWorkspaceRevision,
  parseExpectedIrissRevision,
} from "@/lib/iriss-pasutijumi-save-safety";
import {
  emptyIrissPasutijums,
  IRISS_MAX_OFFER_ATTACHMENTS,
  normalizeIrissDzintarzemeTameDraft,
  parseIrissPasutijumsListStatus,
  type IrissOfferAttachment,
  type IrissOfferRecord,
  type IrissPasutijumiListOrder,
  type IrissPasutijumsListRow,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";

const DEFAULT_RELATIVE_DIR = ".data/iriss-pasutijumi";
const BLOB_PREFIX = "iriss-pasutijumi/";
/** Globāls pasūtījumu saraksta kārtība (nav UUID — atsevišķs JSON). */
const LIST_ORDER_FILENAME = "_list-order.json";
/** Listes vieglais indekss (bez pilnā record/offer payload). */
const LIST_ROWS_FILENAME = "_list-rows.json";
const LISTING_ORDER_OV_FILENAME = "_listing-order-ov.json";
const BACKUP_RELATIVE_DIR = ".data/iriss-pasutijumi-backups";
const LOCAL_MIRROR_RELATIVE_DIR = ".data/iriss-pasutijumi-local-mirror";
const LOCAL_MIRROR_BUNDLE_FILENAME = "_all-orders.json";
const BACKUP_BLOB_PREFIX = "iriss-pasutijumi-backups/";
const BACKUP_KEEP_COUNT = 10;
const BLOB_LIST_CACHE_TTL_MS = Math.max(
  0,
  Number.parseInt(process.env.IRISS_PASUTIJUMI_BLOB_LIST_CACHE_TTL_MS ?? "600000", 10) || 600_000,
);
const BLOB_RECORD_CACHE_TTL_MS = Math.max(
  0,
  Number.parseInt(process.env.IRISS_PASUTIJUMI_BLOB_RECORD_CACHE_TTL_MS ?? "300000", 10) || 300_000,
);
const BLOB_BACKUP_TRIM_MIN_INTERVAL_MS = Math.max(
  0,
  Number.parseInt(process.env.IRISS_PASUTIJUMI_BLOB_BACKUP_TRIM_MIN_INTERVAL_MS ?? "600000", 10) || 600_000,
);
const BLOB_WRITE_BACKUPS_ENABLED = ["1", "true", "yes", "on"].includes(
  (process.env.IRISS_PASUTIJUMI_BLOB_WRITE_BACKUPS ?? "0").trim().toLowerCase(),
);

/** AWS/Netlify u.c. — `/var/task` parasti nav rakstāms; `/tmp` ir (tikai ne-Vercel serverless). */
function isNonVercelServerlessRuntime(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

type ResolvedStorage =
  | { kind: "disabled"; reason: "explicit_off" | "vercel_without_blob_token" }
  | { kind: "fs"; dir: string }
  | { kind: "blob"; token: string; prefix: string };

let resolvedMemo: ResolvedStorage | null = null;
let blobListRowsCache: { expiresAt: number; rows: IrissPasutijumsListRow[] } | null = null;
const blobRecordCache = new Map<string, { expiresAt: number; record: IrissPasutijumsRecord | null }>();
const blobBackupTrimAt = new Map<string, number>();

function cloneRecord(record: IrissPasutijumsRecord): IrissPasutijumsRecord {
  return JSON.parse(JSON.stringify(record)) as IrissPasutijumsRecord;
}

function cloneListingLinks(row: Pick<
  IrissPasutijumsListRow,
  | "listingLinkMobile"
  | "listingLinkAutobid"
  | "listingLinkOpenline"
  | "listingLinkAuto1"
  | "listingLinkEcarstrade"
  | "listingLinksOther"
>) {
  return parseIrissPasutijumsListingLinks(row);
}

function cloneRows(rows: IrissPasutijumsListRow[]): IrissPasutijumsListRow[] {
  return rows.map((row) => ({
    ...row,
    listStatus: row.listStatus ?? "active",
    ...cloneListingLinks(row),
  }));
}

function cacheBlobRecord(id: string, record: IrissPasutijumsRecord | null): void {
  const expiresAt = Date.now() + BLOB_RECORD_CACHE_TTL_MS;
  blobRecordCache.set(id, {
    expiresAt,
    record: record ? cloneRecord(record) : null,
  });
}

function invalidateBlobListCache(): void {
  blobListRowsCache = null;
}

function invalidateBlobRecordCache(id: string): void {
  blobRecordCache.delete(id);
}

function shouldTrimBlobBackups(id: string): boolean {
  if (BLOB_BACKUP_TRIM_MIN_INTERVAL_MS <= 0) return true;
  const now = Date.now();
  const prev = blobBackupTrimAt.get(id) ?? 0;
  if (now - prev < BLOB_BACKUP_TRIM_MIN_INTERVAL_MS) return false;
  blobBackupTrimAt.set(id, now);
  return true;
}

function isMeaningfullyChanged(existing: IrissPasutijumsRecord, next: IrissPasutijumsRecord): boolean {
  const candidate = { ...next, updatedAt: existing.updatedAt, createdAt: existing.createdAt };
  return JSON.stringify(existing) !== JSON.stringify(candidate);
}

const VERCEL_FS_FORCE = ["1", "true", "yes", "on"].includes(
  (process.env.ADMIN_IRISS_PASUTIJUMI_VERCEL_FS ?? "").trim().toLowerCase(),
);

/**
 * Vercel serverless: rakstāms ir tikai `/tmp` (vai līdzīgs `os.tmpdir()`).
 * Lokālais Mac/Dropbox ceļš `.env.local` vidē nedarbojas deploy — pretējā gadījumā
 * `ADMIN_IRISS_PASUTIJUMI_DIR` bloķē Blob izvēli un saraksts „neiet”.
 * Opt-in: `ADMIN_IRISS_PASUTIJUMI_VERCEL_FS=1`, ja tiešām montēts disks (reti).
 */
function isFsPathAllowedOnVercel(resolvedDir: string): boolean {
  if (!process.env.VERCEL) return true;
  if (VERCEL_FS_FORCE) return true;
  const tmpRoot = path.resolve(os.tmpdir());
  const dir = path.resolve(resolvedDir);
  return dir === tmpRoot || dir.startsWith(`${tmpRoot}${path.sep}`);
}

function computeResolvedStorage(): ResolvedStorage {
  const raw = process.env.ADMIN_IRISS_PASUTIJUMI_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) {
    return { kind: "disabled", reason: "explicit_off" };
  }
  if (raw) {
    const abs = path.resolve(raw);
    if (isFsPathAllowedOnVercel(abs)) {
      return { kind: "fs", dir: abs };
    }
    /* Vercel: ignorē lokālo / projekta FS ceļu → turpinām ar Blob vai disabled. */
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

/** Privātais Blob, kad IRISS pasūtījumi jau glabājas Blob. FS režīmā null. */
export function getIrissPasutijumiBlobConfig(): { token: string; prefix: string } | null {
  const r = resolveStorage();
  if (r.kind !== "blob") return null;
  return { token: r.token, prefix: r.prefix };
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

function listRowsBlobPathname(prefix: string): string {
  return `${prefix}${LIST_ROWS_FILENAME}`;
}

function listOrderFsPath(dir: string): string {
  return path.join(dir, LIST_ORDER_FILENAME);
}

function listRowsFsPath(dir: string): string {
  return path.join(dir, LIST_ROWS_FILENAME);
}

function backupFsPath(dir: string, id: string, ts: string): string {
  return path.join(dir, `${id}__${ts}.json`);
}

function localMirrorFsPath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

function backupBlobPathname(prefix: string, id: string, ts: string): string {
  return `${prefix}${id}__${ts}.json`;
}

/**
 * Lokāla drošības kopija projekta mapē (piem. Dropbox), neatkarīgi no primārās glabātuves.
 * Nestrādā serverless runtime vidēs bez rakstāmas FS.
 */
async function writeLocalMirrorSnapshot(record: IrissPasutijumsRecord): Promise<void> {
  if (process.env.VERCEL || isNonVercelServerlessRuntime()) return;
  const raw = process.env.IRISS_PASUTIJUMI_LOCAL_MIRROR_DIR?.trim();
  const off = ["0", "false", "no", "off", "disabled"];
  if (raw && off.includes(raw.toLowerCase())) return;
  const dir = raw ? path.resolve(raw) : path.join(process.cwd(), LOCAL_MIRROR_RELATIVE_DIR);
  await fs.mkdir(dir, { recursive: true });
  const fp = localMirrorFsPath(dir, record.id);
  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
  await fs.rename(tmp, fp);
}

async function writeLocalMirrorFullBundle(): Promise<void> {
  if (process.env.VERCEL || isNonVercelServerlessRuntime()) return;
  const bundleEnabled = !["0", "false", "no", "off", "disabled"].includes(
    (process.env.IRISS_PASUTIJUMI_LOCAL_FULL_BUNDLE ?? "1").trim().toLowerCase(),
  );
  if (!bundleEnabled) return;

  const raw = process.env.IRISS_PASUTIJUMI_LOCAL_MIRROR_DIR?.trim();
  const off = ["0", "false", "no", "off", "disabled"];
  if (raw && off.includes(raw.toLowerCase())) return;
  const dir = raw ? path.resolve(raw) : path.join(process.cwd(), LOCAL_MIRROR_RELATIVE_DIR);
  await fs.mkdir(dir, { recursive: true });

  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }

  const records: IrissPasutijumsRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    if (name.startsWith("_")) continue;
    const id = name.slice(0, -".json".length);
    if (!isSafeIrissPasutijumsId(id)) continue;
    try {
      const rawJson = JSON.parse(await fs.readFile(path.join(dir, name), "utf8")) as unknown;
      const rec = normalizeRecord(rawJson, id);
      if (rec) records.push(rec);
    } catch {
      /* ignore broken single files in bundle generation */
    }
  }
  records.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));

  const bundle = {
    generatedAt: new Date().toISOString(),
    count: records.length,
    records,
  };
  const fp = path.join(dir, LOCAL_MIRROR_BUNDLE_FILENAME);
  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(bundle, null, 2), "utf8");
  await fs.rename(tmp, fp);
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

function sanitizeListingLinks(raw: unknown) {
  return parseIrissPasutijumsListingLinks(raw, (s) => sanitizeDraftTextForStorage(s, 2048));
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
      const blobPath = sanitizeDraftTextForStorage(typeof o.blobPath === "string" ? o.blobPath : "", 400);
      const blobUrl = sanitizeDraftTextForStorage(typeof o.blobUrl === "string" ? o.blobUrl : "", 800);
      const sizeRaw = typeof o.size === "number" ? o.size : Number.parseInt(String(o.size ?? "0"), 10);
      const size = Number.isFinite(sizeRaw) ? Math.max(0, Math.min(sizeRaw, 10_000_000)) : 0;
      if (!id || !name) return null;
      if (!dataUrl && !blobPath) return null;
      return {
        id,
        name,
        mimeType,
        size,
        dataUrl,
        ...(blobPath ? { blobPath } : {}),
        ...(blobUrl ? { blobUrl } : {}),
      };
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
        vin: sanitizeDraftTextForStorage(typeof o.vin === "string" ? o.vin : "", 32),
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

function normalizeListStatus(raw: unknown): IrissPasutijumsListStatus {
  return parseIrissPasutijumsListStatus(raw);
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
    workspaceRevision: irissWorkspaceRevision({
      workspaceRevision: parseExpectedIrissRevision(o.workspaceRevision) ?? 0,
    }),
    listStatus: normalizeListStatus(o.listStatus),
    clientFirstName: sanitizeDraftTextForStorage(str("clientFirstName"), 120),
    clientLastName: sanitizeDraftTextForStorage(str("clientLastName"), 120),
    phone: sanitizeDraftTextForStorage(str("phone"), 64),
    email: sanitizeDraftTextForStorage(str("email"), 320),
    orderDate: sanitizeDraftTextForStorage(str("orderDate"), 32),
    brandModel: sanitizeDraftTextForStorage(str("brandModel"), 400),
    vin: sanitizeDraftTextForStorage(str("vin"), 32),
    productionYears: sanitizeDraftTextForStorage(str("productionYears"), 120),
    totalBudget: sanitizeDraftTextForStorage(str("totalBudget"), 120),
    engineType: sanitizeDraftTextForStorage(str("engineType"), 200),
    transmission: sanitizeDraftTextForStorage(str("transmission"), 120),
    bodyType: sanitizeDraftTextForStorage(str("bodyType"), 120),
    driveType: sanitizeDraftTextForStorage(str("driveType"), 120),
    seatCount: sanitizeDraftTextForStorage(str("seatCount"), 40),
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
    ...sanitizeListingLinks(o),
    dzintarzemeTameDraft: normalizeIrissDzintarzemeTameDraft(o.dzintarzemeTameDraft),
    offers: normalizeOffers(o.offers),
    ...pickIrissPasutijumsAuditFields(o),
  };
}

function rowFromRecord(rec: IrissPasutijumsRecord): IrissPasutijumsListRow {
  return irissPasutijumsToListRow(rec);
}

function sortRowsByUpdatedDesc(rows: IrissPasutijumsListRow[]): IrissPasutijumsListRow[] {
  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return rows;
}

function parseListRows(raw: unknown): IrissPasutijumsListRow[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > 0) {
    const first = raw[0];
    if (!first || typeof first !== "object" || !("equipmentRequired" in first) || !("bodyType" in first)) return null;
  }
  const rows: IrissPasutijumsListRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    if (!isSafeIrissPasutijumsId(id)) continue;
    rows.push({
      id,
      createdAt: sanitizeDraftTextForStorage(typeof o.createdAt === "string" ? o.createdAt : "", 64),
      updatedAt: sanitizeDraftTextForStorage(typeof o.updatedAt === "string" ? o.updatedAt : "", 64),
      pinnedAt: sanitizeDraftTextForStorage(typeof o.pinnedAt === "string" ? o.pinnedAt : "", 64),
      listStatus: normalizeListStatus(o.listStatus),
      deletedAt: typeof o.deletedAt === "string" ? sanitizeDraftTextForStorage(o.deletedAt, 64) : "",
      clientFirstName: sanitizeDraftTextForStorage(typeof o.clientFirstName === "string" ? o.clientFirstName : "", 120),
      clientLastName: sanitizeDraftTextForStorage(typeof o.clientLastName === "string" ? o.clientLastName : "", 120),
      orderDate: sanitizeDraftTextForStorage(typeof o.orderDate === "string" ? o.orderDate : "", 32),
      brandModel: sanitizeDraftTextForStorage(typeof o.brandModel === "string" ? o.brandModel : "—", 400) || "—",
      vin: sanitizeDraftTextForStorage(typeof o.vin === "string" ? o.vin : "", 32),
      totalBudget: sanitizeDraftTextForStorage(typeof o.totalBudget === "string" ? o.totalBudget : "—", 120) || "—",
      phone: sanitizeDraftTextForStorage(typeof o.phone === "string" ? o.phone : "—", 64) || "—",
      productionYears: sanitizeDraftTextForStorage(typeof o.productionYears === "string" ? o.productionYears : "", 80),
      engineType: sanitizeDraftTextForStorage(typeof o.engineType === "string" ? o.engineType : "", 80),
      transmission: sanitizeDraftTextForStorage(typeof o.transmission === "string" ? o.transmission : "", 80),
      bodyType: sanitizeDraftTextForStorage(typeof o.bodyType === "string" ? o.bodyType : "", 80),
      driveType: sanitizeDraftTextForStorage(typeof o.driveType === "string" ? o.driveType : "", 80),
      seatCount: sanitizeDraftTextForStorage(typeof o.seatCount === "string" ? o.seatCount : "", 40),
      maxMileage: sanitizeDraftTextForStorage(typeof o.maxMileage === "string" ? o.maxMileage : "", 80),
      preferredColors: sanitizeDraftTextForStorage(typeof o.preferredColors === "string" ? o.preferredColors : "", 200),
      nonPreferredColors: sanitizeDraftTextForStorage(typeof o.nonPreferredColors === "string" ? o.nonPreferredColors : "", 200),
      interiorFinish: sanitizeDraftTextForStorage(typeof o.interiorFinish === "string" ? o.interiorFinish : "", 120),
      dealLeasingOrCredit: Boolean(o.dealLeasingOrCredit),
      dealClientFinancing100: Boolean(o.dealClientFinancing100),
      dealClientFinancing20: Boolean(o.dealClientFinancing20),
      dealVat21Required: Boolean(o.dealVat21Required),
      dealServiceStartDeposit: Boolean(o.dealServiceStartDeposit),
      dealEkki: Boolean(o.dealEkki),
      equipmentRequired: sanitizeDraftTextForStorage(typeof o.equipmentRequired === "string" ? o.equipmentRequired : "", 800),
      equipmentDesired: sanitizeDraftTextForStorage(typeof o.equipmentDesired === "string" ? o.equipmentDesired : "", 800),
      notes: sanitizeDraftTextForStorage(typeof o.notes === "string" ? o.notes : "", 4000),
      email: sanitizeDraftTextForStorage(typeof o.email === "string" ? o.email : "", 320),
      powerKwLabel: sanitizeDraftTextForStorage(
        typeof o.powerKwLabel === "string" && o.powerKwLabel.trim()
          ? o.powerKwLabel
          : formatIrissOrderPowerKwLabel({
              engineType: typeof o.engineType === "string" ? o.engineType : "",
              equipmentRequired: typeof o.equipmentRequired === "string" ? o.equipmentRequired : "",
              brandModel: typeof o.brandModel === "string" ? o.brandModel : "",
            }),
        24,
      ),
      ...sanitizeListingLinks(o),
    });
  }
  return rows;
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

async function rebuildListRowsFromRecords(r: Extract<ResolvedStorage, { kind: "blob" | "fs" }>): Promise<IrissPasutijumsListRow[]> {
  const rows: IrissPasutijumsListRow[] = [];
  if (r.kind === "blob") {
    const ids = await listBlobIds(r.prefix, r.token);
    for (const id of ids) {
      const rec = await readIrissPasutijums(id);
      if (rec) rows.push(rowFromRecord(rec));
    }
  } else {
    let names: string[] = [];
    try {
      names = await fs.readdir(r.dir);
    } catch {
      return [];
    }
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const id = name.slice(0, -5);
      if (!isSafeIrissPasutijumsId(id)) continue;
      const rec = await readIrissPasutijums(id);
      if (rec) rows.push(rowFromRecord(rec));
    }
  }
  return sortRowsByUpdatedDesc(rows);
}

async function readListRowsIndex(r: Extract<ResolvedStorage, { kind: "blob" | "fs" }>): Promise<IrissPasutijumsListRow[] | null> {
  if (r.kind === "blob") {
    const raw = await readJsonFromBlob(listRowsBlobPathname(r.prefix), r.token);
    const parsed = parseListRows(raw);
    if (!parsed) return null;
    return sortRowsByUpdatedDesc(parsed);
  }
  try {
    const txt = await fs.readFile(listRowsFsPath(r.dir), "utf8");
    const parsed = parseListRows(JSON.parse(txt) as unknown);
    if (!parsed) return null;
    return sortRowsByUpdatedDesc(parsed);
  } catch {
    return null;
  }
}

async function writeListRowsIndex(
  r: Extract<ResolvedStorage, { kind: "blob" | "fs" }>,
  rows: IrissPasutijumsListRow[],
): Promise<void> {
  const body = JSON.stringify(sortRowsByUpdatedDesc(cloneRows(rows)), null, 2);
  if (r.kind === "blob") {
    await put(listRowsBlobPathname(r.prefix), body, {
      access: "private",
      token: r.token,
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  await fs.mkdir(r.dir, { recursive: true });
  const fp = listRowsFsPath(r.dir);
  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, fp);
}

async function upsertListRowsIndex(
  r: Extract<ResolvedStorage, { kind: "blob" | "fs" }>,
  row: IrissPasutijumsListRow,
): Promise<void> {
  const existing = (await readListRowsIndex(r)) ?? [];
  const next = existing.filter((x) => x.id !== row.id);
  next.push(row);
  await writeListRowsIndex(r, next);
}

async function removeFromListRowsIndex(
  r: Extract<ResolvedStorage, { kind: "blob" | "fs" }>,
  id: string,
): Promise<void> {
  const existing = (await readListRowsIndex(r)) ?? [];
  const next = existing.filter((x) => x.id !== id);
  await writeListRowsIndex(r, next);
}

export async function listIrissPasutijumi(opts?: { includeDeleted?: boolean }): Promise<IrissPasutijumsListRow[]> {
  const r = resolveStorage();
  if (r.kind === "disabled") return [];

  if (BLOB_LIST_CACHE_TTL_MS > 0 && blobListRowsCache && blobListRowsCache.expiresAt > Date.now()) {
    const cached = cloneRows(blobListRowsCache.rows);
    return opts?.includeDeleted ? cached : cached.filter((row) => !isIrissRecordDeleted(row));
  }

  let rows = await readListRowsIndex(r);
  if (!rows) {
    rows = await rebuildListRowsFromRecords(r);
    try {
      await writeListRowsIndex(r, rows);
    } catch {
      /* index write is best-effort; list can still be served */
    }
  }

  if (BLOB_LIST_CACHE_TTL_MS > 0) {
    blobListRowsCache = {
      expiresAt: Date.now() + BLOB_LIST_CACHE_TTL_MS,
      rows: cloneRows(rows),
    };
  }
  const cloned = cloneRows(rows);
  return opts?.includeDeleted ? cloned : cloned.filter((row) => !isIrissRecordDeleted(row));
}

export async function readIrissPasutijums(id: string): Promise<IrissPasutijumsRecord | null> {
  const r = resolveStorage();
  if (r.kind === "disabled" || !isSafeIrissPasutijumsId(id)) return null;

  if (r.kind === "blob") {
    if (BLOB_RECORD_CACHE_TTL_MS > 0) {
      const cached = blobRecordCache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.record ? cloneRecord(cached.record) : null;
      }
    }
    const raw = await readJsonFromBlob(blobPathname(r.prefix, id), r.token);
    const normalized = normalizeRecord(raw, id);
    if (BLOB_RECORD_CACHE_TTL_MS > 0) {
      cacheBlobRecord(id, normalized);
    }
    return normalized ? cloneRecord(normalized) : null;
  }

  try {
    const raw = JSON.parse(await fs.readFile(filePath(r.dir, id), "utf8")) as unknown;
    return normalizeRecord(raw, id);
  } catch {
    return null;
  }
}

export type WriteIrissPasutijumsResult =
  | { ok: true; record: IrissPasutijumsRecord }
  | { ok: false; error: string; stale?: boolean; record?: IrissPasutijumsRecord };

async function persistOneOfferImage(
  r: Extract<ResolvedStorage, { kind: "blob" | "fs" }>,
  orderId: string,
  offerId: string,
  att: IrissOfferAttachment,
): Promise<IrissOfferAttachment> {
  if (att.blobPath && !att.dataUrl) return att;
  if (!att.dataUrl) return att;
  const parsed = parseDataUrlPayload(att.dataUrl);
  if (!parsed) return att;
  try {
    if (r.kind === "blob") {
      const pathname = `${r.prefix}offers/${orderId}/${offerId}/${att.id}`;
      const putRes = await put(pathname, parsed.bytes, {
        access: "private",
        token: r.token,
        contentType: parsed.mimeType || att.mimeType || "application/octet-stream",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return attachmentAfterBlobPut(att, pathname, putRes.url);
    }
    const relFs = `offers/${orderId}/${offerId}/${att.id}`;
    const dir = path.join(r.dir, "offers", orderId, offerId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(r.dir, relFs), parsed.bytes);
    return attachmentAfterBlobPut(att, relFs);
  } catch (e) {
    console.error("[iriss offer image] keep dataUrl, blob write failed", e);
    return att;
  }
}

async function persistOfferImages(
  r: Extract<ResolvedStorage, { kind: "blob" | "fs" }>,
  record: IrissPasutijumsRecord,
): Promise<IrissPasutijumsRecord> {
  const offers = [];
  for (const offer of record.offers) {
    const attachments = [];
    for (const att of offer.attachments) {
      attachments.push(await persistOneOfferImage(r, record.id, offer.id, att));
    }
    offers.push({ ...offer, attachments });
  }
  return { ...record, offers };
}

async function bytesToDataUrl(bytes: Buffer, mimeType: string): Promise<string> {
  return `data:${mimeType || "application/octet-stream"};base64,${bytes.toString("base64")}`;
}

async function hydrateOneOfferImage(
  r: Extract<ResolvedStorage, { kind: "blob" | "fs" }>,
  att: IrissOfferAttachment,
): Promise<IrissOfferAttachment> {
  if (att.dataUrl || !att.blobPath) return att;
  try {
    if (r.kind === "blob") {
      const res = await get(att.blobPath, { access: "private", token: r.token, useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) return att;
      const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
      return { ...att, dataUrl: await bytesToDataUrl(buf, att.mimeType) };
    }
    const fp = path.isAbsolute(att.blobPath) ? att.blobPath : path.join(r.dir, att.blobPath);
    const buf = await fs.readFile(fp);
    return { ...att, dataUrl: await bytesToDataUrl(buf, att.mimeType) };
  } catch (e) {
    console.error("[iriss offer image] hydrate failed, keep blobPath", e);
    return att;
  }
}

/** Viena piedāvājuma pielikuma baiti. Ceļš paliek serverī, klientam netiek atdots. */
export async function readIrissOfferAttachmentBytes(
  att: Pick<IrissOfferAttachment, "dataUrl" | "blobPath" | "mimeType">,
): Promise<{ mimeType: string; bytes: Buffer } | null> {
  const fromData = att.dataUrl ? parseDataUrlPayload(att.dataUrl) : null;
  if (fromData && fromData.bytes.length > 0) {
    return { mimeType: fromData.mimeType || att.mimeType || "application/octet-stream", bytes: fromData.bytes };
  }
  if (!att.blobPath || att.blobPath.includes("..")) return null;
  const r = resolveStorage();
  if (r.kind === "disabled") return null;
  try {
    if (r.kind === "blob") {
      const res = await get(att.blobPath, { access: "private", token: r.token, useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      const bytes = Buffer.from(await new Response(res.stream).arrayBuffer());
      if (bytes.length === 0) return null;
      return { mimeType: att.mimeType || "application/octet-stream", bytes };
    }
    const root = path.resolve(r.dir);
    const abs = path.resolve(path.isAbsolute(att.blobPath) ? att.blobPath : path.join(r.dir, att.blobPath));
    if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) return null;
    const bytes = await fs.readFile(abs);
    if (bytes.length === 0) return null;
    return { mimeType: att.mimeType || "application/octet-stream", bytes };
  } catch {
    return null;
  }
}

export async function hydrateIrissPasutijumsImages(record: IrissPasutijumsRecord): Promise<IrissPasutijumsRecord> {
  const r = resolveStorage();
  if (r.kind === "disabled") return record;
  const offers = [];
  for (const offer of record.offers) {
    const attachments = [];
    for (const att of offer.attachments) {
      attachments.push(await hydrateOneOfferImage(r, att));
    }
    offers.push({ ...offer, attachments });
  }
  return { ...record, offers };
}

export async function writeIrissPasutijums(
  record: IrissPasutijumsRecord,
  opts?: { expectedWorkspaceRevision?: number | null },
): Promise<WriteIrissPasutijumsResult> {
  try {
    const r = resolveStorage();
    if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
    if (!isSafeIrissPasutijumsId(record.id)) return { ok: false, error: "invalid_id" };
    const sanitizedRaw = normalizeRecord(record, record.id);
    if (!sanitizedRaw) return { ok: false, error: "invalid_record" };
    const sanitized = withAutoEcarstradeLinks(sanitizedRaw);
    const updatedAt = new Date().toISOString();
    const existing = await readIrissPasutijums(record.id);
    const existingRev = irissWorkspaceRevision(existing);
    if (existing && !irissRevisionMatches(existingRev, opts?.expectedWorkspaceRevision ?? null)) {
      return { ok: false, error: IRISS_STALE_REVISION, stale: true, record: existing };
    }
    const createdAt = existing?.createdAt ?? sanitized.createdAt ?? updatedAt;
    const incomingDeletedAt = typeof record.deletedAt === "string" ? record.deletedAt : undefined;
    let out: IrissPasutijumsRecord = {
      ...sanitized,
      updatedAt,
      createdAt,
      workspaceRevision: existingRev,
      deletedAt: incomingDeletedAt !== undefined ? incomingDeletedAt : existing?.deletedAt ?? sanitized.deletedAt ?? "",
    };
    out = await persistOfferImages(r, out);
    if (existing && !isMeaningfullyChanged(existing, out)) {
      if (r.kind === "blob" && BLOB_RECORD_CACHE_TTL_MS > 0) {
        cacheBlobRecord(out.id, existing);
      }
      return { ok: true, record: existing };
    }
    out = { ...out, workspaceRevision: nextIrissWorkspaceRevision(existingRev) };
    const backupTs = updatedAt.replace(/[:.]/g, "-");

    if (r.kind === "blob") {
      const pathname = blobPathname(r.prefix, out.id);
      const serialized = JSON.stringify(out, null, 2);
      if (existing && BLOB_WRITE_BACKUPS_ENABLED) {
        const backupPath = backupBlobPathname(BACKUP_BLOB_PREFIX, out.id, backupTs);
        await put(backupPath, JSON.stringify(existing, null, 2), {
          access: "private",
          token: r.token,
          contentType: "application/json; charset=utf-8",
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        if (shouldTrimBlobBackups(out.id)) {
          await trimBlobBackups(r.token, BACKUP_BLOB_PREFIX, out.id);
        }
      }
      await put(pathname, serialized, {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      try {
        await upsertListRowsIndex(r, rowFromRecord(out));
      } catch {
        /* ignore index sync errors; fallback rebuild will recover */
      }
      invalidateBlobListCache();
      if (BLOB_RECORD_CACHE_TTL_MS > 0) {
        cacheBlobRecord(out.id, out);
      } else {
        invalidateBlobRecordCache(out.id);
      }
      await writeLocalMirrorSnapshot(out).catch(() => undefined);
      await writeLocalMirrorFullBundle().catch(() => undefined);
      return { ok: true, record: out };
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
    try {
      await upsertListRowsIndex(r, rowFromRecord(out));
    } catch {
      /* ignore index sync errors; fallback rebuild will recover */
    }
    invalidateBlobListCache();
    await writeLocalMirrorSnapshot(out).catch(() => undefined);
    await writeLocalMirrorFullBundle().catch(() => undefined);
    return { ok: true, record: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function createIrissPasutijums(
  seed?: Partial<IrissPasutijumsRecord> & { id?: string },
): Promise<{ ok: true; id: string; record: IrissPasutijumsRecord } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  const id = seed?.id && isSafeIrissPasutijumsId(seed.id) ? seed.id : crypto.randomUUID();
  const now = new Date().toISOString();
  const rec = { ...emptyIrissPasutijums(id, now), ...seed, id, createdAt: now, updatedAt: now, workspaceRevision: 0 };
  const w = await writeIrissPasutijums(rec, { expectedWorkspaceRevision: 0 });
  if (!w.ok) return { ok: false, error: w.error };
  return { ok: true, id, record: w.record };
}

function listingOrderOvBlobPath(prefix: string): string {
  return `${prefix}${LISTING_ORDER_OV_FILENAME}`;
}

function listingOrderOvFsPath(dir: string): string {
  return path.join(dir, LISTING_ORDER_OV_FILENAME);
}

export async function readIrissListingOrderOv(): Promise<IrissListingOrderOv> {
  const r = resolveStorage();
  if (r.kind === "disabled") return {};
  if (r.kind === "blob") {
    const raw = await readJsonFromBlob(listingOrderOvBlobPath(r.prefix), r.token);
    return parseIrissListingOrderOv(raw);
  }
  try {
    const txt = await fs.readFile(listingOrderOvFsPath(r.dir), "utf8");
    return parseIrissListingOrderOv(JSON.parse(txt) as unknown);
  } catch {
    return {};
  }
}

export async function writeIrissListingOrderOv(
  ov: IrissListingOrderOv,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  const next = parseIrissListingOrderOv(ov);
  try {
    if (r.kind === "blob") {
      await put(listingOrderOvBlobPath(r.prefix), JSON.stringify(next, null, 2), {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { ok: true };
    }
    await fs.mkdir(r.dir, { recursive: true });
    const fp = listingOrderOvFsPath(r.dir);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
    await fs.rename(tmp, fp);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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
    const existing = await readIrissPasutijums(id);
    if (!existing) return { ok: true };
    if (isIrissRecordDeleted(existing)) return { ok: true };
    const next = markIrissRecordDeleted(existing, new Date().toISOString());
    const w = await writeIrissPasutijums(next, { expectedWorkspaceRevision: irissWorkspaceRevision(existing) });
    if (!w.ok) return { ok: false, error: w.error };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function restoreIrissPasutijums(id: string): Promise<{ ok: true; record: IrissPasutijumsRecord } | { ok: false; error: string }> {
  if (!isSafeIrissPasutijumsId(id)) return { ok: false, error: "invalid_id" };
  const existing = await readIrissPasutijums(id);
  if (!existing) return { ok: false, error: "not_found" };
  const next = restoreIrissRecord(existing);
  const w = await writeIrissPasutijums(next, { expectedWorkspaceRevision: irissWorkspaceRevision(existing) });
  if (!w.ok) return { ok: false, error: w.error };
  return { ok: true, record: w.record };
}
