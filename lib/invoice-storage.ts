import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
  upsertOrderDraftInvoiceFields,
} from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { buildInvoicePdfBytes } from "@/lib/invoice-pdf";
import { getOrCreateInvoiceNumber } from "@/lib/invoice-number";

export function resolveInvoiceDir(): string | null {
  const base = getOrderDraftStorageDir();
  if (!base) return null;
  return path.join(base, "invoices");
}

function invoicePdfBlobPathname(prefix: string, sessionId: string): string {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${p}invoices/${sessionId}.pdf`;
}

export function invoicePdfFilePath(sessionId: string): string | null {
  const dir = resolveInvoiceDir();
  if (!dir || !isSafeOrderDraftSessionId(sessionId)) return null;
  return path.join(dir, `${sessionId}.pdf`);
}

async function readInvoicePdfFromBlob(sessionId: string): Promise<Uint8Array | null> {
  const blob = getOrderDraftBlobConfig();
  if (!blob || !isSafeOrderDraftSessionId(sessionId)) return null;
  try {
    const res = await get(invoicePdfBlobPathname(blob.prefix, sessionId), {
      access: "private",
      token: blob.token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const buf = await new Response(res.stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function writeInvoicePdfToBlob(sessionId: string, bytes: Uint8Array): Promise<boolean> {
  const blob = getOrderDraftBlobConfig();
  if (!blob || !isSafeOrderDraftSessionId(sessionId)) return false;
  try {
    await put(invoicePdfBlobPathname(blob.prefix, sessionId), Buffer.from(bytes), {
      access: "private",
      token: blob.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/pdf",
    });
    return true;
  } catch {
    return false;
  }
}

/** @deprecated Lietot `readInvoicePdfCached`. */
export async function readInvoicePdfFromDisk(sessionId: string): Promise<Uint8Array | null> {
  const fp = invoicePdfFilePath(sessionId);
  if (!fp) return null;
  try {
    const buf = await fs.readFile(fp);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/** Blob (produkcija) vai lokālais disks. */
export async function readInvoicePdfCached(sessionId: string): Promise<Uint8Array | null> {
  const fromBlob = await readInvoicePdfFromBlob(sessionId);
  if (fromBlob) return fromBlob;
  return readInvoicePdfFromDisk(sessionId);
}

/** @deprecated Lietot `writeInvoicePdfCached`. */
export async function writeInvoicePdfToDisk(sessionId: string, bytes: Uint8Array): Promise<boolean> {
  const dir = resolveInvoiceDir();
  if (!dir || !isSafeOrderDraftSessionId(sessionId)) return false;
  try {
    await fs.mkdir(dir, { recursive: true });
    const fp = path.join(dir, `${sessionId}.pdf`);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, fp);
    return true;
  } catch {
    return false;
  }
}

export async function writeInvoicePdfCached(sessionId: string, bytes: Uint8Array): Promise<boolean> {
  const [blobOk, diskOk] = await Promise.all([
    writeInvoicePdfToBlob(sessionId, bytes),
    writeInvoicePdfToDisk(sessionId, bytes),
  ]);
  return blobOk || diskOk;
}

export type InvoicePdfPayload = {
  bytes: Uint8Array;
  invoiceNumber: string;
};

/** Kešots PDF vai ģenerē uz vietas — bez pilnas Stripe/Blob „labošanas” bloķēšanas. */
export async function getOrBuildInvoicePdfForSession(
  sessionId: string,
): Promise<InvoicePdfPayload | null> {
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.paymentStatus !== "paid" || order.amountTotal == null) return null;

  const invoiceNumber = await getOrCreateInvoiceNumber(sessionId, order.created);
  const cached = await readInvoicePdfCached(sessionId);
  if (cached) return { bytes: cached, invoiceNumber };

  const bytes = await buildInvoicePdfBytes({
    id: order.id,
    created: order.created,
    amountTotal: order.amountTotal,
    currency: order.currency,
    customerEmail: order.customerEmail,
    customerDetailsEmail: order.customerDetailsEmail,
    vin: order.vin,
    invoiceNumber,
  });

  await writeInvoicePdfCached(sessionId, bytes);
  void upsertOrderDraftInvoiceFields(sessionId, {
    invoicePdfUrl: `/api/admin/invoice/${encodeURIComponent(sessionId)}/pdf`,
    invoicePdfGeneratedAt: new Date().toISOString(),
  });

  return { bytes, invoiceNumber };
}

/**
 * Pēc apmaksas (Stripe webhook): piešķir numuru un kešo PDF Blob + disk.
 */
export async function persistPaidOrderInvoice(sessionId: string): Promise<void> {
  try {
    if (await readInvoicePdfCached(sessionId)) return;
    const built = await getOrBuildInvoicePdfForSession(sessionId);
    if (!built) return;

    const meta = await upsertOrderDraftInvoiceFields(sessionId, {
      invoicePdfUrl: `/api/admin/invoice/${encodeURIComponent(sessionId)}/pdf`,
      invoicePdfGeneratedAt: new Date().toISOString(),
    });
    if (!meta.ok) {
      throw new Error(meta.error ?? "upsertOrderDraftInvoiceFields failed");
    }
  } catch (error) {
    console.error("[invoice-storage] Failed to persist invoice data:", error);
    throw error;
  }
}

/** @deprecated Lietot `persistPaidOrderInvoice`. */
export async function ensureInvoicePdfPersisted(sessionId: string): Promise<void> {
  await persistPaidOrderInvoice(sessionId);
}
