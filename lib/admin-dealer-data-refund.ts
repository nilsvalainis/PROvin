/**
 * Admin dīlera no_data atmaksas paziņojums.
 * B2C Stripe: atmaksa un klienta e-pasts vienā solī (Freimanis / Top Line, 2026-10-25).
 * B2B: poga arī pie failed / trūkstoša job; tad API saņem override: true.
 */

import type { DealerDataJob } from "@/lib/dealer-data-job-types";
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
  return opts.job.status === "no_data" || opts.job.status === "failed";
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

/**
 * Stripe B2C: sūtīt klienta e-pastu, ja vien operators nav skaidri atslēdzis.
 * Izlaists / undefined = sūtīt (iepriekšējais opt-in `=== true` izlaida paziņojumu).
 */
export function shouldSendDealerStripeRefundEmail(notifyEmail: unknown): boolean {
  return notifyEmail !== false;
}

export type DealerRefundRequestBody = {
  sessionId: string;
  notifyEmail: boolean;
  override?: true;
};

/** Galvenā «Atgriezt maksājumu» poga: Stripe vienmēr prasa paziņojumu. */
export function buildDealerRefundRequestBody(opts: {
  sessionId: string;
  kind: DealerRefundActionKind;
  override?: boolean;
  /** Stripe: operatora izvēle (noklusējums - sūtīt). */
  notifyEmail?: boolean;
}): DealerRefundRequestBody {
  return {
    sessionId: opts.sessionId,
    notifyEmail: opts.kind === "stripe" && opts.notifyEmail !== false,
    ...(opts.override ? { override: true as const } : {}),
  };
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
        : "Atgriezt maksājumu pilnā apmērā? Darbība ir neatgriezeniska. Nākamajā solī izvēlēsies, vai sūtīt klientam e-pastu.";
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

/** C2 (Nils 06.11): atmaksai viens e-pasts - izvēle pēc apstiprinājuma. */
export const DEALER_REFUND_EMAIL_CHOICE_PROMPT =
  "E-pasts klientam par atmaksu:\nOK - atmaksāt un nosūtīt e-pastu\nAtcelt - atmaksāt BEZ e-pasta (atmaksa tik un tā tiks veikta)";

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
