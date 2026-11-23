/**
 * LTAB plūsma pārlūkā: sākumlapa (ķeksītis #vdar) -> Vienotā pieteikšanās (vpm.viss.gov.lv) Smart-ID -> meklēšana pēc numurzīmes
 * (otrais ķeksītis) -> rezultāts un oriģinālais PDF. Tikai lasīšana; nekad neapmaksā, nekad nepilda citas formas.
 *
 * Drošība: personas kods tiek ievadīts ar `locator.fill` un nekur netiek logots; pieteikšanās (SSO) lapās
 * netiek taisīti ekrānuzņēmumi vai HTML kopijas. Atkļūdošanai: LTAB lapu teksts bez personas kodiem; SSO lapām
 * tikai neatpazītos soļos - struktūra (pogas, lauku etiķetes) un teksts ar aizvietotiem personas kodiem un cipariem.
 */
import fs from "node:fs/promises";
import path from "node:path";

import {
  classifySnapshot,
  isConsentLabel,
  isLatvijaHost,
  isLtabHost,
  isPayText,
  isPdfControlText,
  isSearchFieldLabel,
  LTAB_START_URL,
  redact,
} from "./ltab-page.mjs";
import { chooseSmartId, collectSsoExtras, submitPersonalCode, waitForSmartId } from "./viss-sso.mjs";

export class LtabFlowError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(2000 + Math.round(Math.random() * 3000));

/** Lapas kopsavilkums `classifySnapshot` vajadzībām (tikai redzamie elementi). */
export async function snapshot(page) {
  const host = new URL(page.url()).hostname;
  const data = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    };
    const labelOf = (el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const parent = el.closest("label");
      const aria = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || "";
      const near = el.parentElement ? el.parentElement.textContent || "" : "";
      return [byFor?.textContent, parent?.textContent, aria, el.getAttribute("name"), id, near]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 300);
    };
    const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')].map((el) => ({
      label: labelOf(el),
      checked: el.checked,
      visible: vis(el) || (el.labels && [...el.labels].some(vis)),
    }));
    const inputs = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea")].map(
      (el) => ({ label: labelOf(el), type: (el.getAttribute("type") || "").toLowerCase(), id: el.getAttribute("id") || "", visible: vis(el) }),
    );
    const buttons = [
      ...document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"], a.btn, a[href*="pdf" i], a[href*="Print" i], a[download]'),
    ].map((el) => ({
      text: (el.textContent || el.getAttribute("value") || el.getAttribute("title") || el.getAttribute("href") || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160),
      visible: vis(el),
    }));
    return {
      text: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 20000),
      checkboxes,
      inputs,
      buttons,
      hasVdar: Boolean(document.querySelector("#vdar")),
      hasCaptchaFrame: Boolean(document.querySelector('iframe[src*="captcha" i], .g-recaptcha, .h-captcha')),
    };
  });
  const sso = isLatvijaHost(host) ? await page.evaluate(collectSsoExtras).catch(() => ({})) : {};
  return { host, ...data, ...sso };
}

/** Atkļūdošanai: LTAB lapu teksts; SSO lapām tikai struktūra + teksts bez personas kodiem un cipariem. */
async function saveDebug(debugDir, name, snap, secrets) {
  if (!debugDir || (!isLtabHost(snap.host) && !isLatvijaHost(snap.host))) return;
  try {
    await fs.mkdir(debugDir, { recursive: true, mode: 0o700 });
    const sso = isLatvijaHost(snap.host);
    const text = redact(snap.text, secrets);
    const body = redact(
      JSON.stringify(
        sso
          ? {
              host: snap.host,
              path: snap.path,
              text: text.replace(/\d/g, "#").slice(0, 4000),
              inputs: (snap.inputs ?? []).map((i) => ({ ...i, label: String(i.label ?? "").replace(/\d/g, "#") })),
              buttons: snap.buttons,
              hasAgree: snap.hasAgree,
              smartIdChoice: snap.smartIdChoice,
              smartIdAdapter: snap.smartIdAdapter,
              codeCandidates: (snap.codeCandidates ?? []).length,
              digitCandidates: (snap.digitCandidates ?? []).length,
            }
          : { ...snap, text: text.slice(0, 8000) },
        null,
        1,
      ),
      secrets,
    );
    await fs.writeFile(path.join(debugDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${name}.json`), body, { mode: 0o600 });
  } catch {
    /* atkļūdošana nav obligāta */
  }
}

async function clickByText(page, re, { exclude } = {}) {
  const candidates = page.locator('button, input[type="submit"], input[type="button"], a');
  const n = await candidates.count();
  for (let i = 0; i < n; i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const text = ((await el.textContent().catch(() => "")) || (await el.getAttribute("value").catch(() => "")) || "").trim();
    if (!re.test(text)) continue;
    if (isPayText(text) || (exclude && exclude.test(text))) continue;
    await el.click();
    return true;
  }
  return false;
}

/** Atzīmē piekrišanas ķeksīšus formā (ne maksājumu). Atgriež atzīmēto skaitu. */
async function checkConsentBoxes(page) {
  const boxes = page.locator('input[type="checkbox"]');
  const n = await boxes.count();
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const box = boxes.nth(i);
    if (await box.isChecked().catch(() => true)) continue;
    const label = await box.evaluate((el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return [byFor?.textContent, el.closest("label")?.textContent, el.parentElement?.textContent, el.getAttribute("aria-label")]
        .filter(Boolean)
        .join(" ");
    });
    if (!isConsentLabel(label)) continue;
    await box.check({ force: true }).catch(async () => {
      const id = await box.getAttribute("id");
      if (id) await page.locator(`label[for="${id}"]`).click();
    });
    checked++;
  }
  return checked;
}

async function fillSearch(page, plate) {
  // Ja ir izvēle "reģistrācijas numurs / VIN", izvēlas numuru.
  const radios = page.locator('input[type="radio"]');
  const rn = await radios.count();
  for (let i = 0; i < rn; i++) {
    const r = radios.nth(i);
    const label = await r.evaluate((el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return [byFor?.textContent, el.closest("label")?.textContent, el.getAttribute("value")].filter(Boolean).join(" ");
    });
    if (/re[gģ]istr[aā]cijas\s+numur|valsts\s+numur|numura\s+z[iī]m/i.test(label)) {
      await r.check({ force: true });
      break;
    }
  }
  const fields = page.locator('input[type="text"], input[type="search"], input:not([type])');
  const n = await fields.count();
  for (let i = 0; i < n; i++) {
    const f = fields.nth(i);
    if (!(await f.isVisible().catch(() => false))) continue;
    const label = await f.evaluate((el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return [byFor?.textContent, el.getAttribute("name"), id, el.getAttribute("placeholder"), el.getAttribute("aria-label")]
        .filter(Boolean)
        .join(" ");
    });
    if (!isSearchFieldLabel(label) || (/vin|šasij|sasij/i.test(label) && !/numur|reg/i.test(label))) continue;
    await f.fill(plate);
    return true;
  }
  return false;
}

/** Oriģinālais PDF: lejupielāde, jauna cilne vai atbilde ar application/pdf. */
async function downloadPdf(page, maxBytes) {
  const context = page.context();
  let captured = null;
  const onResponse = async (res) => {
    try {
      const ct = (res.headers()["content-type"] || "").toLowerCase();
      if (!ct.includes("application/pdf") || captured) return;
      if (!isLtabHost(new URL(res.url()).hostname)) return;
      const body = await res.body();
      if (body.byteLength > 4 && body.byteLength <= maxBytes) captured = body;
    } catch {
      /* atbilde aizvērta */
    }
  };
  context.on("response", onResponse);
  try {
    const download = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
    const clicked = await clickByText(page, /\bpdf\b|izzi[nņ]|lejupiel|druk[aā]t|download/i);
    if (!clicked) return null;
    const dl = await download;
    if (dl && !captured) {
      const p = await dl.path().catch(() => null);
      if (p) {
        const buf = await fs.readFile(p);
        if (buf.byteLength <= maxBytes) captured = buf;
      }
    }
    for (let i = 0; i < 20 && !captured; i++) await sleep(500);
    return captured && captured.subarray(0, 4).toString("latin1") === "%PDF" ? captured : null;
  } finally {
    context.off("response", onResponse);
  }
}

/**
 * Viens LTAB vaicājums. `onProgress(state, extra)` ziņo: awaiting_smartid (ar kodu), searching.
 * Atgriež { found: boolean, pdf: Buffer|null }.
 */
export async function runLtabLookup({ page, plate, personalCode, onProgress, log, debugDir, smartIdTimeoutMs = 120_000, maxPdfBytes }) {
  const secrets = [personalCode];
  let submitted = false;
  let codeSent = false;
  let codeFilled = false;
  await page.goto(LTAB_START_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });

  for (let step = 0; step < 25; step++) {
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    // Pāradresācijas laikā (VISS forma iesniedz ar fetch + location.replace) evaluate var krist - vēlreiz.
    const snap = await snapshot(page).catch(async () => {
      await sleep(2000);
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return snapshot(page);
    });
    const kind = classifySnapshot(snap, { submitted });
    log(`solis ${step}: ${kind} (${snap.host})`);

    if (kind === "captcha") throw new LtabFlowError("captcha");

    if (kind === "ltab_login") {
      if (codeSent) throw new LtabFlowError("page_changed", "pēc Smart-ID LTAB atkal prasa pieteikšanos");
      await page.locator("#vdar").check({ force: true });
      await pause();
      if (!(await clickByText(page, /latvija\.lv|piekr[iī]tu|pieteikties|pieslēgties/i))) {
        await page.locator(".dologin").first().click();
      }
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      await sleep(1500);
      continue;
    }

    if (kind === "sso_choose") {
      if (codeFilled) throw new LtabFlowError(codeSent ? "smartid_refused" : "page_changed", "Vienotā pieteikšanās: atpakaļ uz metodes izvēli");
      if (!(await chooseSmartId(page))) {
        await saveDebug(debugDir, `sso-no-smartid-${step}`, snap, secrets);
        throw new LtabFlowError("page_changed", "Vienotā pieteikšanās: nav Smart-ID izvēles");
      }
      continue;
    }

    if (kind === "sso_code_input") {
      if (codeFilled) throw new LtabFlowError("page_changed", "Smart-ID: personas koda forma atkārtojas");
      if (!(await submitPersonalCode(page, personalCode))) {
        await saveDebug(debugDir, `sso-no-input-${step}`, snap, secrets);
        throw new LtabFlowError("page_changed", "Smart-ID: nav personas koda lauka");
      }
      codeFilled = true;
      continue;
    }

    if (kind === "sso_wait") {
      if (!codeFilled && !codeSent) {
        // Koda lapa bez mūsu personas koda (piem. vecs profils) - neko neapstiprinām.
        await saveDebug(debugDir, `sso-wait-unexpected-${step}`, snap, secrets);
        throw new LtabFlowError("page_changed", "Smart-ID: koda lapa bez pieprasījuma");
      }
      // Gaida, kamēr Nils apstiprina telefonā (pāradresācija atpakaļ uz LTAB) vai atsaka.
      const res = await waitForSmartId(page, {
        snapshotFn: snapshot,
        codeAlreadySent: codeSent,
        timeoutMs: smartIdTimeoutMs,
        onCode: (code) => onProgress("awaiting_smartid", code ? { verificationCode: code } : {}),
      });
      codeSent = codeSent || res.codeSent;
      log(`Smart-ID gaidīšana: ${res.status}`);
      if (res.status === "refused") throw new LtabFlowError("smartid_refused");
      if (res.status === "timeout") {
        await saveDebug(debugDir, `sso-timeout-${step}`, await snapshot(page).catch(() => snap), secrets);
        throw new LtabFlowError("smartid_timeout");
      }
      continue;
    }

    if (kind === "sso_failed") {
      await saveDebug(debugDir, `sso-failed-${step}`, snap, secrets);
      throw new LtabFlowError(codeFilled ? "smartid_refused" : "page_changed", "Vienotā pieteikšanās atteica");
    }

    if (kind === "ltab_search") {
      if (submitted) throw new LtabFlowError("page_changed", "LTAB: meklēšana nedeva rezultātu lapu");
      await checkConsentBoxes(page);
      if (!(await fillSearch(page, plate))) {
        await saveDebug(debugDir, "search-no-field", snap, secrets);
        throw new LtabFlowError("page_changed", "LTAB: nav numura lauka");
      }
      await onProgress("searching", {});
      await pause();
      const clicked = await clickByText(page, /mekl[eē]t|atlas[iī]t|p[aā]rbaud[iī]t|search/i);
      if (!clicked) {
        await saveDebug(debugDir, "search-no-button", snap, secrets);
        throw new LtabFlowError("page_changed", "LTAB: nav pogas Meklēt");
      }
      submitted = true;
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      continue;
    }

    if (kind === "ltab_result_none") {
      await saveDebug(debugDir, "result-none", snap, secrets);
      // Ja LTAB tomēr dod izziņas PDF arī bez negadījumiem, paņemam to (Vercel izlemj pēc PDF satura).
      const hasPdf = snap.buttons.some((b) => b.visible !== false && isPdfControlText(b.text));
      const pdf = hasPdf ? await downloadPdf(page, maxPdfBytes).catch(() => null) : null;
      return { found: false, pdf };
    }

    if (kind === "ltab_result_found") {
      await saveDebug(debugDir, "result-found", snap, secrets);
      const pdf = await downloadPdf(page, maxPdfBytes);
      if (!pdf) throw new LtabFlowError("pdf_missing");
      return { found: true, pdf };
    }

    // Nezināma lapa: ja tā ir LTAB ar maksājumu, apstājamies; citādi īsi pagaidām (pāradresācijas).
    if (isLtabHost(snap.host) && snap.buttons.some((b) => isPayText(b.text)) && !submitted) throw new LtabFlowError("paid");
    if (isLtabHost(snap.host) && submitted) {
      await saveDebug(debugDir, "result-unknown", snap, secrets);
      throw new LtabFlowError("page_changed", "LTAB: nezināma rezultātu lapa");
    }
    if (step > 3 && !isLatvijaHost(snap.host) && !isLtabHost(snap.host)) throw new LtabFlowError("page_changed", `nezināms hosts ${snap.host}`);
    if (isLatvijaHost(snap.host) && codeSent) {
      // Pēc apstiprinājuma SSO var prasīt "Turpināt" / "Piekrītu" (nekad "Atcelt").
      const cont = page.locator("button, input[type=submit], a").filter({ hasText: /turpin[aā]t|piekr[iī]tu|continue/i }).first();
      if (await cont.isVisible().catch(() => false)) {
        await cont.click().catch(() => undefined);
        await sleep(2000);
        continue;
      }
    }
    await saveDebug(debugDir, `unknown-${step}`, snap, secrets);
    await sleep(2500);
  }
  throw new LtabFlowError("page_changed", "LTAB: pārāk daudz soļu");
}
