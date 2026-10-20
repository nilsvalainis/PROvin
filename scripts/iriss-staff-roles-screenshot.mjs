/**
 * Desktop + mobile PNG of the IRISS users page chrome (fixture; admin login is not available in CI).
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "scripts/iriss-staff-roles-fixture.html");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const fileUrl = `file://${html}`;

async function shot(name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 60_000 });
  const dest = path.join(outDir, name);
  await page.screenshot({ path: dest, fullPage: true });
  await page.close();
  console.log(dest);
}

await shot("iriss-staff-users-desktop.png", { width: 1280, height: 800 });
await shot("iriss-staff-users-mobile.png", { width: 390, height: 844 });
await browser.close();
