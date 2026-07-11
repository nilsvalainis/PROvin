import "server-only";

import fs from "fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import type { AdminOrderRow } from "@/lib/admin-orders";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import { invalidateStripePaidListCache } from "@/lib/admin-stripe-cache";

const INDEX_FILENAME = "admin-stripe-paid-index.json";

const SOFT_TTL_MS = Math.max(
  60_000,
  Number.parseInt(process.env.ADMIN_STRIPE_INDEX_SOFT_TTL_MS ?? "300000", 10) || 300_000,
);
const HARD_TTL_MS = Math.max(
  SOFT_TTL_MS,
  Number.parseInt(process.env.ADMIN_STRIPE_INDEX_HARD_TTL_MS ?? "86400000", 10) || 86_400_000,
);

type StripePaidIndexDoc = {
  version: 1;
  updatedAt: string;
  rows: AdminOrderRow[];
};

function indexFsPath(dir: string): string {
  return path.join(dir, INDEX_FILENAME);
}

function indexBlobPath(prefix: string): string {
  return `${prefix}${INDEX_FILENAME}`;
}

function normalizeRow(raw: unknown): AdminOrderRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const created = typeof o.created === "number" && Number.isFinite(o.created) ? o.created : 0;
  if (!id || created <= 0) return null;
  return {
    id,
    created,
    amountTotal: typeof o.amountTotal === "number" ? o.amountTotal : null,
    currency: typeof o.currency === "string" ? o.currency : null,
    paymentStatus: (typeof o.paymentStatus === "string" ? o.paymentStatus : "paid") as AdminOrderRow["paymentStatus"],
    customerEmail: typeof o.customerEmail === "string" ? o.customerEmail : null,
    vin: typeof o.vin === "string" ? o.vin : null,
    checkoutLine: typeof o.checkoutLine === "string" ? (o.checkoutLine as AdminOrderRow["checkoutLine"]) : undefined,
    isDemo: o.isDemo === true,
    isManual: o.isManual === true,
  };
}

function normalizeDoc(raw: unknown): StripePaidIndexDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.rows)) return null;
  const rows: AdminOrderRow[] = [];
  for (const r of o.rows) {
    const row = normalizeRow(r);
    if (row) rows.push(row);
  }
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString();
  return { version: 1, updatedAt, rows: rows.sort((a, b) => b.created - a.created) };
}

async function readIndexFromFs(dir: string): Promise<StripePaidIndexDoc | null> {
  try {
    const raw = JSON.parse(await fs.readFile(indexFsPath(dir), "utf8")) as unknown;
    return normalizeDoc(raw);
  } catch {
    return null;
  }
}

async function readIndexFromBlob(blob: { token: string; prefix: string }): Promise<StripePaidIndexDoc | null> {
  try {
    const res = await get(indexBlobPath(blob.prefix), {
      access: "private",
      token: blob.token,
      useCache: true,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const raw = JSON.parse(await new Response(res.stream).text()) as unknown;
    return normalizeDoc(raw);
  } catch {
    return null;
  }
}

function pickNewer(a: StripePaidIndexDoc | null, b: StripePaidIndexDoc | null): StripePaidIndexDoc | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updatedAt) >= Date.parse(a.updatedAt) ? b : a;
}

export async function readStripePaidIndex(): Promise<StripePaidIndexDoc | null> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  const fromFs = dir ? await readIndexFromFs(dir) : null;
  const fromBlob = blob ? await readIndexFromBlob(blob) : null;
  return pickNewer(fromFs, fromBlob);
}

export async function writeStripePaidIndex(rows: AdminOrderRow[]): Promise<void> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return;

  const doc: StripePaidIndexDoc = {
    version: 1,
    updatedAt: new Date().toISOString(),
    rows: [...rows].sort((a, b) => b.created - a.created),
  };
  const body = JSON.stringify(doc);

  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const fp = indexFsPath(dir);
      const tmp = `${fp}.tmp`;
      await fs.writeFile(tmp, body, "utf8");
      await fs.rename(tmp, fp);
    } catch {
      /* ignore */
    }
  }

  if (blob) {
    try {
      await put(indexBlobPath(blob.prefix), body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    } catch {
      /* ignore */
    }
  }

  invalidateStripePaidListCache();
}

export async function upsertStripePaidIndexRow(row: AdminOrderRow): Promise<void> {
  const existing = (await readStripePaidIndex())?.rows ?? [];
  const next = existing.filter((r) => r.id !== row.id);
  next.push(row);
  await writeStripePaidIndex(next);
}

export function stripePaidIndexAgeMs(doc: StripePaidIndexDoc | null): number {
  if (!doc) return Number.POSITIVE_INFINITY;
  const ts = Date.parse(doc.updatedAt);
  return Number.isFinite(ts) ? Date.now() - ts : Number.POSITIVE_INFINITY;
}

export function shouldRefreshStripePaidIndexSync(doc: StripePaidIndexDoc | null): boolean {
  if (!doc || doc.rows.length === 0) return true;
  return stripePaidIndexAgeMs(doc) >= HARD_TTL_MS;
}

export function shouldRefreshStripePaidIndexInBackground(doc: StripePaidIndexDoc | null): boolean {
  if (!doc || doc.rows.length === 0) return false;
  const age = stripePaidIndexAgeMs(doc);
  return age >= SOFT_TTL_MS && age < HARD_TTL_MS;
}

export { SOFT_TTL_MS, HARD_TTL_MS };
