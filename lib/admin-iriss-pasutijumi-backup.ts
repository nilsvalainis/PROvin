import "server-only";

import archiver from "archiver";
import type Stripe from "stripe";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import { getDemoConsultationRows, getDemoOrderRows } from "@/lib/demo-orders";
import { buildIrissOfferPdfBytes, buildIrissPasutijumsPdfBytes } from "@/lib/iriss-pasutijums-pdf";
import {
  getIrissPasutijumiStorageState,
  listIrissPasutijumi,
  readIrissListOrder,
  readIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import { isDemoOrdersEnabled } from "@/lib/admin-orders";
import { getStripe } from "@/lib/stripe";

const STRIPE_PAGE_TIMEOUT_MS = 12_000;
const STRIPE_MAX_PAGES = 80;

export type IrissOrdersBackupMeta = {
  exportedAt: string;
  draftFilesCount: number;
  orderPdfCount: number;
  offerPdfCount: number;
  stripePaidSessionCount: number;
  stripeError: string | null;
  demoSnapshotsIncluded: boolean;
  storage: ReturnType<typeof getIrissPasutijumiStorageState>;
};

function backupDateSlug(): string {
  return new Date().toISOString().slice(0, 10);
}

export function irissOrdersBackupFilename(ext: "zip" | "json"): string {
  return `provin-iriss-pasutijumi-backup-${backupDateSlug()}.${ext}`;
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
    stripeError = e instanceof Error ? e.message : String(e);
  }
  return { sessions, error: stripeError };
}

async function collectIrissDraftRecords(): Promise<Map<string, IrissPasutijumsRecord>> {
  const map = new Map<string, IrissPasutijumsRecord>();
  const rows = await listIrissPasutijumi();
  for (const row of rows) {
    const rec = await readIrissPasutijums(row.id);
    if (!rec) continue;
    map.set(`${row.id}.json`, rec);
  }
  return map;
}

async function buildIrissPdfMaps(records: Map<string, IrissPasutijumsRecord>): Promise<{
  orderPdfs: Map<string, Uint8Array>;
  offerPdfs: Map<string, Uint8Array>;
}> {
  const orderPdfs = new Map<string, Uint8Array>();
  const offerPdfs = new Map<string, Uint8Array>();

  for (const [recordName, record] of records) {
    const recordId = recordName.slice(0, -".json".length);
    try {
      const bytes = await buildIrissPasutijumsPdfBytes(record);
      orderPdfs.set(`${recordId}.pdf`, bytes);
    } catch {
      /* skip single broken PDF, keep export usable */
    }
    for (const offer of record.offers) {
      try {
        const bytes = await buildIrissOfferPdfBytes(record, offer, {
          embedImages: true,
          includeClientData: true,
        });
        offerPdfs.set(`${recordId}--offer-${offer.id}.pdf`, bytes);
      } catch {
        /* skip single broken offer PDF */
      }
    }
  }

  return { orderPdfs, offerPdfs };
}

type Gathered = {
  records: Map<string, IrissPasutijumsRecord>;
  listOrder: Awaited<ReturnType<typeof readIrissListOrder>>;
  orderPdfs: Map<string, Uint8Array>;
  offerPdfs: Map<string, Uint8Array>;
  stripeSessions: unknown[];
  stripeError: string | null;
  demoOn: boolean;
  storage: ReturnType<typeof getIrissPasutijumiStorageState>;
};

async function gatherBackupParts(): Promise<Gathered> {
  const storage = getIrissPasutijumiStorageState();
  const listOrder = await readIrissListOrder();
  const records = storage.enabled ? await collectIrissDraftRecords() : new Map<string, IrissPasutijumsRecord>();
  const { orderPdfs, offerPdfs } = await buildIrissPdfMaps(records);
  const { sessions, error: stripeError } = await collectPaidStripeSessions();
  return {
    records,
    listOrder,
    orderPdfs,
    offerPdfs,
    stripeSessions: sessions,
    stripeError,
    demoOn: isDemoOrdersEnabled(),
    storage,
  };
}

export type IrissOrdersBackupPayload = {
  meta: IrissOrdersBackupMeta;
  listOrder: Awaited<ReturnType<typeof readIrissListOrder>>;
  orderDrafts: Record<string, string>;
  orderPdfsBase64?: Record<string, string>;
  offerPdfsBase64?: Record<string, string>;
  stripePaidCheckoutSessions: unknown[];
  demoOrderRows?: unknown[];
  demoConsultationRows?: unknown[];
};

export async function buildIrissOrdersBackupJsonString(): Promise<string> {
  const g = await gatherBackupParts();
  const meta: IrissOrdersBackupMeta = {
    exportedAt: new Date().toISOString(),
    draftFilesCount: g.records.size,
    orderPdfCount: g.orderPdfs.size,
    offerPdfCount: g.offerPdfs.size,
    stripePaidSessionCount: g.stripeSessions.length,
    stripeError: g.stripeError,
    demoSnapshotsIncluded: g.demoOn,
    storage: g.storage,
  };

  const orderDrafts: Record<string, string> = {};
  for (const [name, rec] of g.records) orderDrafts[name] = `${JSON.stringify(rec, null, 2)}\n`;

  const orderPdfsBase64: Record<string, string> = {};
  for (const [name, bytes] of g.orderPdfs) orderPdfsBase64[name] = Buffer.from(bytes).toString("base64");

  const offerPdfsBase64: Record<string, string> = {};
  for (const [name, bytes] of g.offerPdfs) offerPdfsBase64[name] = Buffer.from(bytes).toString("base64");

  const payload: IrissOrdersBackupPayload = {
    meta,
    listOrder: g.listOrder,
    orderDrafts,
    ...(g.orderPdfs.size > 0 ? { orderPdfsBase64 } : {}),
    ...(g.offerPdfs.size > 0 ? { offerPdfsBase64 } : {}),
    stripePaidCheckoutSessions: g.stripeSessions,
  };

  if (g.demoOn) {
    payload.demoOrderRows = getDemoOrderRows();
    payload.demoConsultationRows = getDemoConsultationRows();
  }

  return `${JSON.stringify(payload, null, 2)}\n`;
}

export async function buildIrissOrdersBackupZipBuffer(): Promise<Buffer> {
  const g = await gatherBackupParts();
  const meta: IrissOrdersBackupMeta = {
    exportedAt: new Date().toISOString(),
    draftFilesCount: g.records.size,
    orderPdfCount: g.orderPdfs.size,
    offerPdfCount: g.offerPdfs.size,
    stripePaidSessionCount: g.stripeSessions.length,
    stripeError: g.stripeError,
    demoSnapshotsIncluded: g.demoOn,
    storage: g.storage,
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
  archive.append(`${JSON.stringify(g.listOrder, null, 2)}\n`, { name: "list-order.json" });

  for (const [name, rec] of g.records) {
    archive.append(`${JSON.stringify(rec, null, 2)}\n`, { name: `drafts/${name}` });
  }
  for (const [name, bytes] of g.orderPdfs) {
    archive.append(Buffer.from(bytes), { name: `pdf/orders/${name}` });
  }
  for (const [name, bytes] of g.offerPdfs) {
    archive.append(Buffer.from(bytes), { name: `pdf/offers/${name}` });
  }

  const pageSize = 80;
  if (g.stripeSessions.length === 0) {
    archive.append("[]\n", { name: "stripe/paid-checkout-sessions-page-0.json" });
  } else {
    for (let i = 0, p = 0; i < g.stripeSessions.length; i += pageSize, p++) {
      const chunk = g.stripeSessions.slice(i, i + pageSize);
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
