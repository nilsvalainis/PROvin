/**
 * VIN SCAN avoti, kuru saturu veido JS (Tampermonkey saņem tukšu lapu, «page_not_ready»):
 *  - bid.cars: lapas iekšienē meklēšanas API `/app/search/en/vin-lot/{VIN}/true` -> lota lapa
 *    (pārdošanas vēsture, bojājumi, nobraukums, bildes ir lota HTML).
 *  - CARFAX.eu: sākumlapas forma -> `web-backend.carfax.eu/api/v1/record-check/{VIN}` JSON
 *    (bezmaksas pieejamības pārbaude, nekas netiek pirkts).
 * Captcha/Turnstile te neklikšķina: ja Cloudflare paliek, atgriež `blocked`.
 */
import {
  bidCarsSearchApiUrl,
  carfaxRecordCheckMatches,
  clipHtml,
  isCarfaxCaptchaReject,
  readBidCarsSearch,
  readCarfaxRecordCheck,
  VINSOURCE_TIMEOUT_MS,
} from "./vinsource-logic.mjs";

const CHALLENGE_TITLE_RE = /just a moment|attention required|security verification/i;

function left(deadline) {
  return Math.max(0, deadline - Date.now());
}

function stepTimeout(deadline, cap) {
  return Math.max(1_000, Math.min(cap, left(deadline) - 500));
}

async function goto(page, url, deadline, cap = 15_000) {
  try {
    return await page.goto(url, { waitUntil: "domcontentloaded", timeout: stepTimeout(deadline, cap) });
  } catch {
    return null;
  }
}

/** Gaida, kamēr Cloudflare JS izaicinājums nokrīt pats (bez klikšķiem). */
async function waitPastChallenge(page, deadline, capMs) {
  const end = Math.min(deadline, Date.now() + capMs);
  while (Date.now() < end) {
    const title = await page.title().catch(() => "");
    if (!CHALLENGE_TITLE_RE.test(title)) return true;
    await page.waitForTimeout(750);
  }
  const title = await page.title().catch(() => "");
  return !CHALLENGE_TITLE_RE.test(title);
}

async function readBidCars(page, vin, deadline) {
  await goto(page, "https://bid.cars/en/", deadline);
  if (!(await waitPastChallenge(page, deadline, 12_000))) {
    return { kind: "blocked", note: "bid.cars: Cloudflare izaicinājums nenokrita" };
  }
  const api = await page
    .evaluate(
      async ({ url, ms }) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        try {
          const r = await fetch(url, {
            headers: { accept: "application/json, text/javascript, */*", "x-requested-with": "XMLHttpRequest" },
            credentials: "include",
            signal: ctrl.signal,
          });
          return { status: r.status, text: await r.text() };
        } catch (e) {
          return { status: 0, text: "", error: String(e && e.message ? e.message : e) };
        } finally {
          clearTimeout(t);
        }
      },
      { url: bidCarsSearchApiUrl(vin), ms: stepTimeout(deadline, 12_000) },
    )
    .catch((e) => ({ status: 0, text: "", error: e instanceof Error ? e.message : String(e) }));
  if (api.status !== 200) return { kind: "error", note: `bid.cars meklēšana HTTP ${api.status || 0}` };
  const search = readBidCarsSearch(api.text, vin);
  if (search.kind === "none") return { kind: "none", search: { results: 0 } };
  if (search.kind !== "lot") return { kind: "error", note: search.note };
  const resp = await goto(page, search.lotUrl, deadline);
  if (!(await waitPastChallenge(page, deadline, 8_000))) {
    return { kind: "blocked", note: "bid.cars lota lapa: Cloudflare izaicinājums nenokrita" };
  }
  await page.waitForSelector(".sales-history-table, #secondary-info", { timeout: stepTimeout(deadline, 8_000) }).catch(() => undefined);
  const html = await page.content().catch(() => "");
  const finalUrl = typeof page.url === "function" ? page.url() : search.lotUrl;
  if (!html.toUpperCase().includes(vin)) {
    return { kind: "error", note: `bid.cars lota lapa bez VIN (HTTP ${resp ? resp.status() : 0})` };
  }
  return { kind: "found", search: { results: search.results, lotUrl: search.lotUrl }, html: clipHtml(html), finalUrl };
}

/** Viens meklējums sākumlapā: forma -> `record-check` atbilde (vai null, ja nepienāca). */
async function submitCarfaxOnce(page, vin, deadline, { dwellMs }) {
  await goto(page, "https://www.carfax.eu/", deadline);
  if (!(await waitPastChallenge(page, deadline, 8_000))) return { blocked: true };
  // Neredzamā reCAPTCHA v3 vērtē lapas lietojumu: ar pārāk ātru ievadi backend atbild 403 INVALID_CAPTCHA.
  await page.waitForTimeout(Math.min(dwellMs, Math.max(0, left(deadline) - 12_000)));
  // Sīkdatņu logs aizsedz formu. «Disagree» - tikai nepieciešamās sīkdatnes (ja profils jau atcerējās, loga nav).
  const consent = await page.$("#onetrust-reject-all-handler").catch(() => null);
  if (consent && (await consent.isVisible().catch(() => false))) {
    await consent.click({ timeout: stepTimeout(deadline, 3_000) }).catch(() => undefined);
    await page.waitForTimeout(800);
  }
  const input = await page.waitForSelector("#vin-search", { timeout: stepTimeout(deadline, 8_000) }).catch(() => null);
  if (!input) return { noInput: true };
  const waitCheck = page
    .waitForResponse((r) => carfaxRecordCheckMatches(r.url(), vin), { timeout: stepTimeout(deadline, 20_000) })
    .catch(() => null);
  await input.click({ timeout: stepTimeout(deadline, 3_000) }).catch(() => undefined);
  await input.fill("").catch(() => undefined);
  await input.type(vin, { delay: 40 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter").catch(() => undefined);
  const res = await waitCheck;
  if (!res) return { timeout: true };
  return { status: res.status(), text: await res.text().catch(() => "") };
}

/**
 * CARFAX.eu bezmaksas pieejamības pārbaude, viens mēģinājums. Captcha netiek risināta, klikšķināta vai apieta.
 * Pēc 403 INVALID_CAPTCHA uzreiz NEatkārto (tas tikai pazemina vērtējumu) - atdzišanu vada server.mjs.
 */
async function readCarfax(page, vin, deadline) {
  const got = await submitCarfaxOnce(page, vin, deadline, { dwellMs: 4_000 });
  if (got.blocked) return { kind: "blocked", note: "CARFAX.eu: Cloudflare izaicinājums nenokrita" };
  if (got.noInput) return { kind: "error", note: "CARFAX.eu: VIN lauks nav atrasts" };
  if (got.timeout) return { kind: "error", note: "CARFAX.eu: pārbaudes atbilde nepienāca laikā" };
  const read = readCarfaxRecordCheck(got.status, got.text);
  if (read.kind === "error") {
    if (isCarfaxCaptchaReject(got.status, got.text)) return { ...read, note: "CARFAX.eu: reCAPTCHA noraidīja (403)", captcha: true };
    return read;
  }
  return { kind: read.kind, json: read.json };
}

/**
 * @param {import("playwright").Page} page
 * @returns {Promise<{kind: "found"|"none"|"blocked"|"error", note?: string, html?: string, finalUrl?: string, json?: any, search?: any}>}
 */
export async function readVinSource(page, source, vin, opts = {}) {
  const deadline = Date.now() + (opts.timeoutMs ?? VINSOURCE_TIMEOUT_MS);
  if (source === "bid_cars") return readBidCars(page, vin, deadline);
  if (source === "carfax_eu") return readCarfax(page, vin, deadline);
  return { kind: "error", note: "nezināms avots" };
}
