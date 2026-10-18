import "server-only";

import { getOrBuildInvoicePdfForSession } from "@/lib/invoice-storage";

export type InvoiceEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: "application/pdf";
};

/**
 * Apmaksātam pasūtījumam — rēķina PDF no diska vai ģenerēts uz vietas (kā /api/admin/invoice/.../pdf).
 */
export async function getInvoiceEmailAttachment(sessionId: string): Promise<InvoiceEmailAttachment | null> {
  const built = await getOrBuildInvoicePdfForSession(sessionId);
  if (!built) return null;
  const safe = built.invoiceNumber.replace(/[^\w.-]+/g, "_") || "rekins";
  return {
    filename: `rekins_${safe}.pdf`,
    content: Buffer.from(built.bytes),
    contentType: "application/pdf",
  };
}
