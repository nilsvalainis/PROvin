/** Vercel Blob pathname prefix — klienta augšupielāde pirms „notify-report-ready” e-pastam. */
import { isSafeAdminOrderId } from "@/lib/admin-source-pdf-blob-constants";

export const NOTIFY_PORTFOLIO_BLOB_PREFIX = "admin-notify-portfolio";

export function notifyPortfolioPathPrefix(sessionId: string): string {
  const id = sessionId.trim();
  return `${NOTIFY_PORTFOLIO_BLOB_PREFIX}/${id}`;
}

/**
 * Pasūtījuma id Blob ceļam: Stripe `cs_…`, manuāls `manual_order_…`, demo.
 * Agrāk bija tikai `cs_` — manuāliem pasūtījumiem e-pasts ar portfeli izgāzās.
 */
export function isSafeStripeCheckoutSessionId(id: string): boolean {
  return isSafeAdminOrderId(id);
}

export function isNotifyBlobHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h.endsWith(".public.blob.vercel-storage.com") || h.endsWith(".blob.vercel-storage.com");
}
