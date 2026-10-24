import type { ClientReportLang } from "@/lib/client-report-i18n";
import type { CheckoutLineKind } from "@/lib/stripe-session";

/**
 * Klienta audita PDF pielikuma standarta nosaukums.
 * Formāts: PROVIN_AUDITS_<VIN>.pdf, PROVIN_MINI_<VIN>.pdf, PROVIN_BUSINESS_<VIN>.pdf
 * vai OFICIALA_DILERA_DATI_<VIN>.pdf
 * (atkarībā no pasūtītā produkta vai dīlera-only ģenerēšanas; VIN - tikai burti un cipari, lielie burti).
 */

/** "" latviski, citādi "_EN" / "_RU" / "_DE" pirms ".pdf" (tā pati konvencija, kas drukas PDF nosaukumam). */
export function reportLangFilenameSuffix(lang?: ClientReportLang | null): string {
  if (lang === "en") return "_EN";
  if (lang === "ru") return "_RU";
  if (lang === "de") return "_DE";
  return "";
}

function withReportLangSuffix(filename: string, lang?: ClientReportLang | null): string {
  const suffix = reportLangFilenameSuffix(lang);
  return suffix ? filename.replace(/\.pdf$/i, `${suffix}.pdf`) : filename;
}

export type ProvinAuditPdfProductBrand =
  | "PROVIN_AUDITS"
  | "PROVIN_MINI"
  | "PROVIN_DILERIS"
  | "PROVIN_BUSINESS";

/** MINI = 39,99 €; AUDITS = 99,99 € (un vecāki 79,99 € audit pasūtījumi). */
const MINI_AMOUNT_CENTS = 3999;

export function resolveProvinAuditPdfProductBrand(args: {
  checkoutLine?: CheckoutLineKind | string | null;
  amountTotalCents?: number | null;
}): ProvinAuditPdfProductBrand {
  const line = (args.checkoutLine ?? "").toString().trim().toLowerCase();
  if (line === "mini" || line === "plus" || line === "listing_filter") return "PROVIN_MINI";
  if (line === "premium" || line === "audit" || line === "audits") return "PROVIN_AUDITS";
  // Dealer / SELECT / unknown - pēc summas; 39,99 € = MINI.
  if (args.amountTotalCents === MINI_AMOUNT_CENTS) return "PROVIN_MINI";
  return "PROVIN_AUDITS";
}

export function buildProvinAuditPdfFilename(
  vin: string | null | undefined,
  product?: {
    checkoutLine?: CheckoutLineKind | string | null;
    amountTotalCents?: number | null;
    brand?: ProvinAuditPdfProductBrand | null;
    lang?: ClientReportLang | null;
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
  return withReportLangSuffix(`${brand}_${slug}.pdf`, product?.lang);
}

/** PROVIN SELECT konsultācijas PDF nosaukums e-pasta pielikumam (bez VIN). */
export function buildProvinSelectConsultationPdfFilename(sessionId: string): string {
  const slug = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-40) || "session";
  return `PROVIN_SELECT_${slug}.pdf`;
}

/** Tikai OFICIĀLĀ DĪLERA DATI, bez citiem avotiem. */
export function buildProvinDilerisPdfFilename(
  vin: string | null | undefined,
  lang?: ClientReportLang | null,
): string {
  const v = (vin ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slug = v.length > 0 ? v : "NAV_VIN";
  return withReportLangSuffix(`OFICIALA_DILERA_DATI_${slug}.pdf`, lang);
}

/** OEM-stila dīlera API izdruka (atsevišķs fails). */
export function buildOemDealerPdfFilename(vin: string | null | undefined): string {
  const v = (vin ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slug = v.length > 0 ? v : "NAV_VIN";
  return `OEM_DILERA_DATI_${slug}.pdf`;
}

/** PROVIN BUSINESS datu atskaite (tā pati atskaite, cits virsraksts). */
export function buildProvinBusinessPdfFilename(vin: string | null | undefined): string {
  return buildProvinAuditPdfFilename(vin, { brand: "PROVIN_BUSINESS" });
}

/** Tikai ASV vēsture (VIN Audit / PROVIN noformējums). */
export function buildProvinAsvPdfFilename(vin: string | null | undefined): string {
  const v = (vin ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slug = v.length > 0 ? v : "NAV_VIN";
  return `PROVIN_ASV_${slug}.pdf`;
}
