/**
 * Vercel Blob `get()` lielākiem objektiem atgriež vāju ETag (`W/"…"`).
 * `put({ ifMatch })` pieņem tikai stipro formu (bez `W/`) - citādi katrs raksts ir konflikts.
 */

export function normalizeBlobEtag(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return t.replace(/^W\//i, "");
}

export function blobEtagIsWeak(raw: string | null | undefined): boolean {
  return /^W\//i.test((raw ?? "").trim());
}

export function blobIfMatchPutFields(etag: string | null | undefined): {
  allowOverwrite: boolean;
  ifMatch?: string;
} {
  const strong = normalizeBlobEtag(etag);
  if (!strong) return { allowOverwrite: false };
  return { allowOverwrite: true, ifMatch: strong };
}
