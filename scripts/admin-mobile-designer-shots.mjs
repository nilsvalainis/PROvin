/**
 * iPhone 14 Pro 390x844 light/dark screenshots after the 44-point mobile pass.
 *   ADMIN_MOBILE_SHOT_DIR=... ADMIN_MOBILE_TEST_URL=http://localhost:3040 node scripts/admin-mobile-designer-shots.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
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
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal, [data-nextjs-dialog-overlay], [data-next-badge-root]").forEach((n) => n.remove());
  }).catch(() => {});
}

async function settle(page) {
  await page.waitForSelector(".admin-m", { timeout: 60_000 });
  await dismissNextOverlay(page);
  await page.waitForTimeout(500);
  await dismissNextOverlay(page);
}

async function metrics(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".admin-m .am-row, .admin-m li.am-row")];
    const visibleCards = cards.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight - 80 && r.height > 40;
    }).length;
    const header = document.querySelector(".am-topbar-sticky");
    const expand = document.querySelector(".am-topbar-expand");
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const expandH = expand ? expand.getBoundingClientRect().height : 0;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      scrollY: window.scrollY,
      visibleCards,
      headerH: Math.round(headerH + expandH),
      stickyH: Math.round(headerH),
      collapsed: expand?.getAttribute("data-collapsed") || "",
      theme: document.querySelector(".admin-m")?.getAttribute("data-admin-theme") || "",
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    };
  });
}

async function shotPage(page, name) {
  await page.screenshot({ path: join(shotDir, `${name}.png`), fullPage: false });
}

async function login(page) {
  const loginRes = await page.request.post(`${base}/api/admin/login`, {
    data: { username: adminUser, password: adminPass },
  });
  if (!loginRes.ok()) {
    throw new Error(`login failed ${loginRes.status()} ${await loginRes.text().catch(() => "")}`);
  }
}

async function shot(colorScheme, suffix) {
  const page = await browser.newPage({ ...IPHONE, colorScheme });
  await login(page);
  const report = { suffix };

  await page.goto(`${base}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  report.proTop = await metrics(page);
  await shotPage(page, `after-pro-pasutijumi-${suffix}`);

  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(350);
  report.proDown = await metrics(page);
  await shotPage(page, `after-pro-pasutijumi-scroll-${suffix}`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
  report.proUp = await metrics(page);

  const more = page.locator('nav[aria-label="Galvenā izvēlne"] button[aria-label="Vairāk"]');
  await more.click({ timeout: 10_000 });
  await page.waitForSelector('[role="dialog"][aria-label="Vairāk"]', { timeout: 10_000 });
  await page.waitForTimeout(250);
  await shotPage(page, `after-pro-vairak-${suffix}`);
  await more.click().catch(() => {});
  await page.waitForTimeout(200);

  await page.goto(`${base}/admin/atras-vertesanas`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await settle(page);
  await shotPage(page, `after-pro-atrie-${suffix}`);

  await page.goto(`${base}/admin/iriss/pasutijumi`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await settle(page);
  report.iriss = await metrics(page);
  await shotPage(page, `after-iriss-pasutijumi-${suffix}`);

  await page.goto(`${base}/admin/iriss/sludinajumi`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await settle(page);
  report.listings = await metrics(page);
  await shotPage(page, `after-iriss-sludinajumi-${suffix}`);

  await more.click({ timeout: 10_000 }).catch(async () => {
    await page.locator('nav[aria-label="Galvenā izvēlne"] button[aria-label="Vairāk"]').click();
  });
  await page.waitForSelector('[role="dialog"][aria-label="Vairāk"]', { timeout: 10_000 });
  await page.waitForTimeout(250);
  await shotPage(page, `after-iriss-vairak-${suffix}`);

  await page.close();
  return report;
}

const light = await shot("light", "light");
const dark = await shot("dark", "dark");
await browser.close();
writeFileSync(join(shotDir, "metrics.json"), JSON.stringify({ light, dark }, null, 2));
console.log("SHOTS", { shotDir, light, dark });
