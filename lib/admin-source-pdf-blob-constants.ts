/**
 * Avotu PDF pārsūtīšana caur Vercel Blob.
 *
 * Vercel funkcijas pieprasījuma ķermenis ir ~4,5 MB, un tajā līdztekus PDF ceļo arī avotu bloku
 * JSON, tāpēc lielākus failus klients augšupielādē tieši uz Blob un serveris tos lejupielādē.
 */

export const SOURCE_PDF_BLOB_PREFIX = "admin-source-pdf";

/** POST `/api/admin/copilot/pdf-blob-upload` — serveris izsniedz client tokenu. */
export const SOURCE_PDF_BLOB_CLIENT_TOKEN_ACTION = "client-token";

/** Virs šī izmēra PDF ceļo caur Blob, nevis pieprasījuma ķermenī. */
export const SOURCE_PDF_DIRECT_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

export function sourcePdfBlobPathPrefix(orderId: string): string {
  return `${SOURCE_PDF_BLOB_PREFIX}/${orderId.trim()}`;
}

/** Pasūtījuma id: Stripe `cs_…`, `demo_order_…`, `manual_order_…` — tikai droši ceļa simboli. */
export function isSafeAdminOrderId(id: string): boolean {
  return /^[A-Za-z0-9_-]{6,120}$/.test(id.trim());
}

export function isVercelBlobHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h.endsWith(".public.blob.vercel-storage.com") || h.endsWith(".blob.vercel-storage.com");
}

export type SourcePdfBlobRef = { url: string; name?: string };

/** `fileUrls` JSON no pieprasījuma → atsauces. */
export function parseSourcePdfBlobRefs(raw: unknown, max: number): SourcePdfBlobRef[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: SourcePdfBlobRef[] = [];
  for (const item of parsed) {
    if (out.length >= max) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!url) continue;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    out.push({ url, ...(name ? { name } : {}) });
  }
  return out;
}
