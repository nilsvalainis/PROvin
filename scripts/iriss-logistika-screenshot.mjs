/**
 * Desktop + mobile PNG of the Loģistika fixture (admin login is not required).
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

async function shot(htmlName, pngName, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(`file://${path.join(root, "scripts", htmlName)}`, { waitUntil: "networkidle", timeout: 60_000 });
  const dest = path.join(outDir, pngName);
  await page.screenshot({ path: dest, fullPage: true });
  await page.close();
  console.log(dest);
}

await shot("iriss-logistika-fixture.html", "iriss-logistika-desktop.png", { width: 1280, height: 900 });
await shot("iriss-logistika-fixture.html", "iriss-logistika-mobile.png", { width: 390, height: 844 });
await shot("iriss-logistika-archive-fixture.html", "iriss-logistika-archive-desktop.png", { width: 1280, height: 900 });
await shot("iriss-logistika-archive-fixture.html", "iriss-logistika-archive-mobile.png", { width: 390, height: 844 });
await browser.close();
