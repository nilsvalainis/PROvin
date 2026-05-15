/** Vercel Blob pathname prefix — klienta augšupielāde pirms „notify-report-ready” e-pastam. */
export const NOTIFY_PORTFOLIO_BLOB_PREFIX = "admin-notify-portfolio";

export function notifyPortfolioPathPrefix(sessionId: string): string {
  const id = sessionId.trim();
  return `${NOTIFY_PORTFOLIO_BLOB_PREFIX}/${id}`;
}

/** Stripe Checkout Session id (`cs_…`). */
export function isSafeStripeCheckoutSessionId(id: string): boolean {
  return /^cs_[a-zA-Z0-9_]+$/.test(id.trim());
}

export function isNotifyBlobHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h.endsWith(".public.blob.vercel-storage.com") || h.endsWith(".blob.vercel-storage.com");
}
