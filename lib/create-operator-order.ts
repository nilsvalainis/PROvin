import "server-only";

import { createManualOrder } from "@/lib/admin-manual-orders";
import { patchOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftOrderEdits } from "@/lib/admin-order-draft-types";
import { classifyOrderVinOrPlateInput } from "@/lib/order-vin-plate-resolution";

export type OperatorOrderFields = {
  vin: string;
  listingUrl?: string;
  email: string;
  phone: string;
  name?: string;
  notes?: string;
  partnerId?: string;
  companyName?: string;
  checkoutLine?: "business" | "dealer";
  auditPurpose?: "client" | "internal";
};

export async function createOperatorOrderWithFields(
  fields: OperatorOrderFields,
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const intake = classifyOrderVinOrPlateInput(fields.vin);
  if (intake.kind === "invalid") return { ok: false, error: "invalid_vin" };

  const created = await createManualOrder({
    amountTotal: null,
    partnerId: fields.partnerId,
    companyName: fields.companyName,
    checkoutLine: fields.checkoutLine,
    auditPurpose: fields.auditPurpose,
  });
  if (!created.ok) return created;

  const orderEdits: OrderDraftOrderEdits = {
    customerEmail: fields.email.trim(),
    customerPhone: fields.phone.trim(),
  };
  if (intake.kind === "vin") {
    orderEdits.vin = intake.vin;
  } else {
    orderEdits.licensePlate = intake.plate;
    orderEdits.vin = "";
  }
  const listing = fields.listingUrl?.trim();
  if (listing) orderEdits.listingUrl = listing;
  const name = fields.name?.trim();
  if (name) orderEdits.customerName = name;
  const notes = fields.notes?.trim();
  if (notes) orderEdits.notes = notes;

  const patched = await patchOrderDraft(created.record.id, { orderEdits });
  if (!patched.ok) {
    console.warn("[operator-order] draft seed failed", {
      orderId: created.record.id,
      error: patched.error,
    });
    return { ok: false, error: patched.error };
  }

  return { ok: true, orderId: created.record.id };
}
