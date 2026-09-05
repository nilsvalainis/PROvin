import type { CheckoutLineKind } from "@/lib/stripe-session";

/**
 * Klienta audita PDF pielikuma standarta nosaukums.
 * Formāts: PROVIN_AUDITS_<VIN>.pdf, PROVIN_MINI_<VIN>.pdf vai OFICIALA_DILERA_DATI_<VIN>.pdf
 * (atkarībā no pasūtītā produkta vai dīlera-only ģenerēšanas; VIN — tikai burti un cipari, lielie burti).
 */

export type ProvinAuditPdfProductBrand = "PROVIN_AUDITS" | "PROVIN_MINI" | "PROVIN_DILERIS";

/** MINI = 39,99 €; AUDITS = 99,99 € (un vecāki 79,99 € audit pasūtījumi). */
const MINI_AMOUNT_CENTS = 3999;

export function resolveProvinAuditPdfProductBrand(args: {
  checkoutLine?: CheckoutLineKind | string | null;
  amountTotalCents?: number | null;
}): ProvinAuditPdfProductBrand {
  const line = (args.checkoutLine ?? "").toString().trim().toLowerCase();
  if (line === "mini" || line === "plus" || line === "listing_filter") return "PROVIN_MINI";
  if (line === "premium" || line === "audit") return "PROVIN_AUDITS";
  // Dealer / SELECT / unknown — pēc summas; 39,99 € = MINI.
  if (args.amountTotalCents === MINI_AMOUNT_CENTS) return "PROVIN_MINI";
  return "PROVIN_AUDITS";
}

export function buildProvinAuditPdfFilename(
  vin: string | null | undefined,
  product?: {
    checkoutLine?: CheckoutLineKind | string | null;
    amountTotalCents?: number | null;
    brand?: ProvinAuditPdfProductBrand | null;
  },
): string {
  const brand =
    product?.brand ??
    resolveProvinAuditPdfProductBrand({
      checkoutLine: product?.checkoutLine,
      amountTotalCents: product?.amountTotalCents,
    });
  const v = (vin ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slug = v.length > 0 ? v : "NAV_VIN";
  return `${brand}_${slug}.pdf`;
}

/** PROVIN SELECT konsultācijas PDF nosaukums e-pasta pielikumam (bez VIN). */
export function buildProvinSelectConsultationPdfFilename(sessionId: string): string {
  const slug = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-40) || "session";
  return `PROVIN_SELECT_${slug}.pdf`;
}

/** Tikai OFICIĀLĀ DĪLERA DATI, bez citiem avotiem. */
export function buildProvinDilerisPdfFilename(vin: string | null | undefined): string {
  const v = (vin ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slug = v.length > 0 ? v : "NAV_VIN";
  return `OFICIALA_DILERA_DATI_${slug}.pdf`;
}
