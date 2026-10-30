/**
 * Admin dīlera no_data atmaksas paziņojums.
 * B2C Stripe: atmaksa un klienta e-pasts vienā solī (Freimanis / Top Line, 2026-10-25).
 */

import { isValidOrderEmail } from "@/lib/order-field-validation";

export type DealerRefundActionKind = "stripe" | "wallet" | "credit";

export type DealerRefundEmailError = "no_recipient" | "send_failed";

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

/** Galvenā «Atgriezt maksājumu» poga: Stripe vienmēr prasa paziņojumu. */
export function buildDealerRefundRequestBody(opts: {
  sessionId: string;
  kind: DealerRefundActionKind;
}): { sessionId: string; notifyEmail: boolean } {
  return {
    sessionId: opts.sessionId,
    notifyEmail: opts.kind === "stripe",
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

export function dealerRefundConfirmMessage(kind: DealerRefundActionKind): string {
  if (kind === "wallet") {
    return "Atgriezt summu partnera atlikumā? Partneris saņems IRISS e-pastu.";
  }
  if (kind === "credit") {
    return "Atgriezt 1 dīlera kredītu partnera kontā? E-pastu sūti atsevišķi ar „Nosūtīt e-pastu”.";
  }
  return "Atgriezt maksājumu pilnā apmērā? Darbība ir neatgriezeniska. Klientam tiks nosūtīts e-pasts par atmaksu.";
}

export function dealerRefundResultNotice(opts: {
  kind: DealerRefundActionKind;
  ok: boolean;
  emailSent?: boolean;
  emailError?: DealerRefundEmailError | string | null;
  error?: string;
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
