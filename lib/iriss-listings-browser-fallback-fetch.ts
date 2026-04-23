import "server-only";

import { getChromiumWithStealth } from "@/lib/iriss-playwright-extra-stealth";

const FALLBACK_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FALLBACK_ARGS = ["--disable-blink-features=AutomationControlled"];

export async function fetchUrlHtmlWithStealthBrowser(
  url: string,
  timeoutMs: number,
): Promise<{ ok: true; statusCode: number; html: string } | { ok: false; statusCode: number; note: string }> {
  const chromium = getChromiumWithStealth();
  const executablePath = process.env.IRISS_LISTINGS_CHROME_EXECUTABLE?.trim() || undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [...FALLBACK_ARGS],
      executablePath,
    });
    const context = await browser.newContext({
      locale: "de-DE",
      userAgent: FALLBACK_UA,
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: {
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
    });
    const page = await context.newPage();
    const resp = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    const statusCode = resp?.status() ?? 0;
    const html = await page.content();
    await context.close();
    await browser.close();
    browser = undefined;
    return { ok: true, statusCode, html };
  } catch (e) {
    if (browser) await browser.close().catch(() => undefined);
    return {
      ok: false,
      statusCode: 0,
      note: e instanceof Error ? e.message.slice(0, 220) : "browser_fallback_failed",
    };
  }
}
