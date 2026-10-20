/**
 * Desktop + mobile PNG of the simplified CSDD pavadzīme form (free, busy, Aivars reply).
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "scripts/iriss-csdd-waybill-fixture.html");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const fileUrl = `file://${html}`;

async function shot(name, viewport, search = "") {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(`${fileUrl}${search}`, { waitUntil: "networkidle", timeout: 60_000 });
  const dest = path.join(outDir, name);
  await page.screenshot({ path: dest, fullPage: true });
  await page.close();
  console.log(dest);
}

await shot("iriss-csdd-waybill-form-desktop.png", { width: 1280, height: 900 });
await shot("iriss-csdd-waybill-form-busy-desktop.png", { width: 1280, height: 900 }, "?state=busy");
await shot("iriss-csdd-waybill-form-reply-desktop.png", { width: 1280, height: 900 }, "?state=reply");
await shot("iriss-csdd-waybill-form-mobile.png", { width: 390, height: 844 });
await shot("iriss-csdd-waybill-form-busy-mobile.png", { width: 390, height: 844 }, "?state=busy");
await browser.close();
