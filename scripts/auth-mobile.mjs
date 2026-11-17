/**
 * Google Chrome ar Playwright persistent kontekstu.
 * Pēc manuālās pierakstīšanās (piem. Google + 2FA) aizver pārlūka logu.
 * Sesija paliek `.data/browser-profiles/mobile` (gitignored caur `.data/`).
 *
 * Noklusējums: skripts NEATVER mobile.de. Akamai bloķē biroja IP, ja šo palaiž
 * no Mac (Nano IT 91.135.84.67). Ieslēgt tikai ar atsevišķu proxy:
 * MOBILE_DE_EGRESS_MODE=proxy
 * MOBILE_DE_EGRESS_PROXY_URL=http://lietotajs:parole@proxy-host:port
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decideMobileDeAutomationEgress, mobileDePlaywrightProxy } from "../lib/marketplace/mobile-de-guard.ts";

const gate = decideMobileDeAutomationEgress({
  MOBILE_DE_EGRESS_MODE: process.env.MOBILE_DE_EGRESS_MODE,
  MOBILE_DE_EGRESS_PROXY_URL: process.env.MOBILE_DE_EGRESS_PROXY_URL,
});
if (!gate.allowed) {
  console.error(gate.reason);
  process.exit(1);
}

const proxy = mobileDePlaywrightProxy(process.env.MOBILE_DE_EGRESS_PROXY_URL ?? "");
const { chromium } = await import("playwright-extra");
const { default: StealthPlugin } = await import("puppeteer-extra-plugin-stealth");

/** Jāsaskan ar `lib/iriss-mobile-playwright-stealth.ts` (vienots profils). */
const MOBILE_DE_PLAYWRIGHT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MOBILE_DE_PLAYWRIGHT_EXTRA_ARGS = ["--disable-blink-features=AutomationControlled"];

/** macOS: sistēmas Google Chrome (Playwright pēc noklusējuma lieto savu Chromium). */
const GOOGLE_CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

chromium.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const userDataDir = path.join(repoRoot, ".data", "browser-profiles", "mobile");
const LOGIN_URL = "https://www.mobile.de/home/login.html";

await mkdir(userDataDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  executablePath: GOOGLE_CHROME_EXECUTABLE,
  viewport: { width: 1280, height: 900 },
  locale: "de-DE",
  userAgent: MOBILE_DE_PLAYWRIGHT_USER_AGENT,
  args: MOBILE_DE_PLAYWRIGHT_EXTRA_ARGS,
  proxy,
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });

console.log(`
Mobile.de: manuālā pierakstīšanās caur proxy
--------------------------------------------
1. Pieslēdzies (piem. caur Google) un pabeidz 2FA.
2. Kad esi iekšā, aizver šo pārlūka logu (Cmd+Q / Alt+F4).
   Sesija tiek saglabāta mapē:
   ${userDataDir}
`);

await new Promise((resolve) => {
  context.once("close", resolve);
});

await writeFile(path.join(userDataDir, ".iriss-mobile-profile-ready"), `${new Date().toISOString()}\n`, "utf8");

console.log("Persistent konteksts aizvērts. Profils saglabāts (ar .iriss-mobile-profile-ready).");
