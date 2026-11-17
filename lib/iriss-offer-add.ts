import "server-only";

/**
 * Jauna piedāvājuma pievienošana esošam (klienta) pasūtījumam.
 * Citi pasūtījuma lauki un esošie piedāvājumi netiek mainīti. Esošu piedāvājumu pārcelt nevar (Nila atbilde 8).
 */

import { isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";
import { readIrissPasutijums, writeIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { IRISS_MAX_OFFER_ATTACHMENTS, type IrissOfferRecord, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export type AddIrissOfferResult =
  | { ok: true; record: IrissPasutijumsRecord; offerId: string }
  | { ok: false; error: "not_found" | "exists" | "invalid" | "too_many" | "store_failed" };

const OFFER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function addIrissOfferToOrder(orderId: string, offer: IrissOfferRecord): Promise<AddIrissOfferResult> {
  if (!offer || !OFFER_ID_RE.test(offer.id)) return { ok: false, error: "invalid" };
  if (offer.attachments.length > IRISS_MAX_OFFER_ATTACHMENTS) return { ok: false, error: "too_many" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const order = await readIrissPasutijums(orderId);
    if (!order || isIrissRecordDeleted(order)) return { ok: false, error: "not_found" };
    if (order.offers.some((o) => o.id === offer.id)) return { ok: false, error: "exists" };
    if (order.offers.length >= 30) return { ok: false, error: "too_many" };
    const now = new Date().toISOString();
    const added: IrissOfferRecord = {
      ...offer,
      title: `Piedāvājums ${order.offers.length + 1}`,
      createdAt: offer.createdAt || now,
      updatedAt: now,
    };
    const saved = await writeIrissPasutijums(
      { ...order, offers: [...order.offers, added] },
      { expectedWorkspaceRevision: irissWorkspaceRevision(order) },
    );
    if (saved.ok) return { ok: true, record: saved.record, offerId: added.id };
    if (!saved.stale) return { ok: false, error: "store_failed" };
  }
  return { ok: false, error: "store_failed" };
}
