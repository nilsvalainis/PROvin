/**
 * Before/after phone shots for the IRISS menu + IRISS/PRO switch.
 *   node scripts/iriss-mobile-menu-switch-screenshot.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "scripts/iriss-mobile-menu-switch-shots.html");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const fileUrl = `file://${html}`;

async function shot(id, name, width = 390) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 60_000 });
  await page.evaluate((target) => {
    document.querySelectorAll("section.phone").forEach((el) => {
      el.classList.toggle("hidden", el.id !== target);
    });
  }, id);
  const dest = path.join(outDir, name);
  await page.locator(`#${id}`).screenshot({ path: dest });
  await page.close();
  console.log(dest);
}

await shot("before", "before_iriss_pasutijumi_390.png", 390);
await shot("after-menu", "after_iriss_menu_home_390.png", 390);
await shot("after-section", "after_iriss_section_back_390.png", 390);
await shot("after-section", "after_iriss_section_back_375.png", 375);
await shot("after-switch", "after_pro_workspace_switch_375.png", 375);
await browser.close();
