import "server-only";

/**
 * Paziņojumi Nilam: e-pasts (ADMIN_NOTIFY_EMAIL) + push (tikai Nila ierīces).
 * Kļūdas tiek tikai ierakstītas žurnālā - klienta atbilde netiek apturēta.
 */

import { sendAdminPush } from "@/lib/admin-push";
import { getSiteOrigin } from "@/lib/email/mail-config";
import { sendAdminIrissOfferDecisionEmail, sendAdminIrissOfferQuestionEmail } from "@/lib/email/send-transactional";
import { irissOfferTotalLabel } from "@/lib/iriss-offer-client-link";
import {
  IRISS_OFFER_PUSH_USER_KEY,
  buildIrissOfferDecisionEmail,
  buildIrissOfferQuestionEmail,
  irissOfferDecisionPushMessage,
  irissOfferExpiredPushMessage,
  irissOfferQuestionPushMessage,
  type IrissOfferNotifyFacts,
} from "@/lib/iriss-offer-notify-shared";
import type { IrissOfferRecord, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import { getAdminOrderNotifyEmail } from "@/lib/notify";

export function irissOfferNotifyFacts(order: IrissPasutijumsRecord, offer: IrissOfferRecord): IrissOfferNotifyFacts {
  return {
    orderId: order.id,
    offerId: offer.id,
    vehicle: offer.brandModel || offer.title || order.brandModel || "",
    vin: offer.vin || order.vin || "",
    clientFirstName: order.clientFirstName ?? "",
    clientLastName: order.clientLastName ?? "",
    total: irissOfferTotalLabel(offer),
    deadlineAt: offer.validUntilAt ?? "",
  };
}

export async function notifyIrissOfferDecision(
  facts: IrissOfferNotifyFacts,
  decision: "approve" | "decline",
  decidedAt: string,
): Promise<{ email: boolean; push: number }> {
  let email = false;
  let push = 0;
  try {
    const to = getAdminOrderNotifyEmail();
    if (to) {
      email = await sendAdminIrissOfferDecisionEmail(buildIrissOfferDecisionEmail(facts, decision, decidedAt, getSiteOrigin()), to);
    }
  } catch (e) {
    console.error("[iriss-offer-notify] email", e instanceof Error ? e.message : e);
  }
  try {
    push = (await sendAdminPush(irissOfferDecisionPushMessage(facts, decision), IRISS_OFFER_PUSH_USER_KEY)).sent;
  } catch (e) {
    console.error("[iriss-offer-notify] push", e instanceof Error ? e.message : e);
  }
  return { email, push };
}

/** Nilam par klienta jautājumu publiskajā piedāvājuma saitē (e-pasts + push). */
export async function notifyIrissOfferQuestion(
  facts: IrissOfferNotifyFacts,
  question: string,
): Promise<{ email: boolean; push: number }> {
  let email = false;
  let push = 0;
  try {
    const to = getAdminOrderNotifyEmail();
    if (to) {
      email = await sendAdminIrissOfferQuestionEmail(buildIrissOfferQuestionEmail(facts, question, getSiteOrigin()), to);
    }
  } catch (e) {
    console.error("[iriss-offer-notify] question email", e instanceof Error ? e.message : e);
  }
  try {
    push = (await sendAdminPush(irissOfferQuestionPushMessage(facts), IRISS_OFFER_PUSH_USER_KEY)).sent;
  } catch (e) {
    console.error("[iriss-offer-notify] question push", e instanceof Error ? e.message : e);
  }
  return { email, push };
}

/** Termiņš beidzies bez atbildes - tikai push (bez e-pasta). */
export async function notifyIrissOfferExpired(facts: IrissOfferNotifyFacts): Promise<number> {
  try {
    return (await sendAdminPush(irissOfferExpiredPushMessage(facts), IRISS_OFFER_PUSH_USER_KEY)).sent;
  } catch (e) {
    console.error("[iriss-offer-notify] expired push", e instanceof Error ? e.message : e);
    return 0;
  }
}
