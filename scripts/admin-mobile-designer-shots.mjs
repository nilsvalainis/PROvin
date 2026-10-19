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

async function dismissNextOverlay(page) {
  const overlay = page.locator("nextjs-portal, [data-nextjs-dialog-overlay]");
  if (await overlay.first().isVisible().catch(() => false)) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.locator("nextjs-portal").evaluateAll((nodes) => nodes.forEach((n) => n.remove())).catch(() => {});
  }
}

async function settle(page) {
  await page.waitForSelector(".admin-m", { timeout: 30_000 });
  await dismissNextOverlay(page);
  await page.waitForTimeout(400);
  await dismissNextOverlay(page);
}

async function themeMeta(page) {
  return page.evaluate(() => {
    const tags = [...document.querySelectorAll('meta[name="theme-color"]')].map((el) => ({
      media: el.getAttribute("media") || "",
      color: el.getAttribute("content") || "",
    }));
    return {
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      themeColor: tags[0]?.color ?? "",
      themeColors: tags,
      adminTheme: document.querySelector(".admin-m")?.getAttribute("data-admin-theme") ?? "",
    };
  });
}

async function shot(colorScheme, suffix) {
  const page = await browser.newPage({ ...IPHONE, colorScheme });

  const loginRes = await page.request.post(`${base}/api/admin/login`, {
    data: { username: adminUser, password: adminPass },
  });
  if (!loginRes.ok()) {
    console.error("login failed", loginRes.status(), await loginRes.text().catch(() => ""));
    await page.close();
    return { suffix, loginOk: false };
  }

  await page.goto(`${base}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await settle(page);
  await page.screenshot({ path: join(shotDir, `after-pasutijumi-${suffix}.png`), fullPage: false });

  const more = page.locator('nav[aria-label="Galvenā izvēlne"] button[aria-label="Vairāk"]');
  await more.click({ timeout: 10_000 });
  await page.waitForSelector('[role="dialog"][aria-label="Vairāk"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shotDir, `after-vairak-${suffix}.png`), fullPage: false });
  await page.locator('button[aria-label="Aizvērt"]').first().click().catch(() => more.click().catch(() => {}));
  await page.waitForTimeout(250);

  const share = page.getByRole("button", { name: "Jauna klienta saite" });
  if (await share.isVisible().catch(() => false)) {
    await share.click();
    await page.waitForSelector('[role="dialog"][aria-labelledby="client-link-title"]', { timeout: 10_000 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(shotDir, `after-share-${suffix}.png`), fullPage: false });
    await page.locator('[role="dialog"][aria-labelledby="client-link-title"] button[aria-label="Aizvērt"]').click().catch(() => {});
    await page.waitForTimeout(200);
  }

  await page.goto(`${base}/admin/atras-vertesanas`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await settle(page);
  await page.screenshot({ path: join(shotDir, `after-atrie-${suffix}.png`), fullPage: false });

  const colors = await themeMeta(page);
  await page.close();
  return { suffix, loginOk: true, ...colors };
}

const light = await shot("light", "light");
const dark = await shot("dark", "dark");
await browser.close();
console.log("SHOTS", { shotDir, light, dark });
