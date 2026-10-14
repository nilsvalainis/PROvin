import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3040";
const outDir = process.env.RAIL_CAPTURE_OUT ?? "/opt/cursor/artifacts/screenshots";
const outFile = join(outDir, "pro-order-sticky-rail-v1-implementation-2x.png");

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { width: 1280, height: 800 },
});
await page.goto(`${baseUrl}/dev/pro-order-rail-preview`, { waitUntil: "networkidle" });
await page.waitForSelector('aside[aria-label="Ātrās darbības"]', { timeout: 60_000 });
const rail = page.locator('aside[aria-label="Ātrās darbības"]');
await rail.screenshot({ path: outFile, type: "png" });
console.log(`Wrote ${outFile}`);
await browser.close();
