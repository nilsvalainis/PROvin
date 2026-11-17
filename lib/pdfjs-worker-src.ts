/**
 * pdf.js worker pārlūkā no mūsu pašu servera (`public/vendor/pdfjs`), nevis no unpkg.com: admin sesijā
 * neizpildām trešās puses CDN kodu, un CSP vairs neziņo `script-src-elem unpkg.com` (audits P9, 2026-10-28).
 * Kopijai jāsakrīt ar instalēto `pdfjs-dist` (tests `lib/pdfjs-worker-src.test.ts`); pēc atjaunināšanas:
 * `cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/vendor/pdfjs/`.
 * Serverī (Node) atstāta iepriekšējā vērtība, lai uzvedība nemainās.
 */
export const PDFJS_WORKER_PUBLIC_PATH = "/vendor/pdfjs/pdf.worker.min.mjs";

export function pdfjsWorkerSrc(version?: string): string {
  if (typeof window === "undefined") {
    return `https://unpkg.com/pdfjs-dist@${version ?? ""}/build/pdf.worker.min.mjs`;
  }
  return PDFJS_WORKER_PUBLIC_PATH;
}
