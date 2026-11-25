/**
 * «Ielikt PDF arhīvā» (partneru pasūtījumi): PDF ceļo caur Vercel Blob klienta augšupielādi (Vercel funkcijas
 * pieprasījuma ķermenis ir ~4,5 MB - lielāks multipart atgriež 413 HTML lapu, un agrāk Nils redzēja tikai
 * «Neizdevās saglabāt PDF.»). Tīrs modulis - der gan klientam, gan serverim.
 */

import { NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES } from "@/lib/notify-report-email-limits";

/** Lielākais PDF, ko pieņem arhīvs (tas pats griests kā e-pasta portfelim). */
export const PARTNER_ARCHIVE_PDF_MAX_BYTES = NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES;

/** Līdz šim izmēram drīkst sūtīt tieši multipart (rezerve, ja Blob nav pieejams). */
export const PARTNER_ARCHIVE_DIRECT_MAX_BYTES = 4 * 1024 * 1024;

/** «12,4 MB» */
export function formatPdfMb(bytes: number): string {
  return `${(Math.max(0, bytes) / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function partnerArchiveTooLargeMessage(bytes: number): string {
  return `PDF ir par lielu (${formatPdfMb(bytes)}). Maksimums ${formatPdfMb(PARTNER_ARCHIVE_PDF_MAX_BYTES)}.`;
}

/** Saprotams teksts no servera atbildes (arī ja atbilde nav JSON, piem. Vercel 413 HTML). */
export function partnerArchiveErrorMessage(
  status: number,
  data: { error?: unknown; message?: unknown } | null,
  fileBytes: number,
): string {
  const msg = typeof data?.message === "string" ? data.message.trim() : "";
  if (status === 413 || data?.error === "attachments_too_large") return partnerArchiveTooLargeMessage(fileBytes);
  if (msg) return msg;
  if (status === 401) return "Admin sesija beigusies - pieslēdzies vēlreiz.";
  if (status === 404) return "Pasūtījums nav atrasts.";
  if (status >= 500) return `Serveris neatbildēja (${status}). Mēģini vēlreiz.`;
  return `Neizdevās saglabāt PDF (${status}).`;
}
