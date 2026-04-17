/**
 * Mobilā demo priekšskatījuma PNG (šaurais maršruts, iPhone platums).
 * Palaid `npm run dev` (vai `npm run start`), tad:
 *   PREVIEW_URL=http://localhost:3003 node scripts/demo-mobile-preview.mjs
 */
import { chromium } from "playwright";

const base = (process.env.PREVIEW_URL ?? "http://localhost:3000").replace(/\/$/, "");
const target = `${base}/demo/mobile-narrow`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

await page.goto(target, { waitUntil: "networkidle", timeout: 120000 });
await page.screenshot({ path: "public/demo-mobile-narrow-preview.png", fullPage: true });
await browser.close();

console.log("Saglabāts: public/demo-mobile-narrow-preview.png");
console.log("Atvērt: ", target);
