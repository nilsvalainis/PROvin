import "server-only";

/**
 * "Pagarināt" (T4): jauns termiņš piedāvājumam pasūtījumā (validUntilAt + validUntil) un tai pašai saitei.
 * Citi pasūtījuma lauki netiek mainīti; revīzijas pārbaude, kā saglabājot.
 */

import { extendIrissOfferClientLink } from "@/lib/iriss-offer-client-link-store";
import type { IrissOfferClientLinkRecord } from "@/lib/iriss-offer-client-link";
import { isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";
import { readIrissPasutijums, writeIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import {
  IRISS_OFFER_DEADLINE_ERRORS_LV,
  IRISS_OFFER_DEADLINE_MAX_DAYS,
  IRISS_OFFER_DEADLINE_MIN_LEAD_MS,
  normalizeOfferValidUntilAt,
  offerValidUntilYmdFromAt,
} from "@/lib/iriss-offer-valid-until";

export type ExtendIrissOfferResult =
  | { ok: true; record: IrissOfferClientLinkRecord; validUntilAt: string; workspaceRevision?: number }
  | { ok: false; error: "invalid" | "past" | "too_far" | "not_found" | "decided" | "store_failed"; message?: string };

/** Servera pārbaude tāda pati kā formā: >= 5 min nākotnē, <= 180 dienas. */
export function checkOfferDeadlineIso(
  raw: unknown,
  nowMs = Date.now(),
): { ok: true; iso: string } | { ok: false; error: "invalid" | "past" | "too_far"; message: string } {
  const iso = normalizeOfferValidUntilAt(raw);
  if (!iso) return { ok: false, error: "invalid", message: IRISS_OFFER_DEADLINE_ERRORS_LV.invalid };
  const ms = Date.parse(iso);
  if (ms < nowMs + IRISS_OFFER_DEADLINE_MIN_LEAD_MS) return { ok: false, error: "past", message: IRISS_OFFER_DEADLINE_ERRORS_LV.past };
  if (ms > nowMs + IRISS_OFFER_DEADLINE_MAX_DAYS * 86_400_000) {
    return { ok: false, error: "too_far", message: IRISS_OFFER_DEADLINE_ERRORS_LV.too_far };
  }
  return { ok: true, iso };
}

export async function extendIrissOfferDeadline(orderId: string, offerId: string, raw: unknown): Promise<ExtendIrissOfferResult> {
  const checked = checkOfferDeadlineIso(raw);
  if (!checked.ok) return checked;
  const iso = checked.iso;
  let written = false;
  let workspaceRevision: number | undefined;
  for (let attempt = 0; attempt < 3 && !written; attempt += 1) {
    const order = await readIrissPasutijums(orderId);
    if (!order || isIrissRecordDeleted(order)) return { ok: false, error: "not_found" };
    const offer = order.offers.find((o) => o.id === offerId);
    if (!offer) return { ok: false, error: "not_found" };
    if (normalizeOfferValidUntilAt(offer.validUntilAt) === iso) break;
    const offers = order.offers.map((o) => (o.id === offerId ? { ...o, validUntilAt: iso, validUntil: offerValidUntilYmdFromAt(iso) } : o));
    const saved = await writeIrissPasutijums({ ...order, offers }, { expectedWorkspaceRevision: irissWorkspaceRevision(order) });
    if (saved.ok) {
      written = true;
      workspaceRevision = irissWorkspaceRevision(saved.record);
    }
    else if (!saved.stale) return { ok: false, error: "store_failed" };
  }
  const link = await extendIrissOfferClientLink(orderId, offerId, iso);
  if (!link.ok) return { ok: false, error: link.error };
  return { ok: true, record: link.record, validUntilAt: iso, workspaceRevision };
}
