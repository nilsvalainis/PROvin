/**
 * «Datu nav» admina paziņojuma konteksts (tīra loģika, bez server-only, lai to var testēt).
 * - Stripe jau atmaksāts (charge.amount_refunded > 0) -> nesūtīt.
 * - B2B maka pasūtījums ar automātisko atmaksu: ja atmaksa izdevās, darbā jau ir `refund`
 *   un paziņojums netiek sūtīts; ja nē - paziņojumā maka summa un norāde «makā».
 * - Citādi summa = dīlera datu cena (24,99 €).
 */
import {
  B2B_WALLET_PRODUCTS,
  formatB2bWalletEuro,
  parseB2bWalletOrderMarks,
} from "@/lib/b2b-wallet";
import { DEALER_DATA_ALERT_DEFAULT_AMOUNT } from "@/lib/dealer-data-job-types";

export type DealerNoDataAlertContext =
  | { send: false; reason: "stripe_refunded" }
  | { send: true; amountLabel: string; wallet: boolean };

export function resolveDealerNoDataAlertContext(args: {
  notes?: string | null;
  stripeRefundedCents?: number | null;
}): DealerNoDataAlertContext {
  if (typeof args.stripeRefundedCents === "number" && args.stripeRefundedCents > 0) {
    return { send: false, reason: "stripe_refunded" };
  }
  const marks = parseB2bWalletOrderMarks(args.notes);
  if (marks) {
    const cents =
      typeof marks.priceCents === "number" && Number.isFinite(marks.priceCents) && marks.priceCents > 0
        ? marks.priceCents
        : B2B_WALLET_PRODUCTS[marks.product].defaultCents;
    return { send: true, amountLabel: formatB2bWalletEuro(cents), wallet: true };
  }
  return { send: true, amountLabel: DEALER_DATA_ALERT_DEFAULT_AMOUNT, wallet: false };
}
