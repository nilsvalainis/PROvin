/**
 * iPhone 390×844: 24 rindu saraksts ritina līdz beigām; PTR uzliek data-admin-ptr=refreshing.
 *   ADMIN_MOBILE_TEST_URL=http://localhost:3040 node scripts/admin-mobile-iphone-test.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.ADMIN_MOBILE_TEST_URL ?? process.env.PREVIEW_URL ?? "http://localhost:3040";
const url = `${base.replace(/\/$/, "")}/dev/admin-mobile-shell`;
const shotDir = process.env.ADMIN_MOBILE_SHOT_DIR || "";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--disable-gpu", "--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

if (shotDir) mkdirSync(shotDir, { recursive: true });

await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForSelector("#admin-main-scroll");
await page.waitForSelector('[data-testid="order-row-row-24"]');

if (shotDir) {
  await page.screenshot({ path: `${shotDir}/after-pasutijumi.png`, fullPage: false });
}

const scroll = await page.evaluate(() => {
  const el = document.getElementById("admin-main-scroll");
  if (!el) return { ok: false, reason: "nav #admin-main-scroll" };
  const last = el.querySelector("[data-last-row='1']");
  el.scrollTop = el.scrollHeight;
  const reachedEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
  const lastVisible = last ? last.getBoundingClientRect().bottom <= window.innerHeight + 8 : false;
  return {
    ok: reachedEnd && lastVisible,
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    reachedEnd,
    lastVisible,
  };
});

if (shotDir) {
  await page.screenshot({ path: `${shotDir}/after-pasutijumi-end.png`, fullPage: false });
}

if (!scroll.ok) {
  await browser.close();
  console.error("SCROLL_FAIL", scroll);
  process.exit(1);
}

await page.evaluate(() => {
  const el = document.getElementById("admin-main-scroll");
  if (el) el.scrollTop = 0;
});
await page.waitForTimeout(80);

await page.evaluate(() => {
  const el = document.getElementById("admin-main-scroll");
  if (!el) return;
  const fire = (type, y) => {
    const t = new Touch({
      identifier: 1,
      target: el,
      clientX: 180,
      clientY: y,
      pageX: 180,
      pageY: y,
    });
    el.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === "touchend" ? [] : [t],
        changedTouches: [t],
      }),
    );
  };
  fire("touchstart", 40);
  fire("touchmove", 160);
  fire("touchmove", 280);
});

if (shotDir) {
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${shotDir}/after-ptr.png`, fullPage: false });
}

await page.evaluate(() => {
  const el = document.getElementById("admin-main-scroll");
  if (!el) return;
  const t = new Touch({ identifier: 1, target: el, clientX: 180, clientY: 280, pageX: 180, pageY: 280 });
  el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [t] }));
});

await page.waitForTimeout(160);
const ptr = await page.getAttribute("#admin-ptr-indicator", "data-admin-ptr");
if (ptr !== "refreshing" && ptr !== "pulling") {
  await browser.close();
  console.error("PTR_FAIL", { ptr, errors });
  process.exit(1);
}

if (shotDir) {
  await page.getByRole("button", { name: "Vairāk" }).click();
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${shotDir}/after-vairak.png`, fullPage: false });

  const beforeHtml = new URL("../scripts/admin-mobile-before-fixture.html", import.meta.url).href;
  await page.goto(beforeHtml, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: `${shotDir}/before-pasutijumi.png`, fullPage: false });
}

await browser.close();
console.log("OK", { scroll, ptr });
