/**
 * 390px + 1440px before/after of the Loģistika car cabinet (admin login is not required).
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const html = path.join(root, "scripts", "iriss-logistika-kabinets-fixture.html");
const browser = await chromium.launch();

const shots = [
  ["pirms", "iriss-logistika-kabinets-pirms-390.png", { width: 390, height: 844 }],
  ["pirms", "iriss-logistika-kabinets-pirms-1440.png", { width: 1440, height: 900 }],
  ["pec-logistika", "iriss-logistika-kabinets-pec-logistika-390.png", { width: 390, height: 844 }],
  ["pec-logistika", "iriss-logistika-kabinets-pec-logistika-1440.png", { width: 1440, height: 900 }],
  ["pec-gramatvede", "iriss-logistika-kabinets-pec-gramatvede-390.png", { width: 390, height: 844 }],
  ["pec-gramatvede", "iriss-logistika-kabinets-pec-gramatvede-1440.png", { width: 1440, height: 900 }],
  ["pec-admin", "iriss-logistika-kabinets-pec-admin-390.png", { width: 390, height: 844 }],
  ["pec-admin", "iriss-logistika-kabinets-pec-admin-1440.png", { width: 1440, height: 900 }],
];

for (const [role, pngName, viewport] of shots) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(`file://${html}?role=${role}`, { waitUntil: "networkidle", timeout: 60_000 });
  const dest = path.join(outDir, pngName);
  await page.screenshot({ path: dest, fullPage: true });
  await page.close();
  console.log(dest);
}

await browser.close();
