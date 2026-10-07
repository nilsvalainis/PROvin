/**
 * Viens Chrome vienlaikus. Katrai platformai savs pastāvīgs profils
 * `LISTINGS_PROFILES_DIR/<platform>` (noklusējums /var/lib/provin-listings/profiles).
 * Headful zem Xvfb (DISPLAY no systemd), lai Cloudflare redz īstu pārlūku. Nekad nedalīt ar mnt profiliem.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import { envToken } from "./policy.mjs";

const PROFILES_DIR = process.env.LISTINGS_PROFILES_DIR || "/var/lib/provin-listings/profiles";
const CHROME_CHANNEL = envToken(process.env.LISTINGS_CHROME_CHANNEL, "chrome");
const CHROME_EXECUTABLE = (process.env.LISTINGS_CHROME_EXECUTABLE ?? "").trim();
const USER_AGENT = (process.env.LISTINGS_USER_AGENT ?? "").trim();
const LOCALE = (process.env.LISTINGS_LOCALE ?? "en-GB").trim();
const HEADLESS = /^(1|true|yes)$/i.test(process.env.LISTINGS_HEADLESS ?? "");

const CHROME_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-dev-shm-usage",
  "--disable-background-networking",
  "--disable-features=TranslateUI",
  `--lang=${LOCALE}`,
  "--window-size=1366,900",
  "--window-position=0,0",
];

export function profileDir(platform) {
  return path.join(PROFILES_DIR, platform);
}

export async function profileExists(platform) {
  try {
    const entries = await fs.readdir(profileDir(platform));
    return entries.length > 0;
  } catch {
    return false;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomPause(minMs, maxMs) {
  return sleep(Math.round(minMs + Math.random() * Math.max(0, maxMs - minMs)));
}

/** Pārlūka rinda: viens konteksts vienlaikus, pārējie gaida. `queueLength` ļauj atteikt 503, ja rinda par garu. */
class BrowserQueue {
  constructor() {
    this.chain = Promise.resolve();
    this.pending = 0;
    this.current = "";
  }

  get queueLength() {
    return this.pending;
  }

  run(label, fn) {
    this.pending += 1;
    const next = this.chain.then(async () => {
      this.current = label;
      try {
        return await fn();
      } finally {
        this.current = "";
        this.pending -= 1;
      }
    });
    this.chain = next.catch(() => undefined);
    return next;
  }
}

export const browserQueue = new BrowserQueue();

/**
 * Atver pastāvīgo profilu. Atgriež { context, page, close }.
 * `headful` true arī manuālai ielogošanai (redzams uz Xvfb displeja caur noVNC).
 */
export async function openProfile(platform, opts = {}) {
  const dir = profileDir(platform);
  await fs.mkdir(dir, { recursive: true });
  const launch = {
    headless: opts.headless ?? HEADLESS,
    channel: CHROME_EXECUTABLE ? undefined : CHROME_CHANNEL || undefined,
    executablePath: CHROME_EXECUTABLE || undefined,
    args: [...CHROME_ARGS],
    ignoreDefaultArgs: ["--enable-automation"],
    viewport: { width: 1366, height: 900 },
    locale: LOCALE,
    timezoneId: process.env.LISTINGS_TIMEZONE || "Europe/Riga",
    acceptDownloads: false,
    ...(USER_AGENT ? { userAgent: USER_AGENT } : {}),
  };
  let context;
  try {
    context = await chromium.launchPersistentContext(dir, launch);
  } catch (e) {
    /** Sistēmas Chrome nav: krītam uz Playwright Chromium. */
    if (!CHROME_EXECUTABLE && CHROME_CHANNEL) {
      console.warn(`[listings-relay] channel=${CHROME_CHANNEL} nav pieejams (${e instanceof Error ? e.message.split("\n")[0] : e}), lietoju Playwright Chromium`);
      context = await chromium.launchPersistentContext(dir, { ...launch, channel: undefined });
    } else {
      throw e;
    }
  }
  context.setDefaultTimeout(opts.timeoutMs ?? 45_000);
  const page = context.pages()[0] ?? (await context.newPage());
  const close = async () => {
    await context.close().catch(() => undefined);
  };
  return { context, page, close };
}

/** Lapas teksts (saīsināts) heiristikām: login forma, 2FA, captcha. */
export async function pageText(page, limit = 20_000) {
  try {
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    return text.replace(/\s+/g, " ").slice(0, limit);
  } catch {
    return "";
  }
}

export async function hasCaptchaOrChallenge(page) {
  try {
    return await page.evaluate(() => {
      const html = document.documentElement.outerHTML.slice(0, 300_000);
      if (/cf-chl|challenge-platform|Just a moment|Attention Required/i.test(html)) return "cloudflare_challenge";
      if (document.querySelector('iframe[src*="recaptcha"], .g-recaptcha, [data-sitekey]') || /grecaptcha/i.test(html)) return "recaptcha";
      if (document.querySelector('iframe[src*="turnstile"], .cf-turnstile') || /turnstile/i.test(html)) return "turnstile";
      if (document.querySelector('iframe[src*="hcaptcha"], .h-captcha')) return "hcaptcha";
      return "";
    });
  } catch {
    return "";
  }
}

export function looksLikeTwoFactor(text) {
  return /(verification code|one-time|security code|authenticat(or|ion) code|enter the code|two-factor|2fa|code sent|sms code|e-?mail code|bestätigungscode|verificatiecode)/i.test(text);
}
