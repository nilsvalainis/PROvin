/** Kopīgs pasūtījuma kopsavilkums e-pastiem (admin / Stripe). */
export type OrderEmailPayload = {
  sessionId: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  vin: string | null;
  listingUrl: string | null;
  contactMethod: string | null;
  notes: string | null;
  amountTotal: string | null;
  currency: string | null;
};
