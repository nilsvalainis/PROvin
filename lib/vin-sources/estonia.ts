import "server-only";

/**
 * Igaunijas avoti:
 *  - eteenindus.mnt.ee („Sõiduki taustakontroll”) - Transpordiamet;
 *  - lkf.ee („Kahjukontroll”) - Liikluskindlustuse Fond OCTA.
 * Primāri HTTP + CapSolver (reCAPTCHA v3 / v2). Redzams pārlūks paliek kā rezerve lokāli.
 */
import { hasCaptchaSolverKey } from "@/lib/captcha-solver";
import { parseLkfExtract, parseMntExtract } from "@/lib/vin-sources/estonia-parse";
import {
  createVinSourceContext,
  extractPageData,
  humanMouse,
  humanType,
  isVinSourcesBrowserAllowed,
  sleep,
  type VinSourcePage,
} from "@/lib/vin-sources/browser";
import { fetchLkfHttp } from "@/lib/vin-sources/lkf-http";
import { fetchMntHttp } from "@/lib/vin-sources/mnt-http";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const MNT_URL = "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf";
const LKF_URL = "https://lkf.ee/et/kahjukontroll";

const NO_SOLVER =
  "Nav CAPSOLVER_API_KEY. Igaunijas reģistrs no servera vajag CapSolver, vai lokālu pārlūku (VIN_SOURCES_BROWSER).";

async function submitMntForm(page: VinSourcePage, vin: string, regMark: string): Promise<void> {
  await page.goto(MNT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2500 + Math.random() * 1500);
  await humanMouse(page);
  if (regMark) await humanType(page, "#soidukOtsingForm\\:regMark", regMark);
  await humanType(page, "#soidukOtsingForm\\:vinKood", vin);
  await sleep(800 + Math.random() * 700);
  await page.click("#soidukOtsingForm button:has-text('OTSIN'), #soidukOtsingForm button:has-text('Otsin')");
  await sleep(6000);
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => undefined);
}

async function fetchMntBrowser(vin: string, regMark = ""): Promise<VinSourceFetchResult> {
  const { context, page } = await createVinSourceContext("mnt");
  try {
    await submitMntForm(page, vin, regMark);
    return parseMntExtract(vin, await extractPageData(page));
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function fetchMnt(vin: string, regMark = ""): Promise<VinSourceFetchResult> {
  if (hasCaptchaSolverKey()) {
    try {
      const http = await fetchMntHttp(vin, regMark);
      if (!/reCAPTCHA neizdevās/i.test(http.message) || http.found) return http;
    } catch {
      /* pārlūka rezerve, ja atļauta */
    }
  }
  if (isVinSourcesBrowserAllowed()) return fetchMntBrowser(vin, regMark);
  return emptyVinSourceResult("mnt_ee", vin, hasCaptchaSolverKey() ? "mnt.ee HTTP ielase neizdevās" : NO_SOLVER);
}

async function dismissCookieBanner(page: VinSourcePage): Promise<void> {
  const candidates = [
    "button:has-text('Nõustun')",
    "button:has-text('Luba kõik')",
    "#onetrust-accept-btn-handler",
    "button:has-text('Selge')",
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click({ timeout: 2000 }).catch(() => undefined);
      await sleep(500);
      return;
    }
  }
}

async function clickRecaptchaCheckbox(page: VinSourcePage): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const frame = page.frames().find((f) => f.url().includes("recaptcha/api2/anchor"));
    if (frame) {
      const box = frame.locator("#recaptcha-anchor");
      if (await box.count().catch(() => 0)) {
        await box.click({ timeout: 5000 }).catch(() => undefined);
        return true;
      }
    }
    await sleep(1000);
  }
  return false;
}

async function solveRecaptcha(page: VinSourcePage, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let lastClickAt = 0;

  while (Date.now() < deadline) {
    const state = await page
      .evaluate(() => ({
        len: (document.querySelector("textarea#g-recaptcha-response") as HTMLTextAreaElement | null)?.value?.length ?? 0,
        challenge: [...document.querySelectorAll("iframe[src*='recaptcha/api2/bframe']")].some(
          (f) => f.getBoundingClientRect().height > 100,
        ),
      }))
      .catch(() => ({ len: 0, challenge: false }));

    if (state.len > 20) return true;
    if (state.challenge) {
      await page.bringToFront().catch(() => undefined);
    } else if (Date.now() - lastClickAt > 40000) {
      await clickRecaptchaCheckbox(page);
      lastClickAt = Date.now();
    }
    await sleep(1000);
  }
  return false;
}

async function fetchLkfBrowser(vin: string, captchaTimeoutMs: number): Promise<VinSourceFetchResult> {
  const { context, page } = await createVinSourceContext("lkf");
  try {
    await page.goto(LKF_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(2000);
    await dismissCookieBanner(page);
    await page.click("#edit-vehicle");
    await page.type("#edit-vehicle", vin, { delay: 80 + Math.random() * 60 });
    await sleep(600);

    if (!(await solveRecaptcha(page, captchaTimeoutMs))) {
      return emptyVinSourceResult("lkf_ee", vin, "reCAPTCHA netika atrisināta - mēģini vēlreiz un nospied ķeksi pārlūkā");
    }

    await page.click("#edit-submit");
    await sleep(4000);
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => undefined);
    return parseLkfExtract(vin, await extractPageData(page));
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function fetchLkf(vin: string, captchaTimeoutMs = 240000): Promise<VinSourceFetchResult> {
  if (hasCaptchaSolverKey()) {
    try {
      const http = await fetchLkfHttp(vin);
      if (!/reCAPTCHA|CapSolver/i.test(http.message) || http.found) return http;
    } catch {
      /* pārlūka rezerve */
    }
  }
  if (isVinSourcesBrowserAllowed()) return fetchLkfBrowser(vin, captchaTimeoutMs);
  return emptyVinSourceResult("lkf_ee", vin, hasCaptchaSolverKey() ? "lkf.ee HTTP ielase neizdevās" : NO_SOLVER);
}
