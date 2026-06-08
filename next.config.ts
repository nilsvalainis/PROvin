import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  /** Neiekļaut Webpack: stealth spraudņiem ir dinamiski require (clone-deep u.c.). */
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "playwright",
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
    "puppeteer-extra-plugin",
    "puppeteer-extra-plugin-user-preferences",
  ],
  reactStrictMode: true,
  /** Server Actions + App Router pieprasījumu ķermeņa limits (multipart uz API maršrutiem).
   * Next.js noklusējums ~10 MB (`middlewareClientMaxBodySize`) — ar to par agru 413 „Nosūtīt atskaiti”.
   * Salīdzini ar `NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES` (lib/notify-report-email-limits.ts).
   */
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    /** Multipart uz App Router API (ai-extract, parse-pdf, notify-report-ready). */
    middlewareClientMaxBodySize: "50mb",
  },
  async redirects() {
    return [{ source: "/admin/pkd-rekins", destination: "/admin/commission-invoice", permanent: false }];
  },
  /** Stripe Dashboard bieža kļūda: `/api/webhook/stripe` — kods ir `/api/webhooks/stripe`. */
  async rewrites() {
    return [{ source: "/api/webhook/stripe", destination: "/api/webhooks/stripe" }];
  },
  async headers() {
    const noStoreTestPricing: { key: string; value: string }[] = [
      {
        key: "Cache-Control",
        value: "private, no-cache, no-store, max-age=0, must-revalidate",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/test-pricing-5",
        headers: [...securityHeaders, ...noStoreTestPricing],
      },
      {
        source: "/test-pricing-5/:path*",
        headers: [...securityHeaders, ...noStoreTestPricing],
      },
      {
        source: "/test-checkout",
        headers: [...securityHeaders, ...noStoreTestPricing],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
