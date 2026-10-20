/**
 * 390px BEFORE/AFTER of Pasūtījumi list: Jaunie pills + LIMITI overlay.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "scripts/iriss-pasutijumi-list-mobile-fixture.html");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const AFTER_CSS = `
.admin-ios-theme .iriss-pas-hits,
.admin-ios-theme .admin-m .iriss-pas-hits,
.admin-ios-theme .iriss-pasutijumi-view .iriss-pas-hits {
  background: var(--news-bg, var(--ink, #0b0c10)) !important;
  color: var(--news-fg, var(--onink, #fff)) !important;
}
`;

const shot = process.argv.includes("--after") ? "after" : "before";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});
await page.goto(`file://${html}`, { waitUntil: "networkidle", timeout: 60_000 });

if (shot === "after") {
  await page.addStyleTag({ content: AFTER_CSS });
  await page.evaluate(() => {
    const label = document.getElementById("shot-label");
    if (label) label.textContent = "Pasūtījumi · AFTER 390";
    const panel = document.getElementById("limits-panel");
    if (panel) {
      panel.classList.remove("limits-broken");
      panel.classList.add("limits-fixed");
    }
  });
}

const dest = path.join(outDir, `iriss-pasutijumi-list-mobile-${shot}.png`);
await page.screenshot({ path: dest, fullPage: false });
console.log(dest);
await browser.close();
