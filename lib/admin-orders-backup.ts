import "server-only";

import archiver from "archiver";
import type Stripe from "stripe";
import fs from "fs/promises";
import path from "path";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import { get, list } from "@vercel/blob";
import { getOrderDraftStorageDir, isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { resolveInvoiceDir } from "@/lib/invoice-storage";
import { getDemoConsultationRows, getDemoOrderRows } from "@/lib/demo-orders";
import { isDemoOrdersEnabled } from "@/lib/admin-orders";
import { getStripe } from "@/lib/stripe";

const STRIPE_PAGE_TIMEOUT_MS = 12_000;
const STRIPE_MAX_PAGES = 80;

export type OrdersBackupMeta = {
  exportedAt: string;
  draftFilesCount: number;
  invoicePdfCount: number;
  stripePaidSessionCount: number;
  stripeError: string | null;
  demoSnapshotsIncluded: boolean;
  draftSources: ("filesystem" | "vercel_blob")[];
};

function backupDateSlug(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ordersBackupFilename(ext: "zip" | "json"): string {
  return `provin-orders-backup-${backupDateSlug()}.${ext}`;
}

async function collectDraftJsonFromFs(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const dir = getOrderDraftStorageDir();
  if (!dir) return out;
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const sessionId = name.slice(0, -5);
    if (!isSafeOrderDraftSessionId(sessionId)) continue;
    try {
      const raw = await fs.readFile(path.join(dir, name), "utf8");
      out.set(name, raw);
    } catch {
      /* skip */
    }
  }
  return out;
}

/**
 * Ja `ADMIN_ORDER_DRAFT_BLOB_PREFIX` (piem. `admin-order-drafts/`) + `BLOB_READ_WRITE_TOKEN`,
 * nolasa melnrakstu JSON no Vercel Blob (`list` + `get`, kā IRISS modulis).
 */
async function collectDraftJsonFromBlob(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const prefix = (process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX ?? "").trim();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!prefix || !token) return out;

  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token, cursor, limit: 1000 });
    for (const b of page.blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      const base = path.basename(b.pathname);
      const sessionId = base.slice(0, -5);
      if (!isSafeOrderDraftSessionId(sessionId)) continue;
      try {
        const res = await get(b.pathname, { access: "private", token, useCache: false });
        if (!res || res.statusCode !== 200 || !res.stream) continue;
        const text = await new Response(res.stream).text();
        out.set(base, text);
      } catch {
        /* skip */
      }
    }
    if (page.hasMore && !page.cursor) break;
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);

  return out;
}

async function collectAllDraftJson(): Promise<{ map: Map<string, string>; sources: OrdersBackupMeta["draftSources"] }> {
  const fsMap = await collectDraftJsonFromFs();
  const blobMap = await collectDraftJsonFromBlob();
  const sources: OrdersBackupMeta["draftSources"] = [];
  if (fsMap.size > 0) sources.push("filesystem");
  if (blobMap.size > 0) sources.push("vercel_blob");
  const merged = new Map(fsMap);
  for (const [k, v] of blobMap) merged.set(k, v);
  return { map: merged, sources };
}

async function collectInvoicePdfs(): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  const invDir = resolveInvoiceDir();
  if (!invDir) return out;
  let names: string[] = [];
  try {
    names = await fs.readdir(invDir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!name.toLowerCase().endsWith(".pdf")) continue;
    const sessionId = name.slice(0, -4);
    if (!isSafeOrderDraftSessionId(sessionId)) continue;
    try {
      const buf = await fs.readFile(path.join(invDir, name));
      out.set(name, new Uint8Array(buf));
    } catch {
      /* skip */
    }
  }
  return out;
}

function serializeCheckoutSession(s: Stripe.Checkout.Session): unknown {
  return JSON.parse(JSON.stringify(s)) as unknown;
}

async function collectPaidStripeSessions(): Promise<{ sessions: unknown[]; error: string | null }> {
  const sessions: unknown[] = [];
  let stripeError: string | null = null;
  try {
    const stripe = getStripe();
    let startingAfter: string | undefined;
    for (let page = 0; page < STRIPE_MAX_PAGES; page++) {
      const res = await stripe.checkout.sessions.list(
        { limit: 100, starting_after: startingAfter },
        { timeout: STRIPE_PAGE_TIMEOUT_MS },
      );
      if (res.data.length === 0) break;
      for (const s of res.data) {
        if (s.payment_status !== "paid") continue;
        sessions.push(serializeCheckoutSession(s));
      }
      if (!res.has_more) break;
      startingAfter = res.data[res.data.length - 1]?.id;
      if (!startingAfter) break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stripeError = msg;
  }
  return { sessions, error: stripeError };
}

type Gathered = {
  drafts: Map<string, string>;
  pdfs: Map<string, Uint8Array>;
  stripeSessions: unknown[];
  stripeError: string | null;
  sources: OrdersBackupMeta["draftSources"];
  demoOn: boolean;
};

async function gatherBackupParts(): Promise<Gathered> {
  const { map: drafts, sources } = await collectAllDraftJson();
  const pdfs = await collectInvoicePdfs();
  const { sessions, error: stripeError } = await collectPaidStripeSessions();
  return {
    drafts,
    pdfs,
    stripeSessions: sessions,
    stripeError,
    sources,
    demoOn: isDemoOrdersEnabled(),
  };
}

export type OrdersBackupPayload = {
  meta: OrdersBackupMeta;
  orderDrafts: Record<string, string>;
  invoicePdfsBase64?: Record<string, string>;
  stripePaidCheckoutSessions: unknown[];
  demoOrderRows?: unknown[];
  demoConsultationRows?: unknown[];
};

export async function buildOrdersBackupJsonString(): Promise<string> {
  const g = await gatherBackupParts();
  const meta: OrdersBackupMeta = {
    exportedAt: new Date().toISOString(),
    draftFilesCount: g.drafts.size,
    invoicePdfCount: g.pdfs.size,
    stripePaidSessionCount: g.stripeSessions.length,
    stripeError: g.stripeError,
    demoSnapshotsIncluded: g.demoOn,
    draftSources: g.sources,
  };

  const orderDrafts: Record<string, string> = {};
  for (const [name, body] of g.drafts) orderDrafts[name] = body;

  const invoicePdfsBase64: Record<string, string> = {};
  for (const [name, bytes] of g.pdfs) {
    invoicePdfsBase64[name] = Buffer.from(bytes).toString("base64");
  }

  const payload: OrdersBackupPayload = {
    meta,
    orderDrafts,
    ...(g.pdfs.size > 0 ? { invoicePdfsBase64 } : {}),
    stripePaidCheckoutSessions: g.stripeSessions,
  };

  if (g.demoOn) {
    payload.demoOrderRows = getDemoOrderRows();
    payload.demoConsultationRows = getDemoConsultationRows();
  }

  return `${JSON.stringify(payload, null, 2)}\n`;
}

export async function buildOrdersBackupZipBuffer(): Promise<Buffer> {
  const g = await gatherBackupParts();
  const meta: OrdersBackupMeta = {
    exportedAt: new Date().toISOString(),
    draftFilesCount: g.drafts.size,
    invoicePdfCount: g.pdfs.size,
    stripePaidSessionCount: g.stripeSessions.length,
    stripeError: g.stripeError,
    demoSnapshotsIncluded: g.demoOn,
    draftSources: g.sources,
  };

  const archive = archiver("zip", { zlib: { level: 6 } });
  const pass = new PassThrough();
  const chunks: Buffer[] = [];
  pass.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
  archive.on("error", (err: Error) => {
    throw err;
  });
  archive.pipe(pass);

  archive.append(JSON.stringify(meta, null, 2), { name: "meta.json" });

  for (const [name, body] of g.drafts) {
    archive.append(body, { name: `drafts/${name}` });
  }

  for (const [name, bytes] of g.pdfs) {
    archive.append(Buffer.from(bytes), { name: `invoices/${name}` });
  }

  const pageSize = 80;
  const all = g.stripeSessions;
  if (all.length === 0) {
    archive.append("[]\n", { name: "stripe/paid-checkout-sessions-page-0.json" });
  } else {
    for (let i = 0, p = 0; i < all.length; i += pageSize, p++) {
      const chunk = all.slice(i, i + pageSize);
      archive.append(`${JSON.stringify(chunk, null, 2)}\n`, {
        name: `stripe/paid-checkout-sessions-page-${p}.json`,
      });
    }
  }

  if (g.demoOn) {
    archive.append(`${JSON.stringify(getDemoOrderRows(), null, 2)}\n`, {
      name: "demo/demo-orders.json",
    });
    archive.append(`${JSON.stringify(getDemoConsultationRows(), null, 2)}\n`, {
      name: "demo/demo-consultations.json",
    });
  }

  await archive.finalize();
  await finished(pass);
  return Buffer.concat(chunks);
}
