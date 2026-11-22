import "server-only";

import { getB2bPartnerByEmail } from "@/lib/b2b-partner-store";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import {
  REPORT_RECIPIENT_BLOCKLIST_ENV,
  evaluateReportRecipient,
  maskEmail,
  parseRecipientBlocklist,
  type ReportRecipientDecision,
} from "@/lib/report-recipient-guard";

/**
 * Dīlera e-pastu («Nosūtīt e-pastu», «Sūtīt PDF») saņēmējs - tā pati pārbaude kā «Sūtīt atskaiti»:
 * adrese nāk no pasūtījuma (melnraksts vai Stripe/manuālais ieraksts); atšķirīga adrese no pieprasījuma
 * der tikai ar skaidru apstiprinājumu un tiek ierakstīta žurnālā (maskēta).
 */
export async function resolveDealerSendRecipient(input: {
  logTag: string;
  sessionId: string;
  requested: string;
  confirmOverride: boolean;
  draftEmail: string;
  orderEmail: string;
  order: { partnerId?: string | null; notes?: string | null };
}): Promise<ReportRecipientDecision> {
  const stored =
    [input.draftEmail, input.orderEmail].map((v) => v.trim()).find((v) => v && isValidOrderEmail(v)) ?? "";
  const requested = input.requested.trim();

  let partnerWithRecipientEmail: { id: string } | null = null;
  const lookup = requested || stored;
  if (lookup && isValidOrderEmail(lookup)) {
    try {
      const p = await getB2bPartnerByEmail(lookup);
      partnerWithRecipientEmail = p ? { id: p.id } : null;
    } catch (e) {
      console.error(`[${input.logTag}] partner lookup`, e instanceof Error ? e.message.slice(0, 200) : "error");
    }
  }

  const decision = evaluateReportRecipient({
    requested,
    stored,
    confirmOverride: input.confirmOverride,
    isValidEmail: isValidOrderEmail,
    blocklist: parseRecipientBlocklist(process.env[REPORT_RECIPIENT_BLOCKLIST_ENV]),
    partnerWithRecipientEmail,
    order: input.order,
  });

  if (!decision.ok) {
    console.warn(`[${input.logTag}] recipient blocked`, { sessionId: input.sessionId, error: decision.error });
  } else if (decision.recipientOverride) {
    console.warn(`[${input.logTag}] recipient override`, {
      sessionId: input.sessionId,
      from: decision.previousRecipientMasked ?? "",
      to: maskEmail(decision.to),
    });
  }
  return decision;
}

/** Atteikuma JSON ķermenis (tāds pats kā `/api/admin/notify-report-ready`). */
export function dealerSendRecipientErrorBody(decision: Extract<ReportRecipientDecision, { ok: false }>) {
  return {
    error: decision.error,
    message: decision.message,
    ...(decision.stored ? { stored: decision.stored } : {}),
    ...(decision.requested ? { requested: decision.requested } : {}),
  };
}
