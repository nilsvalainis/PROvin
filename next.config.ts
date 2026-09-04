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
  /** pdfjs worker tiek ielādēts pēc ceļa, tāpēc Next izsekošana to neatrod automātiski. */
  outputFileTracingIncludes: {
    "/api/admin/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
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
    return [
      { source: "/admin/pkd-rekins", destination: "/admin/commission-invoice", permanent: false },
      { source: "/paraugi", destination: "/lv/pakalpojumi", permanent: true },
      { source: "/:locale(lv|en)/paraugi", destination: "/:locale/pakalpojumi", permanent: true },
    ];
  },
  /** Stripe Dashboard bieža kļūda: `/api/webhook/stripe` — kods ir `/api/webhooks/stripe`. */
  async rewrites() {
    return [{ source: "/api/webhook/stripe", destination: "/api/webhooks/stripe" }];
  },
  async headers() {
    /** Sākumlapa ir prerenderēta (SSG) — `no-store` liktu Vercel CDN to ģenerēt no jauna katram
     * apmeklētājam. Pārlūks vienmēr pārvalidē (`max-age=0`), CDN drīkst turēt minūti, lai cenu
     * izmaiņas parādās ātri; deploy jebkurā gadījumā invalidē CDN kešu. */
    const marketingCache: { key: string; value: string }[] = [
      {
        key: "Cache-Control",
        value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/lv",
        headers: [...securityHeaders, ...marketingCache],
      },
      {
        source: "/en",
        headers: [...securityHeaders, ...marketingCache],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
