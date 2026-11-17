import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { del, get, put } from "@vercel/blob";

import {
  addDealerCheckLedgerLoad,
  emptyDealerCheckLedgerMonth,
  emptyDealerCheckVehicle,
  isDealerCheckTemplateId,
  isSafeDealerCheckId,
  parseDealerCheckTemplateId,
  type DealerCheckAutoparksLink,
  type DealerCheckComments,
  type DealerCheckCsddCompare,
  type DealerCheckLedgerMonth,
  type DealerCheckMileageRow,
  type DealerCheckRecord,
  type DealerCheckServiceRow,
  type DealerCheckTemplateId,
  type DealerCheckVehicleInfo,
} from "@/lib/dealer-check";
import { parseOneautoDisplay, parseOneautoProductIds } from "@/lib/oneauto-catalog";
import { parseResultMap } from "@/lib/oneauto-block";
import { rigaYearMonthKey } from "@/lib/admin-riga-calendar";
import { normalizeVin } from "@/lib/order-field-validation";
import {
  dealerCheckHistoryEntryFromRecord,
  dealerCheckLoadShouldPersist,
  dealerCheckVisibleTo,
  parseDealerCheckCsddSnapshot,
  parseDealerCheckHistoryEntry,
  type DealerCheckHistoryEntry,
} from "@/lib/dealer-check-history";

const DEFAULT_RELATIVE_DIR = ".data/dealer-checks";
const DEFAULT_BLOB_SUBPREFIX = "dealer-checks/";
const LEDGER_KEY = "_ledger";
const INDEX_KEY = "_index";

type BlobConfig = { token: string; prefix: string };

type DealerCheckIndex = {
  byVin: Record<string, string>;
  ids: string[];
  entries: DealerCheckHistoryEntry[];
};

type DealerCheckLedgerFile = {
  months: Record<string, DealerCheckLedgerMonth>;
};

function resolveBlob(): BlobConfig | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!token) return null;
  const explicit = (process.env.DEALER_CHECK_BLOB_PREFIX ?? "").trim();
  if (explicit) {
    return { token, prefix: explicit.endsWith("/") ? explicit : `${explicit}/` };
  }
  const draftPrefix = (process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX ?? "").trim();
  if (!draftPrefix) return null;
  const base = draftPrefix.endsWith("/") ? draftPrefix : `${draftPrefix}/`;
  return { token, prefix: `${base}${DEFAULT_BLOB_SUBPREFIX}` };
}

function resolveDir(): string | null {
  const raw = process.env.DEALER_CHECK_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  if (process.env.VERCEL === "1") return path.join(os.tmpdir(), "provin-dealer-checks");
  return path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
}

export function isDealerCheckStoreEnabled(): boolean {
  return resolveDir() !== null || resolveBlob() !== null;
}

async function readJson(key: string): Promise<unknown | null> {
  const blob = resolveBlob();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${key}.json`, {
        access: "private",
        token: blob.token,
        useCache: false,
      });
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

async function writeJson(key: string, value: unknown): Promise<boolean> {
  const body = JSON.stringify(value);
  let wrote = false;
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
      wrote = true;
    } catch {
      /* failsistēma */
    }
  }
  const dir = resolveDir();
  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${key}.json`), body, "utf8");
      wrote = true;
    } catch {
      /* nerakstāma vide */
    }
  }
  return wrote;
}

async function deleteJson(key: string): Promise<void> {
  const blob = resolveBlob();
  if (blob) {
    try {
      await del(`${blob.prefix}${key}.json`, { token: blob.token });
    } catch {
      /* nav blob */
    }
  }
  const dir = resolveDir();
  if (!dir) return;
  try {
    await fs.unlink(path.join(dir, `${key}.json`));
  } catch {
    /* nav faila */
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseVehicle(raw: unknown, vin: string): DealerCheckVehicleInfo {
  const o = asRecord(raw);
  const empty = emptyDealerCheckVehicle(vin);
  if (!o) return empty;
  const str = (k: keyof DealerCheckVehicleInfo) => (typeof o[k] === "string" ? o[k].trim().slice(0, 200) : empty[k]);
  return {
    make: str("make"),
    model: str("model"),
    body: str("body"),
    engine: str("engine"),
    firstReg: str("firstReg"),
    color: str("color"),
    gearbox: str("gearbox"),
    manufacturer: str("manufacturer"),
    vin: normalizeVin(typeof o.vin === "string" ? o.vin : vin).slice(0, 17),
  };
}

function parseComments(raw: unknown): DealerCheckComments {
  const o = asRecord(raw);
  return {
    serviceHistory: typeof o?.serviceHistory === "string" ? o.serviceHistory.slice(0, 8000) : "",
    oilIntervals: typeof o?.oilIntervals === "string" ? o.oilIntervals.slice(0, 8000) : "",
  };
}

function parseMileage(raw: unknown): DealerCheckMileageRow[] {
  if (!Array.isArray(raw)) return [];
  const out: DealerCheckMileageRow[] = [];
  for (const item of raw.slice(0, 300)) {
    const o = asRecord(item);
    if (!o) continue;
    out.push({
      date: typeof o.date === "string" ? o.date.slice(0, 40) : "",
      odometer: typeof o.odometer === "string" ? o.odometer.slice(0, 40) : "",
      source: typeof o.source === "string" ? o.source.slice(0, 80) : "Dīlera serviss",
    });
  }
  return out;
}

function parseService(raw: unknown): DealerCheckServiceRow[] {
  if (!Array.isArray(raw)) return [];
  const out: DealerCheckServiceRow[] = [];
  for (const item of raw.slice(0, 300)) {
    const o = asRecord(item);
    if (!o) continue;
    out.push({
      date: typeof o.date === "string" ? o.date.slice(0, 40) : "",
      km: typeof o.km === "string" ? o.km.slice(0, 40) : "",
      works: typeof o.works === "string" ? o.works.slice(0, 8000) : "",
      dealer: typeof o.dealer === "string" ? o.dealer.slice(0, 200) : "",
    });
  }
  return out;
}

function parseCsdd(raw: unknown): DealerCheckCsddCompare | null {
  const o = asRecord(raw);
  if (!o) return null;
  const match = o.match === "match" || o.match === "mismatch" ? o.match : "none";
  return {
    firstRegLv: typeof o.firstRegLv === "string" ? o.firstRegLv.slice(0, 40) : "",
    odometer: typeof o.odometer === "string" ? o.odometer.slice(0, 40) : "",
    inspectionUntil: typeof o.inspectionUntil === "string" ? o.inspectionUntil.slice(0, 40) : "",
    match,
    matchLabel: typeof o.matchLabel === "string" ? o.matchLabel.slice(0, 80) : "nav ar ko salīdzināt",
  };
}

function parseAutoparks(raw: unknown): DealerCheckAutoparksLink | null {
  const o = asRecord(raw);
  if (!o || typeof o.carId !== "string" || !o.carId.trim()) return null;
  return {
    carId: o.carId.trim().slice(0, 80),
    title: typeof o.title === "string" ? o.title.slice(0, 160) : "",
    stockPath: typeof o.stockPath === "string" ? o.stockPath.slice(0, 400) : "",
    dropboxFolderId: typeof o.dropboxFolderId === "string" ? o.dropboxFolderId.slice(0, 120) : "",
  };
}

export function normalizeDealerCheckRecord(raw: unknown, fallbackId = ""): DealerCheckRecord | null {
  const o = asRecord(raw);
  if (!o) return null;
  const id = typeof o.id === "string" && isSafeDealerCheckId(o.id) ? o.id : fallbackId;
  if (!isSafeDealerCheckId(id)) return null;
  const vin = normalizeVin(typeof o.vin === "string" ? o.vin : "");
  const selected = parseOneautoProductIds(o.selectedProducts);
  const csddSnapshot = parseDealerCheckCsddSnapshot(o.csddSnapshot);
  const orderId = typeof o.orderId === "string" ? o.orderId.trim().slice(0, 80) : "";
  return {
    id,
    vin,
    plate: typeof o.plate === "string" ? o.plate.trim().slice(0, 16) : "",
    template: parseDealerCheckTemplateId(o.template),
    selectedProducts: selected,
    results: parseResultMap(o.results),
    display: parseOneautoDisplay(o.display),
    displayOriginal: parseOneautoDisplay(o.displayOriginal ?? o.display),
    vehicle: parseVehicle(o.vehicle, vin),
    mileageRows: parseMileage(o.mileageRows),
    serviceRows: parseService(o.serviceRows),
    comments: parseComments(o.comments),
    csdd: parseCsdd(o.csdd),
    chargedCents: Number.isFinite(Number(o.chargedCents)) ? Math.max(0, Math.round(Number(o.chargedCents))) : 0,
    quotedCents: Number.isFinite(Number(o.quotedCents)) ? Math.max(0, Math.round(Number(o.quotedCents))) : 0,
    fetchedAt: typeof o.fetchedAt === "string" ? o.fetchedAt.slice(0, 40) : "",
    monthKey: typeof o.monthKey === "string" ? o.monthKey.slice(0, 7) : rigaYearMonthKey(Date.now()),
    autoparks: parseAutoparks(o.autoparks),
    saved: o.saved === true,
    createdAt: typeof o.createdAt === "string" ? o.createdAt.slice(0, 40) : "",
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt.slice(0, 40) : "",
    ...(typeof o.createdBy === "string" && o.createdBy.trim() ? { createdBy: o.createdBy.trim().slice(0, 120) } : {}),
    ...(o.status === "converted" || orderId ? { status: "converted" as const } : {}),
    ...(orderId ? { orderId } : {}),
    ...(csddSnapshot ? { csddSnapshot } : {}),
  };
}

function parseEntries(raw: unknown): DealerCheckHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DealerCheckHistoryEntry[] = [];
  for (const item of raw) {
    const entry = parseDealerCheckHistoryEntry(item);
    if (entry && !out.some((row) => row.id === entry.id)) out.push(entry);
  }
  return out;
}

async function readIndex(): Promise<DealerCheckIndex> {
  const raw = asRecord(await readJson(INDEX_KEY));
  const byVin: Record<string, string> = {};
  const ids: string[] = [];
  const vinMap = asRecord(raw?.byVin);
  if (vinMap) {
    for (const [vin, id] of Object.entries(vinMap)) {
      if (typeof id === "string" && isSafeDealerCheckId(id)) byVin[normalizeVin(vin)] = id;
    }
  }
  if (Array.isArray(raw?.ids)) {
    for (const id of raw.ids) {
      if (typeof id === "string" && isSafeDealerCheckId(id) && !ids.includes(id)) ids.push(id);
    }
  }
  return { byVin, ids, entries: parseEntries(raw?.entries) };
}

async function writeIndex(index: DealerCheckIndex): Promise<void> {
  await writeJson(INDEX_KEY, index);
}

export async function readDealerCheck(id: string): Promise<DealerCheckRecord | null> {
  if (!isSafeDealerCheckId(id)) return null;
  return normalizeDealerCheckRecord(await readJson(id), id);
}

export async function readDealerCheckByVin(vin: string): Promise<DealerCheckRecord | null> {
  const n = normalizeVin(vin);
  if (!n) return null;
  const index = await readIndex();
  const id = index.byVin[n];
  return id ? readDealerCheck(id) : null;
}

export async function writeDealerCheck(record: DealerCheckRecord): Promise<boolean> {
  if (!isSafeDealerCheckId(record.id)) return false;
  const ok = await writeJson(record.id, record);
  if (!ok) return false;
  const index = await readIndex();
  if (record.vin) index.byVin[record.vin] = record.id;
  if (!index.ids.includes(record.id)) index.ids.push(record.id);
  const entry = dealerCheckHistoryEntryFromRecord(record);
  if (entry) {
    const at = index.entries.findIndex((row) => row.id === entry.id);
    if (at >= 0) index.entries[at] = entry;
    else index.entries.push(entry);
  }
  await writeIndex(index);
  return true;
}

export async function commitDealerCheckLoad(
  record: DealerCheckRecord,
  createdBy: string,
): Promise<{ stored: boolean; durable: boolean; record: DealerCheckRecord }> {
  if (!dealerCheckLoadShouldPersist(record) || !isSafeDealerCheckId(record.id)) {
    return { stored: false, durable: false, record };
  }
  const next: DealerCheckRecord = {
    ...record,
    createdBy,
    status: "open",
    orderId: "",
  };
  const stored = await writeDealerCheck(next);
  return { stored, durable: true, record: next };
}

async function hydrateMissingEntries(index: DealerCheckIndex): Promise<DealerCheckHistoryEntry[]> {
  const known = new Set(index.entries.map((row) => row.id));
  const missing = index.ids.filter((id) => !known.has(id));
  if (missing.length === 0) return index.entries;
  let changed = false;
  for (const id of missing) {
    const rec = await readDealerCheck(id);
    const entry = rec ? dealerCheckHistoryEntryFromRecord(rec) : null;
    if (!entry) continue;
    index.entries.push(entry);
    changed = true;
  }
  if (changed) await writeIndex(index);
  return index.entries;
}

export async function listDealerCheckEntries(creatorId: string): Promise<DealerCheckHistoryEntry[]> {
  const index = await readIndex();
  const entries = await hydrateMissingEntries(index);
  return entries
    .filter((row) => row.createdBy === creatorId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export async function readOwnedDealerCheck(id: string, creatorId: string): Promise<DealerCheckRecord | null> {
  const record = await readDealerCheck(id);
  if (!record || !dealerCheckVisibleTo(record, creatorId)) return null;
  return record;
}

export async function convertDealerCheckToOrder(id: string, orderId: string, createdBy: string): Promise<boolean> {
  const current = await readOwnedDealerCheck(id, createdBy);
  const order = orderId.trim().slice(0, 80);
  if (!current || !order) return false;
  const next: DealerCheckRecord = {
    ...current,
    status: "converted",
    orderId: order,
    updatedAt: new Date().toISOString(),
  };
  return writeDealerCheck(next);
}

export async function deleteDealerCheck(id: string): Promise<DealerCheckRecord | null> {
  const current = await readDealerCheck(id);
  if (!current) return null;
  const index = await readIndex();
  index.ids = index.ids.filter((x) => x !== id);
  index.entries = index.entries.filter((row) => row.id !== id);
  if (current.vin && index.byVin[current.vin] === id) delete index.byVin[current.vin];
  await writeIndex(index);
  await deleteJson(id);
  return current;
}

export async function readDealerCheckLedgerMonth(monthKey?: string): Promise<DealerCheckLedgerMonth> {
  const key = monthKey ?? rigaYearMonthKey(Date.now());
  const file = asRecord(await readJson(LEDGER_KEY)) as DealerCheckLedgerFile | null;
  const raw = file?.months?.[key];
  if (!raw) return emptyDealerCheckLedgerMonth(key);
  return {
    monthKey: key,
    dzintarzeme: {
      cents: Math.max(0, Math.round(Number(raw.dzintarzeme?.cents) || 0)),
      loads: Math.max(0, Math.round(Number(raw.dzintarzeme?.loads) || 0)),
    },
    cits: {
      cents: Math.max(0, Math.round(Number(raw.cits?.cents) || 0)),
      loads: Math.max(0, Math.round(Number(raw.cits?.loads) || 0)),
    },
  };
}

export async function addDealerCheckCost(
  template: DealerCheckTemplateId,
  chargedCents: number,
  nowMs = Date.now(),
): Promise<DealerCheckLedgerMonth> {
  if (!isDealerCheckTemplateId(template)) return emptyDealerCheckLedgerMonth(rigaYearMonthKey(nowMs));
  const key = rigaYearMonthKey(nowMs);
  const file = (asRecord(await readJson(LEDGER_KEY)) as DealerCheckLedgerFile | null) ?? { months: {} };
  const current = file.months[key] ?? emptyDealerCheckLedgerMonth(key);
  const next = addDealerCheckLedgerLoad(current, template, chargedCents);
  file.months[key] = next;
  await writeJson(LEDGER_KEY, file);
  return next;
}

export async function patchDealerCheck(
  id: string,
  patch: Partial<Pick<DealerCheckRecord, "comments" | "saved" | "autoparks" | "updatedAt">>,
): Promise<DealerCheckRecord | null> {
  const current = await readDealerCheck(id);
  if (!current) return null;
  const next: DealerCheckRecord = {
    ...current,
    ...patch,
    comments: patch.comments ?? current.comments,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };
  const ok = await writeDealerCheck(next);
  return ok ? next : null;
}
