import type { ClientReportLang } from "@/lib/client-report-i18n";

/** Viens nosūtīts atskaites PDF (servera "Sūtīt atskaiti"). */
export type ClientReportSend = {
  version: number;
  sentAt: string;
  to: string;
  filename: string;
  lang: ClientReportLang;
  bytes: number;
  /** Privātais Blob ceļš vai diska ceļš versijas kopijai. */
  archivePath?: string;
  dropboxPath?: string;
  /** Admins apstiprināja adresi, kas atšķīrās no pasūtījumā saglabātās («Sūtīt tomēr uz šo adresi»). */
  recipientOverride?: boolean;
  /** Iepriekšējā (saglabātā) adrese maskētā veidā, ja bija `recipientOverride`. */
  previousRecipientMasked?: string;
};

export function nextClientReportVersion(prev: readonly Pick<ClientReportSend, "version">[]): number {
  return prev.reduce((m, s) => (Number.isFinite(s.version) && s.version > m ? s.version : m), 0) + 1;
}

/** "PROVIN_AUDITS_VIN.pdf", 2 -> "v2-PROVIN_AUDITS_VIN.pdf". */
export function versionedReportFilename(version: number, filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "PROVIN_atskaite.pdf";
  return `v${version}-${safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`}`;
}

/** Dropbox faila nosaukums: pirmā versija bez sufiksa, labotajām "_v2". */
export function dropboxReportFilename(version: number, filename: string): string {
  const base = filename.replace(/\.pdf$/i, "");
  return `${base}${version > 1 ? `_v${version}` : ""}.pdf`;
}

const CORRECTED_LABEL: Record<ClientReportLang, string> = {
  lv: "labota",
  en: "corrected",
  ru: "исправлено",
  de: "korrigiert",
};

/** Atkārtots sūtījums (G9): tēmā atzīme "labota" klienta valodā. */
export function correctedSubject(subject: string, lang: ClientReportLang): string {
  return `${subject} · ${CORRECTED_LABEL[lang] ?? CORRECTED_LABEL.lv}`;
}
