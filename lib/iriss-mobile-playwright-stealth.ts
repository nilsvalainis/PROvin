import "server-only";

import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { chromium } from "playwright-extra";

/** Vienots reālistisks desktop Chrome UA — jāsaskan ar `scripts/auth-mobile.mjs`. */
export const MOBILE_DE_PLAYWRIGHT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const MOBILE_DE_PLAYWRIGHT_EXTRA_ARGS = ["--disable-blink-features=AutomationControlled"] as const;

let stealthInstalled = false;

/** Playwright Chromium ar puppeteer-extra-plugin-stealth (viena reize procesā). */
export function getChromiumWithStealth(): typeof chromium {
  if (!stealthInstalled) {
    chromium.use(StealthPlugin());
    stealthInstalled = true;
  }
  return chromium;
}
