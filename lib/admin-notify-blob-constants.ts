import { isSafeAdminOrderId } from "@/lib/admin-source-pdf-blob-constants";

/** Vercel Blob pathname prefix — klienta augšupielāde pirms „notify-report-ready” e-pastam. */
export const NOTIFY_PORTFOLIO_BLOB_PREFIX = "admin-notify-portfolio";

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
