import "server-only";

import fs from "fs/promises";
import path from "path";
import { getOrderDraftStorageDir, isSafeOrderDraftSessionId, patchOrderDraftInvoiceMetadata } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { buildInvoicePdfBytes } from "@/lib/invoice-pdf";

export function resolveInvoiceDir(): string | null {
  const base = getOrderDraftStorageDir();
  if (!base) return null;
  return path.join(base, "invoices");
}

export function invoicePdfFilePath(sessionId: string): string | null {
  const dir = resolveInvoiceDir();
  if (!dir || !isSafeOrderDraftSessionId(sessionId)) return null;
  return path.join(dir, `${sessionId}.pdf`);
}

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

/**
 * Ģenerē un saglabā PDF, ja glabātuve ieslēgta un fails vēl nav.
 * Izsaucams no Stripe webhook pēc apmaksas.
 */
export async function ensureInvoicePdfPersisted(sessionId: string): Promise<void> {
  if (!resolveInvoiceDir()) return;
  const existing = await readInvoicePdfFromDisk(sessionId);
  if (existing) return;

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.paymentStatus !== "paid" || order.amountTotal == null) return;

  const bytes = await buildInvoicePdfBytes({
    id: order.id,
    created: order.created,
    amountTotal: order.amountTotal,
    currency: order.currency,
    customerEmail: order.customerEmail,
    customerDetailsEmail: order.customerDetailsEmail,
    vin: order.vin,
  });

  const ok = await writeInvoicePdfToDisk(sessionId, bytes);
  if (!ok) return;

  const relUrl = `/api/admin/invoice/${encodeURIComponent(sessionId)}/pdf`;
  await patchOrderDraftInvoiceMetadata(sessionId, {
    invoicePdfUrl: relUrl,
    invoicePdfGeneratedAt: new Date().toISOString(),
  });
}
