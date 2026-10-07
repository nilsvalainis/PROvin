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
  /**
   * Googlebot u.c. nesaņem straumētus metadatus `<body>`: canonical/title paliek `<head>`.
   * Ja šo lauku uzstāda, tas aizvieto Next noklusējumu, tāpēc saraksts ir pilns.
   */
  /**
   * Googlebot (īpaši smartphone UA) uz sākumlapas/partneriem saņēma title/canonical `<body>`.
   * `/.*/` = metadati vienmēr `<head>` (Next straumēšana tos citādi izlaiž).
   */
  htmlLimitedBots: /.*/,
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
    "heic-convert",
    "heic-decode",
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
      {
        source: "/",
        has: [{ type: "host", value: "provin.lv" }],
        destination: "https://www.provin.lv/lv",
        permanent: true,
      },
      { source: "/", destination: "/lv", permanent: true },
      { source: "/faq", destination: "/lv/biezi-jautajumi", permanent: true },
      { source: "/about", destination: "/lv/par-mums", permanent: true },
      { source: "/samples", destination: "/lv/pakalpojumi", permanent: true },
      { source: "/paraugi", destination: "/lv/pakalpojumi", permanent: true },
      { source: "/pakalpojumi", destination: "/lv/pakalpojumi", permanent: true },
      { source: "/par-mums", destination: "/lv/par-mums", permanent: true },
      { source: "/blogs", destination: "/lv/blogs", permanent: true },
      { source: "/biezi-jautajumi", destination: "/lv/biezi-jautajumi", permanent: true },
      { source: "/vin-koda-parbaude", destination: "/lv/vin-koda-parbaude", permanent: true },
      { source: "/lietosanas-noteikumi", destination: "/lv/lietosanas-noteikumi", permanent: true },
      { source: "/privatuma-politika", destination: "/lv/privatuma-politika", permanent: true },
      { source: "/:locale(lv|en|de|ru)/faq", destination: "/:locale/biezi-jautajumi", permanent: true },
      { source: "/:locale(lv|en|de|ru)/about", destination: "/:locale/par-mums", permanent: true },
      { source: "/:locale(lv|en|de|ru)/samples", destination: "/:locale/pakalpojumi", permanent: true },
      { source: "/:locale(lv|en|de|ru)/paraugi", destination: "/:locale/pakalpojumi", permanent: true },
      { source: "/:locale(lv|en|de|ru)/opengraph-image", destination: "/og.png", permanent: true },
      { source: "/opengraph-image", destination: "/og.png", permanent: true },
      { source: "/:locale(lv|en|de|ru)/twitter-image", destination: "/og.png", permanent: true },
      { source: "/twitter-image", destination: "/og.png", permanent: true },
      {
        source: "/samples/provin-audits-bmw-525-e61.pdf",
        destination: "/samples/provin-audits-bmw-525-e61-v2.pdf",
        permanent: true,
      },
      { source: "/kontakti", destination: "/lv#kontakti", permanent: true },
      { source: "/:locale(lv|en|de|ru)/kontakti", destination: "/:locale#kontakti", permanent: true },
      { source: "/:locale(lv|en|de|ru)/atsauksmes", destination: "/:locale#atsauksmes", permanent: true },
      { source: "/blog", destination: "/lv/blogs", permanent: true },
      { source: "/:locale(lv|en|de|ru)/blog", destination: "/:locale/blogs", permanent: true },
      { source: "/:locale(lv|en|de|ru)/services", destination: "/:locale/pakalpojumi", permanent: true },
      { source: "/:locale(lv|en|de|ru)/terms", destination: "/:locale/lietosanas-noteikumi", permanent: true },
      { source: "/:locale(lv|en|de|ru)/privacy", destination: "/:locale/privatuma-politika", permanent: true },
      {
        source: "/samples/:file",
        has: [{ type: "query", key: "v" }],
        destination: "/samples/:file",
        permanent: true,
      },
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
      {
        source: "/de",
        headers: [...securityHeaders, ...marketingCache],
      },
      {
        source: "/ru",
        headers: [...securityHeaders, ...marketingCache],
      },
      {
        source: "/icon",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/apple-icon",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/samples/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          { key: "X-Robots-Tag", value: "noindex, follow" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
