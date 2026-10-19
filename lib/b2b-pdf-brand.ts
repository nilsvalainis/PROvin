/** B2B klienta PDF / e-pasts: zīmols tikai PROVIN, bez „.LV”. */

import { isPartnerHighlightAdminOrder } from "@/lib/b2b-partner-orders";

export const B2B_CLIENT_BRAND = "PROVIN";
export const B2B_CLIENT_ACCENT_HEX = "#0061D2";

/** Partnera piegādātā atskaite (ne mazumtirdzniecības PROVIN.LV). */
export function isB2bInternationalClientReport(args: {
  notes?: string | null;
  partnerId?: string | null;
  partnerCompanyName?: string | null;
}): boolean {
  return isPartnerHighlightAdminOrder(args);
}

/** „PROVIN.LV” → „PROVIN”. Adreses LV3101 un URL provinci.lv paliek. */
export function applyB2bClientBrandText(text: string): string {
  return text.replaceAll("PROVIN.LV", B2B_CLIENT_BRAND);
}

export function isB2bClientBrandText(text: string): boolean {
  return !text.includes("PROVIN.LV");
}

const B2B_CHROME_STRIP: readonly RegExp[] = [
  /Nils Valainis/gi,
  /09118711109/g,
  /Jana iela 3/gi,
  /Tukums,\s*LV3101,\s*Latvija/gi,
  /info@provin\.lv/gi,
  /https?:\/\/(?:www\.)?provin\.lv/gi,
  /(?:www\.)?provin\.lv/gi,
  /Latvijā ekspluatētiem auto/gi,
];

/**
 * B2B atskaites apvalks: zīmols PROVIN, bez LV produkta / sniedzēja rekvizītiem.
 * Transportlīdzekļa dati (piem. CSDD „Latvija”) paliek.
 */
export function applyB2bInternationalReportChrome(html: string): string {
  let out = applyB2bClientBrandText(html);
  for (const re of B2B_CHROME_STRIP) out = out.replace(re, "");
  return out;
}
