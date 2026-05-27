import type { OrderDraftOrderEdits } from "@/lib/admin-order-draft-types";

export type OrderDraftTableSummary = {
  orderEdits: OrderDraftOrderEdits;
  invoicePdfUrl: string | null;
};

/** Vieglā parsēšana admin tabulai — bez workspace hydrate. */
export function extractOrderDraftTableSummary(raw: unknown): OrderDraftTableSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const orderEdits: OrderDraftOrderEdits = {};
  if (o.orderEdits && typeof o.orderEdits === "object") {
    const e = o.orderEdits as Record<string, unknown>;
    if (typeof e.vin === "string") orderEdits.vin = e.vin;
    if (typeof e.listingUrl === "string") orderEdits.listingUrl = e.listingUrl;
    if (typeof e.customerName === "string") orderEdits.customerName = e.customerName;
    if (typeof e.customerEmail === "string") orderEdits.customerEmail = e.customerEmail;
    if (typeof e.customerPhone === "string") orderEdits.customerPhone = e.customerPhone;
    if (typeof e.contactMethod === "string") orderEdits.contactMethod = e.contactMethod;
    if (typeof e.notes === "string") orderEdits.notes = e.notes;
    if (typeof e.internalComment === "string") orderEdits.internalComment = e.internalComment;
    if (typeof e.mileageComment === "string") orderEdits.mileageComment = e.mileageComment;
  }
  const invoicePdfUrl = typeof o.invoicePdfUrl === "string" ? o.invoicePdfUrl : null;
  if (Object.keys(orderEdits).length === 0 && !invoicePdfUrl) return null;
  return { orderEdits, invoicePdfUrl };
}
