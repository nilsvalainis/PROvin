/**
 * IRISS / PRO mobile audit + mockup frames at 390 and 375.
 *   node scripts/iriss-mobile-audit-shots.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const pages = [
  { file: "scripts/iriss-mobile-audit-before.html", shots: ["before-list"] },
  { file: "scripts/iriss-mobile-audit-after.html", shots: ["after-list", "after-sheet"] },
  { file: "scripts/iriss-mobile-mockups.html", shots: ["menu-home", "section-back", "bottom-nav", "pro-switch"] },
];

const widths = [390, 375];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--disable-gpu", "--no-sandbox"],
});

for (const width of widths) {
  for (const pageDef of pages) {
    const fileUrl = `file://${path.join(root, pageDef.file)}`;
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 60_000 });
    for (const shot of pageDef.shots) {
      await page.evaluate((id) => {
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.background = "#e9ecf1";
        for (const el of document.body.children) {
          if (el instanceof HTMLElement) el.style.display = "none";
        }
        const target = document.querySelector(`[data-shot="${id}"]`);
        if (!(target instanceof HTMLElement)) return;
        target.hidden = false;
        target.style.display = "block";
        target.style.width = "100%";
        target.style.maxWidth = "none";
        target.style.height = "844px";
        target.style.borderRadius = "0";
        document.body.appendChild(target);
      }, shot);
      const dest = path.join(outDir, `iriss-mobile-${shot}-${width}.png`);
      await page.screenshot({ path: dest, fullPage: false });
      console.log(dest);
    }
    await page.close();
  }
}

await browser.close();
