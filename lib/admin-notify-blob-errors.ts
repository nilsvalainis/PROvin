/** Operatoram redzamais teksts, kad Blob client-token POST neizdodas. */

export const NOTIFY_BLOB_SESSION_EXPIRED_LV =
  "Admin sesija beigusies — ielogojies vēlreiz un mēģini sūtīt e-pastu no jauna.";

export const NOTIFY_BLOB_DISABLED_LV =
  "Serverī nav derīga BLOB_READ_WRITE_TOKEN. Vercel → Project → Storage → Blob → Connect, tad Environment Variables (Production) un Redeploy.";

export const NOTIFY_BLOB_TOKEN_FALLBACK_LV =
  "Neizdevās saņemt Vercel Blob augšupielādes atļauju. Pārbaudi BLOB_READ_WRITE_TOKEN Production vidē (Storage → Blob → Connect) un Redeploy.";

export function describeNotifyBlobTokenHttpError(
  status: number,
  body: { error?: unknown; message?: unknown },
): string {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (status === 401) return NOTIFY_BLOB_SESSION_EXPIRED_LV;
  if (status === 503 || body.error === "blob_disabled" || body.error === "blob_token_invalid") {
    return message || NOTIFY_BLOB_DISABLED_LV;
  }
  if (message) return message;
  if (typeof body.error === "string" && body.error.trim()) {
    return `Blob augšupielādes atļauja: ${body.error.trim()}`;
  }
  return NOTIFY_BLOB_TOKEN_FALLBACK_LV;
}
