/**
 * Klienta audita PDF pielikuma standarta nosaukums e-pastā.
 * Formāts: PROVIN_AUDITS_<VIN>.pdf (VIN — tikai burti un cipari, lielie burti).
 * Piem.: PROVIN_AUDITS_VSSZZZ5PZ7R010576
 */
export function buildProvinAuditPdfFilename(vin: string | null | undefined): string {
  const v = (vin ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slug = v.length > 0 ? v : "NAV_VIN";
  return `PROVIN_AUDITS_${slug}.pdf`;
}
