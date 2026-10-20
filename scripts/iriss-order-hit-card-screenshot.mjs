/**
 * BEFORE/AFTER PNGs of the IRISS order-room listing card fixture.
 * Admin pages need login, so this uses scripts/iriss-order-hit-card-fixture.html.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "scripts/iriss-order-hit-card-fixture.html");
const outDir = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
await fs.mkdir(outDir, { recursive: true });

const AFTER_CSS = `
.admin-ios-theme [data-iriss-order-room="1"] :is(button, a)[class*="bg-[#111827]"] {
  background: #111827 !important;
  border-color: #111827 !important;
  color: #fff !important;
}
.admin-ios-theme .iriss-pas-hits {
  background: var(--news-bg, var(--ink, #0b0c10)) !important;
  color: var(--news-fg, var(--onink, #fff)) !important;
}
.iriss-ov-menu-portal {
  position: fixed;
  z-index: 200;
  background: var(--s1, #fff);
  color: var(--ink, #0b0c10);
}
.admin-ios-theme .iriss-ov-menu .iriss-ov-item,
.iriss-ov-menu-portal .iriss-ov-item {
  color: var(--ink, #0b0c10);
}
`;

const shot = process.argv.includes("--after") ? "after" : "before";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: 2 });
await page.goto(`file://${html}`, { waitUntil: "networkidle", timeout: 60_000 });

if (shot === "after") {
  await page.addStyleTag({ content: AFTER_CSS });
  await page.evaluate(() => {
    const label = document.getElementById("shot-label");
    if (label) label.textContent = "IRISS pasūtījuma kartīte · AFTER";
    const title = document.getElementById("hit-title");
    const card = document.getElementById("hit-card");
    const url = card?.getAttribute("data-auction-url") || "";
    if (title && url) {
      title.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="text-inherit no-underline">${title.textContent}</a>`;
    }
    const menu = document.getElementById("ov-menu");
    if (menu) {
      menu.classList.add("iriss-ov-menu-portal");
      menu.style.position = "fixed";
      const btn = document.getElementById("more-btn");
      const r = btn?.getBoundingClientRect();
      if (r) {
        menu.style.top = `${r.bottom + 6}px`;
        menu.style.left = `${Math.max(8, r.right - 248)}px`;
        menu.style.right = "auto";
      }
      document.body.appendChild(menu);
    }
  });
}

await page.locator("#ov-menu").waitFor({ state: "visible" });
const dest = path.join(outDir, `iriss-order-hit-card-${shot}.png`);
await page.screenshot({ path: dest, fullPage: true });
console.log(dest);
await browser.close();
