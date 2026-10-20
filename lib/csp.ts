/**
 * CSP šabloni. Enforcing tikai admin HTML dokumentiem (rēķins / IRISS drukas skati).
 * Visai vietnei - Report-Only, lai nesalauztu Stripe, GA, Meta pixel, TikTok un Vercel.
 * Fontu saites (Inter / Google Fonts) paliek; šī politika tās atļauj, neizņem.
 */

export const CSP_REPORT_PATH = "/api/csp-report";

/** Admin HTML dokumenti bez skriptiem. Google Fonts paliek atļauti (IRISS drukas Inter). */
export const ADMIN_HTML_DOCUMENT_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src https://fonts.googleapis.com https://fonts.gstatic.com",
  "object-src 'none'",
].join("; ");

/**
 * Report-Only visai vietnei. `unsafe-inline` / `unsafe-eval` - Next.js un Consent/gtag
 * iekļautie skripti (nonce šajā kārtā nav). `connect-src https:` - GA/Ads/Meta/Stripe
 * apakšdomēni mainās; Report-Only nedrīkst nogāzt maksājumus un analītiku.
 */
export const SITE_CSP_REPORT_ONLY = [
  "default-src 'self'",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://js.stripe.com",
    "https://*.js.stripe.com",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://www.googleadservices.com",
    "https://www.google.com",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://googleads.g.doubleclick.net",
    "https://pagead2.googlesyndication.com",
    "https://connect.facebook.net",
    "https://analytics.tiktok.com",
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    "https://vercel.live",
  ].join(" "),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://js.stripe.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss: blob:",
  [
    "frame-src",
    "'self'",
    "https://js.stripe.com",
    "https://*.js.stripe.com",
    "https://hooks.stripe.com",
    "https://checkout.stripe.com",
    "https://www.facebook.com",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://vercel.live",
  ].join(" "),
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://hooks.stripe.com https://js.stripe.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "upgrade-insecure-requests",
  `report-uri ${CSP_REPORT_PATH}`,
].join("; ");

export function adminHtmlDocumentHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": ADMIN_HTML_DOCUMENT_CSP,
    ...extra,
  };
}

export type CspReportSummary = {
  violatedDirective: string;
  blockedUri: string;
  documentHost: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || "";
  } catch {
    return "";
  }
}

/** CSP Report-Only ķermenis (vecais csp-report vai Reporting API). Bez pilniem ceļiem ar tokeniem. */
export function summarizeCspReport(body: unknown): CspReportSummary | null {
  const root = asRecord(body);
  if (!root) return null;
  const report = asRecord(root["csp-report"]) ?? asRecord(root.body) ?? root;
  const violated =
    (typeof report["violated-directive"] === "string" && report["violated-directive"]) ||
    (typeof report["effective-directive"] === "string" && report["effective-directive"]) ||
    (typeof report.effectiveDirective === "string" && report.effectiveDirective) ||
    "";
  const blockedRaw =
    (typeof report["blocked-uri"] === "string" && report["blocked-uri"]) ||
    (typeof report.blockedURL === "string" && report.blockedURL) ||
    "";
  const documentRaw =
    (typeof report["document-uri"] === "string" && report["document-uri"]) ||
    (typeof report.documentURL === "string" && report.documentURL) ||
    "";
  if (!violated && !blockedRaw) return null;
  return {
    violatedDirective: violated.slice(0, 120),
    blockedUri: (hostOf(blockedRaw) || blockedRaw.slice(0, 80)).slice(0, 80),
    documentHost: hostOf(documentRaw).slice(0, 80),
  };
}
