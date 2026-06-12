import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
} from "@/lib/admin-order-draft-store";

/**
 * Manuālie pasūtījumi — admin panelī izveidoti ieraksti pasūtījumiem, kas neienāk
 * caur tiešsaistes formu (individuāli piedāvājumi, telefoniski u.tml.).
 * Glabājas vienā JSON indeksā tajā pašā krātuvē, kur pasūtījumu melnraksti
 * (failsistēma `.data/admin-order-drafts` un/vai Vercel Blob) — bez jauniem env.
 */

export const MANUAL_ORDER_ID_PREFIX = "manual_order_";

const MANUAL_ORDERS_INDEX_FILENAME = "manual_orders_index.json";

export type ManualOrderRecord = {
  id: string;
  /** Unix sekundes — “Laiks” (labojams). */
  created: number;
  /** Centi — “Summa” (labojama; `null` = vēl nav noteikta). */
  amountTotal: number | null;
  currency: string;
  updatedAt: string;
};

type ManualOrdersIndexDoc = {
  version: 1;
  updatedAt: string;
  orders: ManualOrderRecord[];
};

export function isManualOrderId(id: string): boolean {
  return typeof id === "string" && id.startsWith(MANUAL_ORDER_ID_PREFIX) && /^[a-zA-Z0-9_]+$/.test(id);
}

export function makeManualOrderId(now = new Date()): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${MANUAL_ORDER_ID_PREFIX}${now.getTime()}_${rnd}`;
}

function indexFilePath(dir: string): string {
  return path.join(dir, MANUAL_ORDERS_INDEX_FILENAME);
}

function normalizeRecord(raw: unknown): ManualOrderRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!isManualOrderId(id)) return null;
  const created =
    typeof o.created === "number" && Number.isFinite(o.created) ? Math.trunc(o.created) : 0;
  if (created <= 0) return null;
  const amountTotal =
    typeof o.amountTotal === "number" && Number.isFinite(o.amountTotal)
      ? Math.trunc(o.amountTotal)
      : null;
  const currency = typeof o.currency === "string" && o.currency ? o.currency.toUpperCase() : "EUR";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString();
  return { id, created, amountTotal, currency, updatedAt };
}

function normalizeIndexDoc(raw: unknown): ManualOrdersIndexDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.orders)) return null;
  const orders: ManualOrderRecord[] = [];
  for (const r of o.orders) {
    const rec = normalizeRecord(r);
    if (rec) orders.push(rec);
  }
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString();
  return { version: 1, updatedAt, orders };
}

async function readIndexFromFilesystem(dir: string): Promise<ManualOrdersIndexDoc | null> {
  try {
    const raw = await fs.readFile(indexFilePath(dir), "utf8");
    return normalizeIndexDoc(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function readIndexFromBlob(blob: { token: string; prefix: string }): Promise<ManualOrdersIndexDoc | null> {
  try {
    const res = await get(`${blob.prefix}${MANUAL_ORDERS_INDEX_FILENAME}`, {
      access: "private",
      token: blob.token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return normalizeIndexDoc(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

function pickNewerIndex(
  a: ManualOrdersIndexDoc | null,
  b: ManualOrdersIndexDoc | null,
): ManualOrdersIndexDoc | null {
  if (!a) return b;
  if (!b) return a;
  const aTs = Date.parse(a.updatedAt);
  const bTs = Date.parse(b.updatedAt);
  return (Number.isFinite(bTs) ? bTs : 0) >= (Number.isFinite(aTs) ? aTs : 0) ? b : a;
}

async function readManualOrdersIndex(): Promise<ManualOrdersIndexDoc> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  const fromFs = dir ? await readIndexFromFilesystem(dir) : null;
  const fromBlob = blob ? await readIndexFromBlob(blob) : null;
  return (
    pickNewerIndex(fromFs, fromBlob) ?? { version: 1, updatedAt: new Date(0).toISOString(), orders: [] }
  );
}

async function writeManualOrdersIndex(
  doc: ManualOrdersIndexDoc,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return { ok: false, error: "store_disabled" };
  /** Vercel: bez Blob rakstīšana uz /tmp nav ilgtspējīga — kā melnrakstiem. */
  if (process.env.VERCEL === "1" && !blob) return { ok: false, error: "store_not_durable" };

  let fsOk = false;
  let blobOk = false;

  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = indexFilePath(dir);
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
      await fs.rename(tmp, fp);
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }

  if (blob) {
    try {
      await put(`${blob.prefix}${MANUAL_ORDERS_INDEX_FILENAME}`, JSON.stringify(doc), {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      blobOk = true;
    } catch {
      blobOk = false;
    }
  }

  if (!fsOk && !blobOk) return { ok: false, error: "write_failed:fs_and_blob" };
  if (process.env.VERCEL === "1" && !blobOk) return { ok: false, error: "store_not_durable" };
  return { ok: true };
}

export async function listManualOrders(): Promise<ManualOrderRecord[]> {
  const idx = await readManualOrdersIndex();
  return [...idx.orders].sort((a, b) => b.created - a.created);
}

export async function getManualOrder(id: string): Promise<ManualOrderRecord | null> {
  if (!isManualOrderId(id)) return null;
  const idx = await readManualOrdersIndex();
  return idx.orders.find((o) => o.id === id) ?? null;
}

export async function createManualOrder(
  init: { created?: number; amountTotal?: number | null } = {},
): Promise<{ ok: true; record: ManualOrderRecord } | { ok: false; error: string }> {
  const now = new Date();
  const record: ManualOrderRecord = {
    id: makeManualOrderId(now),
    created:
      typeof init.created === "number" && Number.isFinite(init.created) && init.created > 0
        ? Math.trunc(init.created)
        : Math.floor(now.getTime() / 1000),
    amountTotal:
      typeof init.amountTotal === "number" && Number.isFinite(init.amountTotal)
        ? Math.trunc(init.amountTotal)
        : null,
    currency: "EUR",
    updatedAt: now.toISOString(),
  };
  const idx = await readManualOrdersIndex();
  const doc: ManualOrdersIndexDoc = {
    version: 1,
    updatedAt: now.toISOString(),
    orders: [record, ...idx.orders],
  };
  const res = await writeManualOrdersIndex(doc);
  if (!res.ok) return res;
  return { ok: true, record };
}

export async function updateManualOrder(
  id: string,
  patch: { created?: number; amountTotal?: number | null },
): Promise<{ ok: true; record: ManualOrderRecord } | { ok: false; error: string }> {
  if (!isManualOrderId(id)) return { ok: false, error: "invalid_id" };
  const idx = await readManualOrdersIndex();
  const existing = idx.orders.find((o) => o.id === id);
  if (!existing) return { ok: false, error: "not_found" };

  const next: ManualOrderRecord = { ...existing, updatedAt: new Date().toISOString() };
  if (patch.created !== undefined) {
    if (!Number.isFinite(patch.created) || patch.created <= 0) {
      return { ok: false, error: "invalid_created" };
    }
    next.created = Math.trunc(patch.created);
  }
  if (patch.amountTotal !== undefined) {
    if (patch.amountTotal === null) {
      next.amountTotal = null;
    } else if (Number.isFinite(patch.amountTotal) && patch.amountTotal >= 0) {
      next.amountTotal = Math.trunc(patch.amountTotal);
    } else {
      return { ok: false, error: "invalid_amount" };
    }
  }

  const doc: ManualOrdersIndexDoc = {
    version: 1,
    updatedAt: next.updatedAt,
    orders: idx.orders.map((o) => (o.id === id ? next : o)),
  };
  const res = await writeManualOrdersIndex(doc);
  if (!res.ok) return res;
  return { ok: true, record: next };
}

export async function deleteManualOrder(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isManualOrderId(id)) return { ok: false, error: "invalid_id" };
  const idx = await readManualOrdersIndex();
  if (!idx.orders.some((o) => o.id === id)) return { ok: false, error: "not_found" };
  const doc: ManualOrdersIndexDoc = {
    version: 1,
    updatedAt: new Date().toISOString(),
    orders: idx.orders.filter((o) => o.id !== id),
  };
  return writeManualOrdersIndex(doc);
}
