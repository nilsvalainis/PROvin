import "server-only";

import type { Browser } from "playwright-core";

/**
 * Atskaites HTML -> PDF serverī ar Chromium (1. posms "Sūtīt atskaiti", izmēģinājums 17.11).
 * Tas pats HTML, ko tagad atver pārlūka drukas logā (`buildClientReportDocumentHtml`); dizains nemainās,
 * jo drukas CSS (`@page`, galvenes, kājenes) apstrādā tas pats Chromium dzinējs.
 * Vercel: `@sparticuz/chromium` (AL2023). Lokāli: Playwright instalētais Chromium.
 */

export const REPORT_PDF_RENDER_TIMEOUT_MS = 50_000;

async function launchBrowser(): Promise<Browser> {
  const { chromium: playwright } = await import("playwright-core");
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return playwright.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  return playwright.launch({ headless: true });
}

export type ReportPdfRenderResult = { pdf: Uint8Array; ms: number; fontsReady: boolean };

export async function renderReportHtmlToPdf(html: string): Promise<ReportPdfRenderResult> {
  const started = Date.now();
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: REPORT_PDF_RENDER_TIMEOUT_MS });
    // Atskaites HTML pats gaida Inter fontus un tad uzliek `data-provin-fonts="ready"` (sk. reportFontGuardScript).
    const fontsReady = await page
      .waitForSelector('html[data-provin-fonts="ready"]', { state: "attached", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return { pdf: new Uint8Array(pdf), ms: Date.now() - started, fontsReady };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
