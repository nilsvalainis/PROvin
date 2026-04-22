/**
 * Palaiž Chromium ar Playwright persistent kontekstu Mobile.de pieslēgšanai.
 * Pēc manuālās pierakstīšanās (piem. Google + 2FA) aizver pārlūka logu — sesija paliek
 * `.data/browser-profiles/mobile` (gitignored caur `.data/`).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { chromium } from "playwright-extra";

/** Jāsaskan ar `lib/iriss-mobile-playwright-stealth.ts` (vienots profils + sinhronizācija). */
const MOBILE_DE_PLAYWRIGHT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MOBILE_DE_PLAYWRIGHT_EXTRA_ARGS = ["--disable-blink-features=AutomationControlled"];

chromium.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const userDataDir = path.join(repoRoot, ".data", "browser-profiles", "mobile");
const LOGIN_URL = "https://www.mobile.de/home/login.html";

await mkdir(userDataDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  locale: "de-DE",
  userAgent: MOBILE_DE_PLAYWRIGHT_USER_AGENT,
  args: MOBILE_DE_PLAYWRIGHT_EXTRA_ARGS,
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });

console.log(`
Mobile.de — manuālā pierakstīšanās
──────────────────────────────────
1. Pieslēdzies (piem. caur Google) un pabeidz 2FA.
2. Kad esi iekšā, aizver šo pārlūka logu (Cmd+Q / Alt+F4).
   Sesija tiek saglabāta mapē:
   ${userDataDir}
`);

await new Promise((resolve) => {
  context.once("close", resolve);
});

await writeFile(
  path.join(userDataDir, ".iriss-mobile-profile-ready"),
  `${new Date().toISOString()}\n`,
  "utf8",
);

console.log("Persistent konteksts aizvērts. Profils saglabāts (ar .iriss-mobile-profile-ready).");
