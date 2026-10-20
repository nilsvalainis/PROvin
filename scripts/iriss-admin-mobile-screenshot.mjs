/**
 * IRISS admin mobile PNG (390×844). Admin prasa login, tāpēc fixture ar to pašu 8/16/safe-area ritmu.
 *   node scripts/iriss-admin-mobile-screenshot.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "scripts/iriss-admin-mobile-fixture.html");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const fileUrl = `file://${html}`;

async function shot(name, reveal) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 60_000 });
  if (reveal) await page.evaluate(reveal);
  const dest = path.join(outDir, name);
  await page.screenshot({ path: dest, fullPage: false });
  await page.close();
  console.log(dest);
}

await shot("iriss-admin-mobile-list-390x844.png");
await shot("iriss-admin-mobile-editor-390x844.png", () => {
  document.getElementById("list")?.classList.remove("on");
  document.getElementById("editor")?.classList.add("on");
});
await browser.close();
