import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import type { Browser } from "playwright-core";
import { REPORT_INTER_SUBSETS, embedReportInterFonts, reportInterFontFaceCss } from "@/lib/report-pdf-fonts";

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

let interCss: Promise<string> | null = null;

/** Inter no `public/fonts/report-inter` (iekļauts funkcijā ar outputFileTracingIncludes). */
function loadInterFontFaceCss(): Promise<string> {
  interCss ??= Promise.all(
    REPORT_INTER_SUBSETS.map(async (s) => ({
      base64: (await fs.readFile(path.join(process.cwd(), "public", "fonts", "report-inter", s.file))).toString("base64"),
      unicodeRange: s.unicodeRange,
    })),
  )
    .then(reportInterFontFaceCss)
    .catch((e) => {
      interCss = null;
      throw e;
    });
  return interCss;
}

export type ReportPdfRenderResult = { pdf: Uint8Array; ms: number; fontsReady: boolean };

/**
 * Renderēšanas laikā lapa drīkst ielādēt tikai iegultus resursus (data:/blob:/about:).
 * Atskaites HTML viss vajadzīgais (fonti, attēli, stili) jau ir iekšā - tīkls nav nepieciešams.
 */
export function isAllowedReportPdfRequestUrl(url: string): boolean {
  return /^(?:data|blob|about):/i.test(url.trim());
}

/** Satura politika servera renderim: bez ārējiem resursiem, ietvariem un formām. */
export const REPORT_PDF_RENDER_CSP =
  "default-src 'none'; img-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
  "connect-src 'none'; frame-src 'none'; child-src 'none'; object-src 'none'; media-src 'none'; form-action 'none'; base-uri 'none'";

export function withReportPdfRenderCsp(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${REPORT_PDF_RENDER_CSP}"/>`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${meta}`) : `${meta}${html}`;
}

export async function renderReportHtmlToPdf(html: string): Promise<ReportPdfRenderResult> {
  const started = Date.now();
  html = withReportPdfRenderCsp(embedReportInterFonts(html, await loadInterFontFaceCss()));
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ offline: true, serviceWorkers: "block" });
    await context.route("**/*", (route) =>
      isAllowedReportPdfRequestUrl(route.request().url()) ? route.continue() : route.abort("blockedbyclient"),
    );
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: REPORT_PDF_RENDER_TIMEOUT_MS });
    // Atskaites HTML pats gaida Inter fontus un tad uzliek `data-provin-fonts="ready"` (sk. reportFontGuardScript).
    const fontsReady = await page
      .waitForSelector('html[data-provin-fonts="ready"]', { state: "attached", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    // Fonts patiešām Inter (ne rezerves Open Sans): `document.fonts.load` izdodas arī bez fonta.
    const interLoaded = await page.evaluate(() => document.fonts.check("400 12px Inter") && document.fonts.check("700 12px Inter"));
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return { pdf: new Uint8Array(pdf), ms: Date.now() - started, fontsReady: fontsReady && interLoaded };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
