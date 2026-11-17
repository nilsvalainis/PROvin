import { isSafeAdminOrderId } from "@/lib/admin-source-pdf-blob-constants";

/** Vercel Blob prefikss servera PDF izmēģinājumam: HTML ievade un gatavais PDF (privāti). */
export const REPORT_PDF_BLOB_PREFIX = "admin-report-pdf";

/** Atskaites HTML ar foto data-URL var būt vairāki MB; Vercel API ķermeņa limits ~4.5 MB, tāpēc caur Blob. */
export const REPORT_PDF_MAX_HTML_BYTES = 60 * 1024 * 1024;

export function reportPdfPathPrefix(sessionId: string): string {
  return `${REPORT_PDF_BLOB_PREFIX}/${sessionId.trim()}/`;
}

/** Ceļš drīkst būt tikai šī pasūtījuma mapē, bez `..`. */
export function isReportPdfPathname(sessionId: string, pathname: string, ext: ".html" | ".pdf"): boolean {
  if (!isSafeAdminOrderId(sessionId)) return false;
  const p = pathname.trim();
  if (!p.startsWith(reportPdfPathPrefix(sessionId)) || p.includes("..")) return false;
  const rest = p.slice(reportPdfPathPrefix(sessionId).length);
  return /^[A-Za-z0-9._-]+$/.test(rest) && rest.toLowerCase().endsWith(ext);
}

export function safeReportPdfFilename(name: string): string {
  const base = name.replace(/\.(pdf|html)$/i, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "PROVIN_atskaite";
  return `${base}.pdf`;
}
