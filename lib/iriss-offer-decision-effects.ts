import "server-only";

/**
 * Klienta lēmuma sekas (tikai uzvarējušajam lēmumam - pirmajam ierakstam).
 * Pēc "Apstiprināt" pasūtījuma statuss automātiski -> "Rezervēts" (Nila lēmums 23.10 21:01).
 * Nilam e-pasts + push (tikai uzvarētājam - nav dubultu e-pastu).
 * Kļūdas nekad neaptur atbildi klientam.
 */

import { appendIrissStatusHistory, isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { irissOfferNotifyFacts, notifyIrissOfferDecision } from "@/lib/iriss-offer-notify";
import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";
import { readIrissPasutijums, writeIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import type { IrissPasutijumsListStatus, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

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
  }
}
