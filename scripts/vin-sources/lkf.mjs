/**
 * lkf.ee — Eesti Liikluskindlustuse Fond "Sõiduki liikluskahjude kontroll":
 * vai auto ir bijis OCTA atlīdzības gadījumā un vai kāds apdrošinātājs to atzinis par bojāgājušu.
 * Lapa lieto reCAPTCHA v2 ķeksi — to nospiež skripts; ja Google prasa attēlu uzdevumu,
 * to atrisina operators redzamajā browserī (gaidīšanas logs zemāk).
 */
import { sleep } from "./browser.mjs";

const URL = "https://lkf.ee/et/kahjukontroll";

async function dismissCookieBanner(page) {
  const candidates = [
    "button:has-text('Nõustun')",
    "button:has-text('Luba kõik')",
    "#onetrust-accept-btn-handler",
    "button:has-text('Selge')",
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click({ timeout: 2000 }).catch(() => {});
      await sleep(500);
      return;
    }
  }
}

async function clickRecaptchaCheckbox(page) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const frame = page.frames().find((f) => f.url().includes("recaptcha/api2/anchor"));
    if (frame) {
      const box = frame.locator("#recaptcha-anchor");
      if (await box.count().catch(() => 0)) {
        await box.click({ timeout: 5000 }).catch(() => {});
        return true;
      }
    }
    await sleep(1000);
  }
  return false;
}

/**
 * Apstiprinājums Google pusē noveco ~2 minūtēs ("Kinnitusväljakutse aegus"),
 * tāpēc ķeksi periodiski nospiežam atkārtoti, kamēr nav tokena.
 */
async function solveRecaptcha(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastClickAt = 0;
  let announcedChallenge = false;

  while (Date.now() < deadline) {
    const state = await page
      .evaluate(() => ({
        len: document.querySelector("textarea#g-recaptcha-response")?.value?.length ?? 0,
        challenge: Array.from(document.querySelectorAll("iframe[src*='recaptcha/api2/bframe']")).some(
          (f) => f.getBoundingClientRect().height > 100,
        ),
      }))
      .catch(() => ({ len: 0, challenge: false }));

    if (state.len > 20) return true;

    if (state.challenge) {
      if (!announcedChallenge) {
        announcedChallenge = true;
        await page.bringToFront().catch(() => {});
        process.stdout.write("\u0007");
        console.log("  → Google prasa attēlu uzdevumu: atrisini to browsera logā (gaidu)...");
      }
    } else if (Date.now() - lastClickAt > 40000) {
      const clicked = await clickRecaptchaCheckbox(page);
      lastClickAt = Date.now();
      announcedChallenge = false;
      if (!clicked) console.log("  ⚠ reCAPTCHA rāmis nav atrasts — nospied ķeksi manuāli browserī");
    }

    await sleep(1000);
  }
  return false;
}

export async function fetchLkf(page, query, { captchaTimeoutMs = 300000 } = {}) {
  const started = Date.now();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2000);
  await dismissCookieBanner(page);

  await page.click("#edit-vehicle");
  await page.type("#edit-vehicle", query, { delay: 80 + Math.random() * 60 });
  await sleep(600);

  const gotToken = await solveRecaptcha(page, captchaTimeoutMs);
  if (!gotToken) {
    await page.screenshot({ path: "tmp/vin-recon/lkf-timeout.png", fullPage: true }).catch(() => {});
    return {
      source: "lkf.ee",
      country: "EE",
      query,
      found: false,
      captchaFailed: true,
      note: "reCAPTCHA netika atrisināta noteiktajā laikā",
      durationMs: Date.now() - started,
    };
  }

  await page.click("#edit-submit");
  await sleep(4000);
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

  const result = await page.evaluate(() => {
    const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
    const tables = Array.from(document.querySelectorAll("table"))
      .map((t) => ({
        headers: Array.from(t.querySelectorAll("thead th")).map((th) => clean(th.textContent)),
        rows: Array.from(t.querySelectorAll("tbody tr, tr"))
          .map((tr) => Array.from(tr.querySelectorAll("th,td")).map((td) => clean(td.textContent)))
          .filter((r) => r.some((c) => c)),
      }))
      .filter((t) => t.rows.length);
    const region = document.querySelector("main, .region-content, #content") ?? document.body;
    return { tables, text: region.innerText.replace(/\n{3,}/g, "\n\n") };
  });

  const body = result.text;
  const notInRegistry = /andmeid ei ole liikluskindlustuse registris/i.test(body);
  const claimsTables = result.tables.filter((t) => t.rows.some((row) => row.some((cell) => /\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/.test(cell))));
  const noClaims = !claimsTables.length && /(kahju|juhtum)\w*\s+(ei ole|puuduvad)|ei ole osalenud|puuduvad andmed/i.test(body);

  const status = notInRegistry
    ? "nav_registra"
    : claimsTables.length
      ? "atrasti_gadijumi"
      : noClaims
        ? "nav_gadijumu"
        : "neskaidrs";

  const NOTES = {
    nav_registra: "Auto nav Igaunijas liikluskindlustības reģistrā — visticamāk nav bijis Igaunijā reģistrēts",
    atrasti_gadijumi: null,
    nav_gadijumu: "Liikluskindlustības reģistrā atlīdzības gadījumi nav atrasti",
    neskaidrs: "Atbilde nav automātiski klasificēta — jāieskatās raw tekstā",
  };

  return {
    source: "lkf.ee",
    country: "EE",
    query,
    status,
    found: status === "atrasti_gadijumi",
    claimsTables,
    note: NOTES[status],
    raw: { text: body, allTables: result.tables },
    durationMs: Date.now() - started,
  };
}
