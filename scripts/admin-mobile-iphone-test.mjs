/**
 * iPhone 390×844: native touch ritināšana uz admin čaulas un /admin lapām.
 *   ADMIN_MOBILE_TEST_URL=http://localhost:3040 node scripts/admin-mobile-iphone-test.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = (process.env.ADMIN_MOBILE_TEST_URL ?? process.env.PREVIEW_URL ?? "http://localhost:3040").replace(
  /\/$/,
  "",
);
const shotDir = process.env.ADMIN_MOBILE_SHOT_DIR || "";
const adminUser = process.env.ADMIN_USERNAME || "admin";
const adminPass = process.env.ADMIN_PASSWORD || "provin-local-dev";

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

function fail(msg, extra) {
  console.error(msg, extra ?? "");
  process.exit(1);
}

async function documentScrollState(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const hs = getComputedStyle(html);
    const bs = getComputedStyle(body);
    const overflowHidden = (v) => v === "hidden";
    const touchBlocks = (v) => v === "none";
    const scrollHeight = Math.max(html.scrollHeight, body.scrollHeight);
    const clientHeight = window.innerHeight;
    return {
      htmlOverflowY: hs.overflowY,
      bodyOverflowY: bs.overflowY,
      htmlTouchAction: hs.touchAction,
      bodyTouchAction: bs.touchAction,
      htmlHeight: hs.height,
      bodyHeight: bs.height,
      htmlLocked: overflowHidden(hs.overflowY) || overflowHidden(hs.overflow),
      bodyLocked: overflowHidden(bs.overflowY) || overflowHidden(bs.overflow),
      touchLocked: touchBlocks(hs.touchAction) || touchBlocks(bs.touchAction),
      scrollY: window.scrollY || 0,
      scrollHeight,
      clientHeight,
      canOverflow: scrollHeight > clientHeight + 80,
      scrollLockedClass: html.classList.contains("admin-scroll-locked"),
    };
  });
}

async function assertScrollUnlocked(page, label) {
  const s = await documentScrollState(page);
  if (s.htmlLocked || s.bodyLocked || s.touchLocked || s.scrollLockedClass) {
    fail(`SCROLL_LOCK ${label}`, s);
  }
  return s;
}

async function swipeTouch(page, fromY, toY) {
  const x = 180;
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: fromY, id: 1 }],
  });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const y = fromY + ((toY - fromY) * i) / steps;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y, id: 1 }],
    });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
  await page.waitForTimeout(120);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--disable-gpu", "--no-sandbox"],
});
const page = await browser.newPage(IPHONE);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

if (shotDir) mkdirSync(shotDir, { recursive: true });

await page.goto(`${base}/dev/admin-mobile-shell`, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForSelector("#admin-main-scroll");
await page.waitForSelector('[data-testid="order-row-row-24"]');

const unlocked = await assertScrollUnlocked(page, "dev-shell");
if (!unlocked.canOverflow) {
  fail("SHELL_NOT_TALL", unlocked);
}

if (shotDir) {
  await page.screenshot({ path: `${shotDir}/after-pasutijumi.png`, fullPage: false });
}

await page.evaluate(() => window.scrollTo(0, 0));
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
  fail("PTR_FAIL", { ptr, errors });
}
await page.waitForTimeout(1000);
await page.waitForSelector('[data-testid="order-row-row-24"]');

await page.evaluate(() => window.scrollTo(0, 0));
const beforeSwipe = await documentScrollState(page);
await swipeTouch(page, 720, 180);
const afterSwipe = await documentScrollState(page);
const last = page.locator("[data-last-row='1']");
const touchMoved = afterSwipe.scrollY > beforeSwipe.scrollY + 40;
if (!touchMoved) {
  fail("TOUCH_SCROLL_FAIL", { beforeSwipe, afterSwipe, errors });
}

await page.evaluate(() => window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)));
const afterProgrammatic = await documentScrollState(page);
const lastBox = await last.boundingBox();
const maxScroll = Math.max(0, afterProgrammatic.scrollHeight - afterProgrammatic.clientHeight);
const reachedEnd = afterProgrammatic.scrollY >= maxScroll - 32;
const lastVisible = lastBox ? lastBox.y < 844 : false;

if (!reachedEnd && !lastVisible) {
  fail("SCROLL_END_FAIL", { afterProgrammatic, lastBox, maxScroll, errors });
}

if (shotDir) {
  await page.screenshot({ path: `${shotDir}/after-pasutijumi-end.png`, fullPage: false });
}

const tabBar = page.getByRole("navigation", { name: "Galvenā izvēlne" });
if (!(await tabBar.isVisible())) {
  fail("TABBAR_MISSING");
}

if (shotDir) {
  await page.getByRole("button", { name: "Vairāk" }).click();
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${shotDir}/after-vairak.png`, fullPage: false });

  const beforeHtml = new URL("../scripts/admin-mobile-before-fixture.html", import.meta.url).href;
  await page.goto(beforeHtml, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: `${shotDir}/before-pasutijumi.png`, fullPage: false });
}

const pageReports = [];

await page.goto(`${base}/admin/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForTimeout(250);
const loginState = await assertScrollUnlocked(page, "/admin/login");
let loginTouch = 0;
if (loginState.canOverflow) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const beforeLogin = await documentScrollState(page);
  await swipeTouch(page, 720, 180);
  const afterLogin = await documentScrollState(page);
  loginTouch = afterLogin.scrollY - beforeLogin.scrollY;
  if (loginTouch <= 40) fail("TOUCH_SCROLL_FAIL /admin/login", { beforeLogin, afterLogin });
}
pageReports.push({
  path: "/admin/login",
  htmlOverflowY: loginState.htmlOverflowY,
  bodyOverflowY: loginState.bodyOverflowY,
  canOverflow: loginState.canOverflow,
  touchDelta: loginTouch,
});

const loginRes = await page.request.post(`${base}/api/admin/login`, {
  data: { username: adminUser, password: adminPass },
});
const loginOk = loginRes.ok();
const adminPages = ["/admin/dashboard", "/admin/iriss/pasutijumi", "/admin/iriss/sludinajumi", "/admin/vin-scan"];

for (const path of adminPages) {
  if (!loginOk) {
    pageReports.push({ path, skipped: "login failed" });
    continue;
  }
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(400);
  const state = await assertScrollUnlocked(page, path);
  let touchDelta = 0;
  if (state.canOverflow) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await documentScrollState(page);
    await swipeTouch(page, 720, 180);
    const after = await documentScrollState(page);
    touchDelta = after.scrollY - before.scrollY;
    if (touchDelta <= 40) {
      fail(`TOUCH_SCROLL_FAIL ${path}`, { before, after });
    }
  }
  pageReports.push({
    path,
    htmlOverflowY: state.htmlOverflowY,
    bodyOverflowY: state.bodyOverflowY,
    canOverflow: state.canOverflow,
    touchDelta,
  });
}

const android = await browser.newPage({
  ...IPHONE,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
});
await android.goto(`${base}/dev/admin-mobile-shell`, { waitUntil: "networkidle", timeout: 120_000 });
const androidUnlocked = await assertScrollUnlocked(android, "android-shell");
await android.evaluate(() => window.scrollTo(0, 0));
const androidBefore = await documentScrollState(android);
await swipeTouch(android, 720, 180);
const androidAfter = await documentScrollState(android);
const androidTouch = androidAfter.scrollY - androidBefore.scrollY;
if (androidUnlocked.canOverflow && androidTouch <= 40) {
  fail("TOUCH_SCROLL_FAIL android-shell", { androidBefore, androidAfter });
}
await android.close();

await browser.close();
console.log("OK", {
  shell: { touchMoved, reachedEnd, lastVisible, ptr },
  loginOk,
  pageReports,
  android: { htmlOverflowY: androidUnlocked.htmlOverflowY, touchDelta: androidTouch },
  errors,
});
