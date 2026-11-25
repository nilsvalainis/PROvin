import { isPartnerVinAdminOrder } from "@/lib/b2b-partner-orders";

/** Sīks statuss zem summas manuālam pasūtījumam, kas vēl nav apmaksāts («Manuāls» ir tikai pie klienta). */
export const MANUAL_UNPAID_LABEL_LV = "nav apmaksāts";

/**
 * Manuāli izveidots pasūtījums, kas vēl nav apmaksāts (sarakstā rāda klusinātu).
 * «Apmaksāts» nosaka serveris (`manualOrderListPaymentStatus`): Stripe saite apmaksāta
 * (`paidAt` / `paidStripeSessionId`) vai partnera maka/kredīta darbs. Partnera rindas
 * šeit nekad neskaitās neapmaksātas, pat ja statuss kādreiz pienāktu citāds.
 */
export function isManualUnpaidAdminOrder(row: {
  isManual?: boolean;
  isDemo?: boolean;
  isB2bPack?: boolean;
  paymentStatus: string;
  checkoutLine?: string | null;
  vin?: string | null;
  partnerId?: string | null;
  partnerCompanyName?: string | null;
  notes?: string | null;
}): boolean {
  if (!row.isManual) return false;
  if ((row.paymentStatus ?? "").toLowerCase() === "paid") return false;
  if (
    isPartnerVinAdminOrder({
      isB2bPack: row.isB2bPack,
      isManual: row.isManual,
      isDemo: row.isDemo,
      checkoutLine: row.checkoutLine,
      vin: row.vin,
      partnerCompanyName: row.partnerCompanyName,
      partnerId: row.partnerId,
      notes: row.notes,
    })
  ) {
    return false;
  }
  return true;
}
