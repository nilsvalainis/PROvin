import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, "generate-sticky-rail-mockups.html");
const outDir = process.env.RAIL_MOCKUP_OUT ?? "/opt/cursor/artifacts/screenshots";

const variants = [
  { id: "variant-a", file: "sticky-rail-variant-a-2x.png", label: "A" },
  { id: "variant-b", file: "sticky-rail-variant-b-2x.png", label: "B" },
  { id: "variant-c", file: "sticky-rail-variant-c-2x.png", label: "C" },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });

for (const v of variants) {
  const el = page.locator(`#${v.id}`);
  await el.screenshot({ path: join(outDir, v.file), type: "png" });
  console.log(`Wrote ${join(outDir, v.file)}`);
}

await page.screenshot({
  path: join(outDir, "sticky-rail-variants-overview-2x.png"),
  fullPage: true,
  type: "png",
});
console.log(`Wrote overview ${join(outDir, "sticky-rail-variants-overview-2x.png")}`);

await browser.close();
