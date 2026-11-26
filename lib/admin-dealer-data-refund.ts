/**
 * Admin dīlera no_data atmaksas paziņojums.
 * B2C Stripe (Nils 26.11): automātiski NEKAD. Poga «Atgriezt maksājumu» atver logu (summa, kanāls,
 * klienta valodā sagatavots temats + teksts, priekšskats); tikai pēc «Atgriezt X € un nosūtīt»
 * notiek Stripe atmaksa un aiziet Nila apstiprinātais (rediģētais) teksts.
 * B2B: poga arī pie failed / trūkstoša job; tad API saņem override: true.
 */

import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import { formatEurFromCents } from "@/lib/order-upsell";
import { isValidOrderEmail } from "@/lib/order-field-validation";

export type DealerRefundActionKind = "stripe" | "wallet" | "credit";

export type DealerRefundEmailError = "no_recipient" | "send_failed";

export type DealerRefundJobView = Pick<DealerDataJob, "status"> & {
  refund?: unknown;
};

/** Poga: canRefund, vēl nav atmaksāts, un no_data / failed / job nav. */
export function shouldShowDealerRefundButton(opts: {
  canRefund?: boolean;
  job: DealerRefundJobView | null;
}): boolean {
  if (!opts.canRefund) return false;
  if (opts.job?.refund) return false;
  if (!opts.job) return true;
  return opts.job.status === "no_data" || opts.job.status === "failed" || opts.job.status === "no_vin";
}

/** API `override: true`, ja statuss nav tīrs no_data (failed vai job nav). */
export function dealerRefundNeedsOverride(job: DealerRefundJobView | null): boolean {
  return job == null || job.status !== "no_data";
}

export function resolveDealerRefundActionKind(opts: {
  sessionId: string;
  walletRefund?: boolean;
}): DealerRefundActionKind {
  if (opts.walletRefund) return "wallet";
  if (opts.sessionId.startsWith("manual_order_")) return "credit";
  return "stripe";
}

export type DealerRefundRequestBody = {
  sessionId: string;
  override?: true;
};

/** B2B kredīts / maks: esošais ceļš (B2C Stripe iet caur atmaksas logu, sk. `parseDealerStripeRefundMessage`). */
export function buildDealerRefundRequestBody(opts: {
  sessionId: string;
  kind: DealerRefundActionKind;
  override?: boolean;
}): DealerRefundRequestBody {
  return {
    sessionId: opts.sessionId,
    ...(opts.override ? { override: true as const } : {}),
  };
}

export type DealerRefundChannel = "email" | "whatsapp";

/** Nila apstiprinātais teksts, ko Stripe atmaksas API saņem no loga. */
export type DealerStripeRefundMessage = {
  channel: DealerRefundChannel;
  subject: string;
  text: string;
  lang: ClientReportLang;
};

export const DEALER_REFUND_SUBJECT_MAX = 180;
export const DEALER_REFUND_TEXT_MAX = 12_000;

export type DealerStripeRefundMessageError = "channel_required" | "subject_required" | "text_required";

/**
 * Stripe atmaksa bez loga teksta nav iespējama (Nils 26.11): kanāls obligāts, tekstam jābūt,
 * e-pastam arī temats. Bez tā API atmaksu neveic (vecais «uzreiz + šablons» ceļš slēgts).
 */
export function parseDealerStripeRefundMessage(
  o: Record<string, unknown>,
): { ok: true; message: DealerStripeRefundMessage } | { ok: false; error: DealerStripeRefundMessageError } {
  const channel = o.channel === "email" || o.channel === "whatsapp" ? o.channel : null;
  if (!channel) return { ok: false, error: "channel_required" };
  const text = String(o.text ?? "").replace(/\r\n/g, "\n").trim().slice(0, DEALER_REFUND_TEXT_MAX);
  if (!text) return { ok: false, error: "text_required" };
  const subject = String(o.subject ?? "").trim().slice(0, DEALER_REFUND_SUBJECT_MAX);
  if (channel === "email" && !subject) return { ok: false, error: "subject_required" };
  const rawLang = String(o.lang ?? "").trim().toLowerCase();
  const lang = (CLIENT_REPORT_LANGS as readonly string[]).includes(rawLang) ? (rawLang as ClientReportLang) : "lv";
  return { ok: true, message: { channel, subject: channel === "email" ? subject : "", text, lang } };
}

/** LV e-pasta fakti (summa uz karti, 1-7 dienas bankā) - kā agrāk atmaksas e-pastā; citās valodās nav. */
export function dealerRefundEmailFacts(lang: string, amountCents: number): { value: string; label: string }[] {
  if (lang !== "lv" || !(amountCents > 0)) return [];
  return [
    { value: formatEurFromCents(amountCents), label: "atmaksāts uz karti" },
    { value: "1-7", label: "dienas bankā" },
  ];
}

/** Galvenā loga poga: «Atgriezt 17,49 € un nosūtīt» (WhatsApp - «un atvērt WhatsApp»). */
export function dealerStripeRefundButtonLabel(amountCents: number | null | undefined, channel: DealerRefundChannel): string {
  const amount = typeof amountCents === "number" && amountCents > 0 ? `${formatEurFromCents(amountCents)} ` : "";
  return channel === "whatsapp" ? `Atgriezt ${amount}un atvērt WhatsApp` : `Atgriezt ${amount}un nosūtīt`;
}

/** API kļūdas kods -> īss teksts logā (latviski). */
export function dealerStripeRefundErrorLv(code: string | null | undefined, detail?: string | null): string {
  switch (code) {
    case "already_refunded":
      return "Šis pasūtījums jau ir atmaksāts - otrreiz atmaksāt nevar.";
    case "refund_in_progress":
      return "Atmaksa jau notiek (cits pieprasījums). Pagaidi minūti un atjauno lapu.";
    case "refund_failed":
      return `Stripe atmaksa neizdevās - e-pasts NAV nosūtīts.${detail ? ` (${detail})` : ""}`;
    case "not_no_data":
      return "Ielases statuss nav «datu nav» - atmaksa šeit nav atļauta.";
    case "not_paid":
      return "Pasūtījums nav apmaksāts.";
    case "amount_above_cap":
      return "Summa pārsniedz dīlera datu cenu - atmaksā Stripe pārvaldē.";
    case "amount_missing":
      return "Nav zināma samaksātā summa.";
    case "payment_intent_missing":
      return "Stripe maksājums nav atrasts.";
    case "no_recipient":
    case "invalid_customer_email":
      return "Nav derīga klienta e-pasta (sadaļa «Klienta dati»).";
    case "subject_required":
      return "Temats ir tukšs.";
    case "text_required":
      return "Teksts ir tukšs.";
    case "channel_required":
      return "Izvēlies kanālu.";
    case "store_error":
      return "Neizdevās saglabāt stāvokli - atmaksa netika sākta. Mēģini vēlreiz.";
    default:
      return code ? `Atmaksa neizdevās: ${code}` : "Atmaksa neizdevās.";
  }
}

export function resolveDealerRefundClientEmail(
  candidates: Array<string | null | undefined>,
): string {
  for (const raw of candidates) {
    const to = (raw ?? "").trim();
    if (to && isValidOrderEmail(to)) return to;
  }
  return "";
}

const DEALER_REFUND_OVERRIDE_CONFIRM =
  "Ielases statuss nav «nav datu» (kļūda vai ielase nav palaista). Atmaksa tiks veikta ar override ārpus parastā «nav datu» nosacījuma.";

export function dealerRefundConfirmMessage(
  kind: DealerRefundActionKind,
  opts?: { override?: boolean },
): string {
  const base =
    kind === "wallet"
      ? "Atgriezt summu partnera atlikumā? Partneris saņems IRISS e-pastu."
      : kind === "credit"
        ? "Atgriezt 1 dīlera kredītu partnera kontā? E-pastu sūti atsevišķi ar „Nosūtīt e-pastu”."
        : "Atgriezt maksājumu pilnā apmērā? Darbība ir neatgriezeniska.";
  if (!opts?.override) return base;
  return `${DEALER_REFUND_OVERRIDE_CONFIRM} ${base}`;
}

/** Viena vieta: confirm teksts + API ķermenis (override tikai failed / bez job). */
export function planDealerRefund(opts: {
  sessionId: string;
  walletRefund?: boolean;
  job: DealerRefundJobView | null;
}): {
  kind: DealerRefundActionKind;
  override: boolean;
  confirmMessage: string;
  requestBody: DealerRefundRequestBody;
} {
  const kind = resolveDealerRefundActionKind(opts);
  const override = dealerRefundNeedsOverride(opts.job);
  return {
    kind,
    override,
    confirmMessage: dealerRefundConfirmMessage(kind, { override }),
    requestBody: buildDealerRefundRequestBody({
      sessionId: opts.sessionId,
      kind,
      override,
    }),
  };
}

export function dealerRefundResultNotice(opts: {
  kind: DealerRefundActionKind;
  ok: boolean;
  emailSent?: boolean;
  emailError?: DealerRefundEmailError | string | null;
  error?: string;
  /** Operators izvēlējās atmaksu bez e-pasta. */
  emailSkipped?: boolean;
}): string {
  if (!opts.ok) {
    return `Atmaksa neizdevās: ${opts.error ?? "nezināma kļūda"}`;
  }
  if (opts.kind === "wallet") {
    return opts.emailSent
      ? "Summa atgriezta partnera atlikumā. IRISS e-pasts nosūtīts."
      : "Summa atgriezta partnera atlikumā. E-pastu nesanāca nosūtīt, mēģini pogu vēlreiz.";
  }
  if (opts.kind === "credit") {
    return "Kredīts atgriezts partnera kontā. Nosūti e-pastu ar „Nosūtīt e-pastu”, ja vajag.";
  }
  if (opts.emailSent) {
    return "Atmaksa veikta. E-pasts nosūtīts klientam.";
  }
  if (opts.emailSkipped) {
    return "Atmaksa veikta bez e-pasta (Tava izvēle).";
  }
  if (opts.emailError === "no_recipient") {
    return "Atmaksa veikta, bet klienta e-pasta nav. Ieraksti adresi un nosūti ar „Nosūtīt e-pastu”.";
  }
  return "Atmaksa veikta, bet e-pastu nesanāca nosūtīt. Nosūti ar „Nosūtīt e-pastu”.";
}

/** E-pasta dialogs pēc atmaksas: tikai ja paziņojums nav aizgājis. */
export function shouldOpenDealerRefundEmailSheet(opts: {
  kind: DealerRefundActionKind;
  ok: boolean;
  emailSent?: boolean;
}): boolean {
  if (!opts.ok) return false;
  if (opts.kind === "wallet") return false;
  if (opts.kind === "credit") return true;
  return opts.emailSent !== true;
}

export function dealerRefundEmailSheetHint(opts: {
  kind: DealerRefundActionKind;
  emailSent?: boolean;
}): string | null {
  if (opts.kind === "stripe" && opts.emailSent !== true) {
    return "Atmaksa jau veikta, bet e-pasts nav nosūtīts. Pārbaudi adresi un nospied „Nosūtīt”.";
  }
  return null;
}

/** Brīdinājums pirms otra e-pasta par to pašu atmaksu. */
export function dealerRefundEmailAlreadySentPrompt(refund: { emailSentAt?: string } | null | undefined): string | null {
  const at = (refund?.emailSentAt ?? "").trim();
  if (!at) return null;
  const d = new Date(at);
  const when = Number.isNaN(d.getTime())
    ? at
    : d.toLocaleString("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `E-pasts par šo atmaksu jau nosūtīts (${when}). Sūtīt vēlreiz?`;
}
