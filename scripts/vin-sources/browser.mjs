import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { chromium } from "playwright-extra";
import { mkdir } from "node:fs/promises";
import path from "node:path";

let stealthReady = false;

/**
 * mnt.ee un lkf.ee reCAPTCHA headless režīmā krīt ("reCAPTCHA valideerimise viga"),
 * tāpēc pēc noklusējuma dzenam redzamu browseri ar pastāvīgu profilu — tas ļauj
 * arī saglabāt Cloudflare / captcha sīkdatnes starp palaišanām.
 */
export async function createContext({ profile, headless = false, locale = "et-EE", timezoneId = "Europe/Tallinn" } = {}) {
  if (!stealthReady) {
    chromium.use(StealthPlugin());
    stealthReady = true;
  }
  const profileDir = path.join(process.cwd(), "tmp", "vin-profiles", profile ?? "default");
  await mkdir(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: { width: 1440, height: 900 },
    locale,
    timezoneId,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cilvēkam līdzīga rakstīšana — invisible reCAPTCHA vērtē mijiedarbības ritmu. */
export async function humanType(page, selector, value) {
  await page.click(selector);
  await page.type(selector, value, { delay: 70 + Math.random() * 80 });
}

export async function humanMouse(page) {
  await page.mouse.move(380 + Math.random() * 400, 280 + Math.random() * 240, { steps: 12 });
  await sleep(400 + Math.random() * 600);
}
