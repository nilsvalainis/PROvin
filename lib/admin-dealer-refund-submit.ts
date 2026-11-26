/**
 * Atmaksas loga «Atgriezt X € un nosūtīt» (Nils 26.11): sūta API tieši to tekstu, ko Nils redz
 * un labo logā. Tīra loģika (fetch padod no ārpuses) - der komponentei un testiem.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import type { OrderClientMarks } from "@/lib/order-client-marks";
import { dealerStripeRefundErrorLv, type DealerRefundChannel } from "@/lib/admin-dealer-data-refund";

export type DealerStripeRefundInput = {
  sessionId: string;
  channel: DealerRefundChannel;
  subject: string;
  text: string;
  lang: ClientReportLang;
  customerEmail: string;
  override?: boolean;
  confirmRecipientOverride?: boolean;
};

export type DealerStripeRefundOutcome =
  | {
      ok: true;
      /** Nauda atgriezta; e-pasts aizgāja (vai WhatsApp jāatver ar to pašu tekstu). */
      emailSent: boolean;
      to: string | null;
      job: DealerDataJob | null;
      marks: OrderClientMarks | null;
      /** Atmaksa izdevās, bet e-pasts nē - logs paliek atvērts ar kļūdu. */
      emailError: string | null;
    }
  | {
      ok: false;
      error: string;
      message: string;
      /** 409 recipient_mismatch: jautā Nilam un sūta vēlreiz ar confirmRecipientOverride. */
      recipientMismatch?: { message: string; requested: string };
      job: DealerDataJob | null;
    };

/** API ķermenis: bez teksta atmaksu neveic (serveris to pārbauda vēlreiz). */
export function buildDealerStripeRefundBody(input: DealerStripeRefundInput): Record<string, unknown> {
  return {
    sessionId: input.sessionId,
    channel: input.channel,
    subject: input.channel === "email" ? input.subject.trim() : "",
    text: input.text.trim(),
    lang: input.lang,
    ...(input.channel === "email" ? { customerEmail: input.customerEmail.trim() } : {}),
    ...(input.override ? { override: true } : {}),
    ...(input.confirmRecipientOverride ? { confirmRecipientOverride: true } : {}),
  };
}

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

export async function submitDealerStripeRefund(
  input: DealerStripeRefundInput,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
): Promise<DealerStripeRefundOutcome> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl("/api/admin/dealer-data/refund", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDealerStripeRefundBody(input)),
    });
  } catch {
    return { ok: false, error: "network", message: "Neizdevās sazināties ar serveri. Atmaksa NAV veikta.", job: null };
  }
  const body = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const job = (body.job as DealerDataJob | null | undefined) ?? null;
  if (!res.ok || body.ok !== true) {
    const error = typeof body.error === "string" ? body.error : `http_${res.status}`;
    if (res.status === 409 && error === "recipient_mismatch") {
      const message = typeof body.message === "string" ? body.message : "Saņēmējs atšķiras no pasūtījumā saglabātā.";
      return {
        ok: false,
        error,
        message,
        recipientMismatch: { message, requested: typeof body.requested === "string" ? body.requested : input.customerEmail },
        job,
      };
    }
    const detail = typeof body.detail === "string" ? body.detail : null;
    const message = typeof body.message === "string" && body.message ? body.message : dealerStripeRefundErrorLv(error, detail);
    return { ok: false, error, message, job };
  }
  return {
    ok: true,
    emailSent: body.emailSent === true,
    to: typeof body.to === "string" ? body.to : null,
    job,
    marks: (body.marks as OrderClientMarks | undefined) ?? null,
    emailError: typeof body.emailError === "string" ? body.emailError : null,
  };
}
