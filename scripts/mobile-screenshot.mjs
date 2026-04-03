/**
 * Ģenerē mobilā skata PNG (piemēram, iPhone platums).
 * Lietojums: palaist `npm run start` citā terminālī, tad:
 *   node scripts/mobile-screenshot.mjs
 */
import { chromium } from "playwright";

const base = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

await page.goto(base, { waitUntil: "networkidle", timeout: 120000 });
await page.screenshot({ path: "public/mobile-preview.png", fullPage: true });
await browser.close();

console.log("Saglabāts: public/mobile-preview.png");
