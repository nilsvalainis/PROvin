/**
 * Desktop + mobile PNG for AdminCostsView PRO and IRISS themes (fixture, no admin login).
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "scripts/admin-costs-fixture.html");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const fileUrl = `file://${html}`;

async function shot(name, viewport, search) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(`${fileUrl}${search}`, { waitUntil: "networkidle", timeout: 60_000 });
  const dest = path.join(outDir, name);
  await page.screenshot({ path: dest, fullPage: true });
  await page.close();
  console.log(dest);
}

await shot("izmaksas-pro-desktop.png", { width: 1440, height: 1100 }, "?theme=pro");
await shot("izmaksas-pro-mobile.png", { width: 390, height: 844 }, "?theme=pro&mobile=1");
await shot("izmaksas-iriss-desktop.png", { width: 1440, height: 1100 }, "?theme=iriss");
await shot("izmaksas-iriss-mobile.png", { width: 390, height: 844 }, "?theme=iriss&mobile=1");
await browser.close();
