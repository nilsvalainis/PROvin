/**
 * Before/after PNG of Pavadzīmes page, sidebar block, and 390px mobile.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "scripts/iriss-pavadzimes-plates-v2-fixture.html");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const fileUrl = `file://${html}`;

async function shot(name, viewport, search, clipSel) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(`${fileUrl}${search}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(400);
  const dest = path.join(outDir, name);
  if (clipSel) {
    const el = page.locator(clipSel);
    await el.screenshot({ path: dest });
  } else {
    await page.screenshot({ path: dest, fullPage: true });
  }
  await page.close();
  console.log(dest);
}

for (const state of ["before", "after"]) {
  const q = `?state=${state}`;
  await shot(`iriss-pavadzimes-${state}-desktop.png`, { width: 1280, height: 900 }, q);
  await shot(`iriss-pavadzimes-sidebar-${state}.png`, { width: 1280, height: 900 }, q, "#sidebar");
  await shot(`iriss-pavadzimes-${state}-mobile.png`, { width: 390, height: 900 }, q);
}
await browser.close();
