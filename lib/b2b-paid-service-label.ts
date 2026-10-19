import { parsePartnerCheckoutLineFromNotes } from "@/lib/b2b-partner-orders";
import { parseB2bWalletOrderMarks, type B2bWalletProductId } from "@/lib/b2b-wallet";

/** Adminam: ko partneris apmaksāja. Nolasām no esošajām piezīmēm, datus nepārraksta. */
export const B2B_PAID_SERVICE_LABEL_LV: Record<B2bWalletProductId, string> = {
  business: "PROVIN Business",
  dealer_raw: "Dīlera dati (RAW)",
  dealer_pro: "Dīlera dati (PRO)",
};

export function b2bPaidServiceLabelLv(args: {
  notes?: string | null;
  checkoutLine?: string | null;
}): string | null {
  const marks = parseB2bWalletOrderMarks(args.notes);
  if (marks) return B2B_PAID_SERVICE_LABEL_LV[marks.product];
  const fromNotes = parsePartnerCheckoutLineFromNotes(args.notes);
  const line = (fromNotes ?? args.checkoutLine ?? "").trim().toLowerCase();
  if (line === "dealer") return "Dīlera dati";
  if (line === "business") return "PROVIN Business";
  return null;
}
