/**
 * eteenindus.mnt.ee — Igaunijas Transpordiamet "Sõiduki taustakontroll".
 * JSF forma ar invisible reCAPTCHA: headless režīmā valideēšana krīt, tāpēc
 * vajadzīgs redzams browsers (skat. browser.mjs).
 */
import { humanMouse, humanType, sleep } from "./browser.mjs";

const URL = "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf";

const NOT_FOUND = /Sisestatud andmetega sõidukit registris ei ole/i;
const CAPTCHA_ERROR = /reCAPTCHA valideerimise viga/i;

/** Nolasa visas tabulas un label/value pārus no rezultāta zonas. */
async function extractResult(page) {
  return page.evaluate(() => {
    const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

    const tables = Array.from(document.querySelectorAll("table"))
      .map((t) => ({
        caption: clean(t.querySelector("caption")?.textContent),
        headers: Array.from(t.querySelectorAll("thead th")).map((th) => clean(th.textContent)),
        rows: Array.from(t.querySelectorAll("tbody tr, tr"))
          .map((tr) => Array.from(tr.querySelectorAll("th,td")).map((td) => clean(td.textContent)))
          .filter((r) => r.some((c) => c)),
      }))
      .filter((t) => t.rows.length);

    // JSF panelGrid parasti izvada "etiķete: vērtība" pa divām šūnām
    const pairs = {};
    for (const t of tables) {
      for (const row of t.rows) {
        if (row.length === 2 && row[0] && row[1] && row[0].length < 60) pairs[row[0].replace(/:$/, "")] = row[1];
      }
    }

    const messages = Array.from(document.querySelectorAll(".ui-messages, .ui-message, .alert, .error, [class*='message']"))
      .map((el) => clean(el.textContent))
      .filter(Boolean);

    return { tables, pairs, messages, text: document.body.innerText.replace(/\n{3,}/g, "\n\n") };
  });
}

export async function fetchMnt(page, vin, { regMark = "" } = {}) {
  const started = Date.now();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2500 + Math.random() * 1500);
  await humanMouse(page);

  if (regMark) await humanType(page, "#soidukOtsingForm\\:regMark", regMark);
  await humanType(page, "#soidukOtsingForm\\:vinKood", vin);
  await sleep(800 + Math.random() * 700);

  await page.click("#soidukOtsingForm button:has-text('OTSIN'), #soidukOtsingForm button:has-text('Otsin')");
  await sleep(6000);
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

  const result = await extractResult(page);
  const captchaFailed = CAPTCHA_ERROR.test(result.text);
  // instrukciju teksts lapā citē to pašu frāzi, tāpēc skatāmies tikai zem formas
  const afterForm = result.text.split("VIN-kood").pop() ?? result.text;
  const notFound = NOT_FOUND.test(afterForm) || result.messages.some((m) => NOT_FOUND.test(m));

  return {
    source: "eteenindus.mnt.ee",
    country: "EE",
    vin,
    regMark: regMark || null,
    found: !captchaFailed && !notFound && Object.keys(result.pairs).length > 0,
    captchaFailed,
    note: captchaFailed
      ? "reCAPTCHA neizdevās — vajadzīgs redzams browsers vai atkārtots mēģinājums"
      : notFound
        ? "VIN nav Igaunijas reģistrā (vai nesakrīt ar numura zīmi)"
        : null,
    fields: result.pairs,
    tables: result.tables,
    raw: { text: result.text, messages: result.messages },
    durationMs: Date.now() - started,
  };
}
