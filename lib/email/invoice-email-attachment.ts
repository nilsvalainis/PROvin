import "server-only";

import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { buildInvoicePdfBytes } from "@/lib/invoice-pdf";
import { toInvoiceOrderPayload } from "@/lib/generate-invoice-html";
import { getOrCreateInvoiceNumber } from "@/lib/invoice-number";
import { readInvoicePdfCached } from "@/lib/invoice-storage";

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
  if (!order || order.paymentStatus !== "paid") return null;
  if (order.amountTotal == null) {
    throw new Error(
      "Nav izdevies noteikt pasūtījuma summu no Stripe (amount_total / line_items). Pārbaudi sesiju Stripe Dashboard.",
    );
  }

  const invoiceNumber = await getOrCreateInvoiceNumber(sessionId, order.created);
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "_") || "PRV";
  const filename = `rekins_${safe}.pdf`;

  const cached = await readInvoicePdfCached(sessionId);
  let bytes: Uint8Array;
  if (cached) {
    bytes = cached;
  } else {
    bytes = await buildInvoicePdfBytes(toInvoiceOrderPayload(order, invoiceNumber));
  }

  return {
    filename,
    content: Buffer.from(bytes),
    contentType: "application/pdf",
  };
}
