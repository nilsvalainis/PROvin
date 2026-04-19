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

/** PROVIN SELECT konsultācijas PDF nosaukums e-pasta pielikumam (bez VIN). */
export function buildProvinSelectConsultationPdfFilename(sessionId: string): string {
  const slug = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-40) || "session";
  return `PROVIN_SELECT_${slug}.pdf`;
}
