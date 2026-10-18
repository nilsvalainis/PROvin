/**
 * Screenshot of OFICIĀLĀ DĪLERA DATI
 * SERVISA UN REMONTU VĒSTURE date/km visit header.
 *
 *   npx vite-node -c vitest.config.ts scripts/capture-dealer-timeline-layout.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { getClientReportPrintCss } from "@/lib/client-report-html";
import { buildDealerServiceVisitsHtml } from "@/lib/pdf-dealer-service-visits";

const outDir = process.env.TIMELINE_CAPTURE_OUT ?? "/opt/cursor/artifacts/screenshots";
mkdirSync(outDir, { recursive: true });

const visits = buildDealerServiceVisitsHtml(
  [
    { date: "31.03.2026", odometer: "214259", location: "Forchheim", works: "Serviss" },
    { date: "27.03.2026", odometer: "214257", location: "Forchheim", works: "Dzinēja eļļa." },
    {
      date: "16.10.2023",
      odometer: "54338",
      location: "Forchheim",
      works: "Sadales ķēdes komplekta maiņa",
    },
  ],
  { omitSpan: true },
);

const html = `<!doctype html>
<html lang="lv"><head><meta charset="utf-8">
<style>
${getClientReportPrintCss()}
body{max-width:190mm;margin:0 auto;padding:16px 18px;background:#fff;}
.pdf-sec-head{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#0B3A82;}
</style></head>
<body class="provin-report-doc">
  <h2 class="pdf-sec-head">Servisa un remontu vēsture</h2>
  <div class="pdf-source-section-body">${visits}</div>
</body></html>`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome",
});
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { width: 794, height: 900 },
});
await page.setContent(html, { waitUntil: "load" });
const pngPath = join(outDir, "dealer-timeline-mileage-header.png");
await page.locator(".pdf-svc-visit").first().screenshot({ path: pngPath, type: "png" });
await browser.close();
console.log(`PNG: ${pngPath}`);
