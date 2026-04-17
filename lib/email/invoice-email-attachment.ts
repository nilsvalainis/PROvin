import "server-only";

import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { buildInvoicePdfBytes } from "@/lib/invoice-pdf";
import { getOrCreateInvoiceNumber } from "@/lib/invoice-number";
import { readInvoicePdfFromDisk } from "@/lib/invoice-storage";

export type InvoiceEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: "application/pdf";
};

/**
 * Apmaksātam pasūtījumam — rēķina PDF no diska vai ģenerēts uz vietas (kā /api/admin/invoice/.../pdf).
 */
export async function getInvoiceEmailAttachment(sessionId: string): Promise<InvoiceEmailAttachment | null> {
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.paymentStatus !== "paid" || order.amountTotal == null) return null;

  const invoiceNumber = await getOrCreateInvoiceNumber(sessionId, order.created);
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "_") || "PRV";
  const filename = `rekins_${safe}.pdf`;

  const disk = await readInvoicePdfFromDisk(sessionId);
  let bytes: Uint8Array;
  if (disk) {
    bytes = disk;
  } else {
    bytes = await buildInvoicePdfBytes({
      id: order.id,
      created: order.created,
      amountTotal: order.amountTotal,
      currency: order.currency,
      customerEmail: order.customerEmail,
      customerDetailsEmail: order.customerDetailsEmail,
      vin: order.vin,
      invoiceNumber,
    });
  }

  return {
    filename,
    content: Buffer.from(bytes),
    contentType: "application/pdf",
  };
}
