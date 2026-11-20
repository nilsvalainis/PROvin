import "server-only";

/**
 * Klienta lēmuma sekas (tikai uzvarējušajam lēmumam - pirmajam ierakstam).
 * Pēc "Apstiprināt" pasūtījuma statuss automātiski -> "Rezervēts" (Nila lēmums 23.10 21:01).
 * Nilam e-pasts + push (tikai uzvarētājam - nav dubultu e-pastu).
 * Kļūdas nekad neaptur atbildi klientam.
 */

import { appendIrissStatusHistory, isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { irissOfferCarReserveText } from "@/lib/iriss-offer-car-conflict";
import { irissOfferNotifyFacts, notifyIrissOfferDecision } from "@/lib/iriss-offer-notify";
import { irissOfferOrderAdminPath } from "@/lib/iriss-offer-notify-shared";
import { reserveAutoparksCarForApprovedOffer } from "@/lib/iriss-piedavajumi-approve";
import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";
import { readIrissPasutijums, writeIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import type { IrissOfferRecord, IrissPasutijumsListStatus, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export const IRISS_OFFER_DECISION_ACTOR = "Klients (piedāvājuma saite)";

const KEEP_STATUS_ON_APPROVE: ReadonlySet<IrissPasutijumsListStatus> = new Set(["reserved", "completed"]);

/** Pasūtījums pēc apstiprinājuma vai null, ja statuss nav jāmaina. */
export function irissOrderAfterOfferApproval(
  order: IrissPasutijumsRecord,
  approvedAt: string,
): IrissPasutijumsRecord | null {
  if (isIrissRecordDeleted(order)) return null;
  if (KEEP_STATUS_ON_APPROVE.has(order.listStatus)) return null;
  return appendIrissStatusHistory(order, "reserved", { at: approvedAt, by: IRISS_OFFER_DECISION_ACTOR });
}

export async function reserveIrissOrderAfterApproval(orderId: string, approvedAt: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const order = await readIrissPasutijums(orderId);
    if (!order) return false;
    const next = irissOrderAfterOfferApproval(order, approvedAt);
    if (!next) return false;
    const saved = await writeIrissPasutijums(next, {
      expectedWorkspaceRevision: irissWorkspaceRevision(order),
      historyBy: IRISS_OFFER_DECISION_ACTOR,
    });
    if (saved.ok) return true;
    if (!saved.stale) return false;
  }
  return false;
}

export async function runIrissOfferDecisionEffects(input: {
  orderId: string;
  offerId: string;
  decision: "approve" | "decline";
  decidedAt: string;
}): Promise<void> {
  let order: IrissPasutijumsRecord | null = null;
  try {
    order = await readIrissPasutijums(input.orderId);
  } catch (e) {
    console.error("[iriss-offer-decision] read", e instanceof Error ? e.message : e);
  }
  const offer = order?.offers.find((item) => item.id === input.offerId);
  if (order && offer) {
    await notifyIrissOfferDecision(irissOfferNotifyFacts(order, offer), input.decision, input.decidedAt);
  }
  if (input.decision === "approve") {
    try {
      await reserveIrissOrderAfterApproval(input.orderId, input.decidedAt);
    } catch (e) {
      console.error("[iriss-offer-decision] reserve", e instanceof Error ? e.message : e);
    }
    if (order && offer) await reserveOfferSourceCar(order, offer, input.decidedAt);
  }
}

/**
 * Audits 20.11: vecās formas piedāvājums no Autoparka (`autoparks:ID`) rezervē auto tāpat kā jaunais PD
 * (tā pati funkcija un konfliktu noteikumi). Rezultāts - pasūtījuma iekšējā piezīmē (tur, kur admins to redz).
 */
async function reserveOfferSourceCar(order: IrissPasutijumsRecord, offer: IrissOfferRecord, at: string): Promise<void> {
  const carId = irissOfferAutoparksCarId(offer.sourceRef);
  if (!carId) return;
  try {
    const facts = irissOfferNotifyFacts(order, offer);
    const outcome = await reserveAutoparksCarForApprovedOffer(carId, {
      offerId: offer.id,
      label: IRISS_OFFER_DECISION_ACTOR,
      vehicle: facts.vehicle,
      vin: facts.vin,
      adminPath: irissOfferOrderAdminPath(order.id),
    });
    await appendIrissOrderInternalNote(order.id, `${irissOfferCarReserveText(outcome)} (piedāvājums ${offer.title || facts.vehicle || offer.id}, ${at.slice(0, 10)}).`);
  } catch (e) {
    console.error("[iriss-offer-decision] reserve autoparks", e instanceof Error ? e.message : e);
  }
}

/** Autoparka auto id no vecās formas piedāvājuma avota; citiem avotiem - tukšs. */
export function irissOfferAutoparksCarId(sourceRef: string | undefined): string {
  const m = /^autoparks:([\w-]{1,80})$/.exec((sourceRef ?? "").trim());
  return m ? m[1]! : "";
}

async function appendIrissOrderInternalNote(orderId: string, note: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const order = await readIrissPasutijums(orderId);
    if (!order || isIrissRecordDeleted(order)) return false;
    const next = { ...order, internalNotes: [order.internalNotes.trim(), note].filter(Boolean).join("\n") };
    const saved = await writeIrissPasutijums(next, {
      expectedWorkspaceRevision: irissWorkspaceRevision(order),
      historyBy: IRISS_OFFER_DECISION_ACTOR,
    });
    if (saved.ok) return true;
    if (!saved.stale) return false;
  }
  return false;
}
