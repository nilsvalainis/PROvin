/**
 * iPhone 14 Pro 390×844 light/dark screenshots for the mobile admin designer pass.
 *   ADMIN_MOBILE_SHOT_DIR=... ADMIN_MOBILE_TEST_URL=http://localhost:3040 node scripts/admin-mobile-designer-shots.mjs
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = (process.env.ADMIN_MOBILE_TEST_URL ?? process.env.PREVIEW_URL ?? "http://localhost:3040").replace(/\/$/, "");
const shotDir = process.env.ADMIN_MOBILE_SHOT_DIR || join(dirname(fileURLToPath(import.meta.url)), "../tmp/admin-mobile-shots");
const adminUser = process.env.ADMIN_USERNAME || "admin";
const adminPass = process.env.ADMIN_PASSWORD || "provin-local-dev";

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--disable-gpu", "--no-sandbox"],
});

async function shot(colorScheme, suffix) {
  const page = await browser.newPage({ ...IPHONE, colorScheme });
  const beforeHtml = new URL("../scripts/admin-mobile-before-fixture.html", import.meta.url).href;
  await page.goto(beforeHtml, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: join(shotDir, `before-pasutijumi-${suffix}.png`), fullPage: false });

  const loginRes = await page.request.post(`${base}/api/admin/login`, {
    data: { username: adminUser, password: adminPass },
  });
  if (!loginRes.ok()) {
    console.error("login failed", loginRes.status(), await loginRes.text().catch(() => ""));
    await page.close();
    return { suffix, loginOk: false };
  }

  await page.goto(`${base}/admin/dashboard`, { waitUntil: "networkidle", timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(shotDir, `after-pasutijumi-${suffix}.png`), fullPage: false });

  const more = page.getByRole("button", { name: "Vairāk" });
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(shotDir, `after-vairak-${suffix}.png`), fullPage: false });
    await more.click().catch(() => {});
  }

  await page.goto(`${base}/admin/atras-vertesanas`, { waitUntil: "networkidle", timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shotDir, `after-atrie-${suffix}.png`), fullPage: false });

  const htmlBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const themeColor = await page.evaluate(() => {
    const el = document.querySelector('meta[name="theme-color"]');
    return el?.getAttribute("content") ?? "";
  });
  await page.close();
  return { suffix, loginOk: true, htmlBg, bodyBg, themeColor };
}

const light = await shot("light", "light");
const dark = await shot("dark", "dark");
await browser.close();
console.log("SHOTS", { shotDir, light, dark });
