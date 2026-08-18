/**
 * Vercel Blob `BLOB_READ_WRITE_TOKEN` formāts (`vercel_blob_rw_<storeId>_<secret>`).
 * Tukšs vai „placeholder” env padara GET `enabled: true`, bet SDK tad krīt ar
 * „Failed to retrieve the client token”.
 */
export function looksLikeBlobReadWriteToken(value: string): boolean {
  const t = value.trim();
  if (!t.startsWith("vercel_blob_rw_")) return false;
  const parts = t.split("_");
  return parts.length >= 5 && Boolean(parts[3]);
}

export function readBlobReadWriteTokenFromEnv(): string | null {
  const t = process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
  return looksLikeBlobReadWriteToken(t) ? t : null;
}
