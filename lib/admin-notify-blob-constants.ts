import { isSafeAdminOrderId } from "@/lib/admin-source-pdf-blob-constants";

/** Vercel Blob pathname prefix — klienta augšupielāde pirms „notify-report-ready” e-pastam. */
export const NOTIFY_PORTFOLIO_BLOB_PREFIX = "admin-notify-portfolio";

/** POST `/api/admin/notify-blob-upload` — serveris izsniedz client tokenu (ne SDK `retrieveClientToken`). */
export const NOTIFY_BLOB_CLIENT_TOKEN_ACTION = "client-token";

export const NOTIFY_BLOB_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export function notifyPortfolioPathPrefix(sessionId: string): string {
  const id = sessionId.trim();
  return `${NOTIFY_PORTFOLIO_BLOB_PREFIX}/${id}`;
}

/** Stripe `cs_…`, `demo_order_…`, `manual_order_…` — tas pats, ko avotu PDF Blob. */
export function isSafeNotifyOrderId(id: string): boolean {
  return isSafeAdminOrderId(id);
}

/** @deprecated Use `isSafeNotifyOrderId` — e-pasta Blob ceļš pieņem arī manuālos pasūtījumus. */
export function isSafeStripeCheckoutSessionId(id: string): boolean {
  return isSafeNotifyOrderId(id);
}

export function isNotifyBlobHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h.endsWith(".public.blob.vercel-storage.com") || h.endsWith(".blob.vercel-storage.com");
}
