/**
 * Traficom plūsma pārlūkā: publiskie transportlīdzekļa dati pēc VIN (asiointi.traficom.fi) ar Suomi.fi eIDAS
 * pieteikšanos caur Latvijas VISS un eParaksts Mobile. Tikai bezmaksas dati; nekad neapmaksā un nekad neatver
 * maksas akordeonus (Owners and holders, Owner history, Inspection history, Insurance history, Use history,
 * Decommissioning history), nekad nespiež pogu uz soli "Payment".
 *
 * Drošība: lietotāja numurs tiek ievadīts ar `locator.fill` un nekur netiek logots; pieteikšanās lapām
 * (suomi.fi, VISS, eParaksts) netiek taisīti ekrānuzņēmumi vai HTML kopijas. Atkļūdošanai `debug/`: Traficom lapu
 * teksts (bez personas datiem) un pieteikšanās lapām tikai struktūra (pogas, lauki) ar cipariem aizvietotiem ar #.
 */
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildTraficomData,
  buildTraficomRawText,
  classifySnapshot,
  extractVerificationCode,
  isEparakstsHost,
  isFeeSectionTitle,
  isFeeText,
  isSuomiFiHost,
  isTraficomHost,
  isVpmHost,
  redact,
  TRAFICOM_SERVICE_URL,
  traficomDataHasContent,
} from "./traficom-page.mjs";

export class TraficomFlowError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(1500 + Math.round(Math.random() * 2000));

/** Lapas kopsavilkums `classifySnapshot` vajadzībām (tikai redzamie elementi). */
export async function snapshot(page) {
  const url = new URL(page.url());
  const data = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    };
    const labelOf = (el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return [byFor?.textContent, el.closest("label")?.textContent, el.getAttribute("aria-label"), el.getAttribute("placeholder")]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 200);
    };
    const inputs = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].map((el) => ({
      id: el.getAttribute("id") || "",
      name: el.getAttribute("name") || "",
      type: (el.getAttribute("type") || "").toLowerCase(),
      label: labelOf(el),
      visible: vis(el),
    }));
    const buttons = [...document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]')].map((el) => ({
      id: el.getAttribute("id") || "",
      text: (el.textContent || el.getAttribute("value") || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 160),
      visible: vis(el),
    }));
    // Aktīvais solis (Traficom vedņa "1 Instructions / 2 Find vehicle information / 3 Vehicle information / 4 Payment").
    const active = document.querySelector('[aria-current="step"], [aria-current="true"], .active[class*="step" i], [class*="step" i][class*="active" i], [class*="current" i][class*="step" i]');
    const h = [...document.querySelectorAll("h1, h2")].filter(vis).map((e) => e.textContent.trim()).slice(0, 3).join(" | ");
    const codeCandidates = [...document.querySelectorAll('[id*="code" i], [class*="code" i], [id*="verif" i], [class*="verif" i]')]
      .filter(vis)
      .map((el) => (el.textContent || "").replace(/\s+/g, ""))
      .filter((t) => /^[0-9]{4,6}$/.test(t))
      .slice(0, 5);
    return {
      text: (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 20000),
      inputs,
      buttons,
      stepText: (active ? active.textContent.replace(/\s+/g, " ").trim() : "").slice(0, 200),
      headings: h.slice(0, 300),
      hasAgree: Boolean(document.querySelector('input[type="checkbox"][name="agree"]')),
      mobileChoice: Boolean(document.querySelector('.js--vpm-auth-button[data-url*="scheme=mobile_eidas" i]')),
      hasCaptchaFrame: Boolean(document.querySelector('iframe[src*="captcha" i], .g-recaptcha, .h-captcha')),
      codeCandidates,
    };
  });
  return { host: url.hostname, path: url.pathname, ...data };
}

function isLoginHost(host) {
  return isSuomiFiHost(host) || isVpmHost(host) || isEparakstsHost(host);
}

async function saveDebug(debugDir, name, snap, secrets) {
  if (!debugDir) return;
  try {
    await fs.mkdir(debugDir, { recursive: true, mode: 0o700 });
    const login = isLoginHost(snap.host);
    const body = redact(
      JSON.stringify(
        login
          ? {
              host: snap.host,
              path: snap.path,
              text: redact(snap.text, secrets).replace(/\d/g, "#").slice(0, 3000),
              inputs: (snap.inputs ?? []).map((i) => ({ ...i, label: String(i.label ?? "").replace(/\d/g, "#") })),
              buttons: (snap.buttons ?? []).filter((b) => b.visible).slice(0, 40),
            }
          : { host: snap.host, path: snap.path, stepText: snap.stepText, text: redact(snap.text, secrets).slice(0, 8000), buttons: (snap.buttons ?? []).filter((b) => b.visible).slice(0, 60) },
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

/** Klikšķis pēc teksta; maksas / atcelšanas pogas nekad. */
async function clickByText(page, re, { selector = 'button, input[type="submit"], input[type="button"], a, [role="button"]', allowFeeWord = false } = {}) {
  const candidates = page.locator(selector);
  const n = await candidates.count();
  for (let i = 0; i < n; i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const text = ((await el.textContent().catch(() => "")) || (await el.getAttribute("value").catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (!re.test(text)) continue;
    if (/cancel|atcelt|peruuta|keskeyt|log\s*out|kirjaudu\s+ulos|iziet/i.test(text)) continue;
    if (!allowFeeWord && isFeeText(text)) continue;
    await el.click();
    return true;
  }
  return false;
}

/** Traficom UI angliski (ja ir valodas izvēle) - teksta atpazīšana balstās uz EN; FI arī tiek atpazīta. */
async function preferEnglish(page) {
  const en = page.locator('a[lang="en"], button[lang="en"], a[hreflang="en"], [data-lang="en"]').first();
  if (await en.isVisible().catch(() => false)) {
    await en.click().catch(() => undefined);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await sleep(1200);
    return;
  }
  await clickByText(page, /^\s*(in\s+english|english|en)\s*(\(en\))?\s*$/i).catch(() => false);
}

/** 2. solis: "by vehicle identification number (VIN)", VIN, "Vehicle type" = Car, "Search". */
async function fillVinSearch(page, vin, vehicleType) {
  const radios = page.locator('input[type="radio"]');
  const rn = await radios.count();
  for (let i = 0; i < rn; i++) {
    const r = radios.nth(i);
    const label = await r.evaluate((el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return [byFor?.textContent, el.closest("label")?.textContent, el.getAttribute("value"), el.getAttribute("aria-label")].filter(Boolean).join(" ");
    });
    if (/vehicle\s+identification\s+number|\(vin\)|\bvin\b|valmistenumero/i.test(label)) {
      await r.check({ force: true }).catch(async () => {
        const id = await r.getAttribute("id");
        if (id) await page.locator(`label[for="${id}"]`).click();
      });
      await sleep(600);
      break;
    }
  }
  const fields = page.locator('input[type="text"], input[type="search"], input:not([type])');
  const n = await fields.count();
  let filled = false;
  for (let i = 0; i < n; i++) {
    const f = fields.nth(i);
    if (!(await f.isVisible().catch(() => false))) continue;
    const label = await f.evaluate((el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return [byFor?.textContent, el.getAttribute("name"), id, el.getAttribute("placeholder"), el.getAttribute("aria-label")].filter(Boolean).join(" ");
    });
    if (!/vin|vehicle\s+identification|valmistenumero/i.test(label)) continue;
    await f.fill(vin);
    filled = true;
    break;
  }
  if (!filled) return false;
  // Vehicle type: select vai radio ar "Car" / "Henkilöauto".
  const typeRe = vehicleType === "car" ? /^\s*(car|passenger\s+car|henkil[oö]auto)\s*$/i : new RegExp(`^\\s*${vehicleType}\\s*$`, "i");
  const selects = page.locator("select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const s = selects.nth(i);
    if (!(await s.isVisible().catch(() => false))) continue;
    const options = await s.evaluate((el) => [...el.options].map((o) => ({ value: o.value, text: o.textContent.trim() })));
    const hit = options.find((o) => typeRe.test(o.text));
    if (hit) await s.selectOption(hit.value).catch(() => undefined);
  }
  for (let i = 0; i < rn; i++) {
    const r = radios.nth(i);
    const label = await r.evaluate((el) => {
      const id = el.getAttribute("id");
      const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return [byFor?.textContent, el.closest("label")?.textContent].filter(Boolean).join(" ").trim();
    });
    if (typeRe.test(label)) {
      await r.check({ force: true }).catch(() => undefined);
      break;
    }
  }
  // Custom dropdown (combobox) ar "Vehicle type".
  const combo = page.getByRole("combobox", { name: /vehicle\s+type|ajoneuvolaji/i }).first();
  if (await combo.isVisible().catch(() => false)) {
    const current = ((await combo.textContent().catch(() => "")) || "").trim();
    if (!typeRe.test(current)) {
      await combo.click().catch(() => undefined);
      await sleep(500);
      await page.getByRole("option", { name: typeRe }).first().click().catch(() => undefined);
    }
  }
  return true;
}

/**
 * 3. soļa izvilkums: virsraksts, sarkanais baneris, augšējā tabula, ierobežojumu saraksts ar ikonu toni, avots,
 * bezmaksas akordeoni (maksas akordeonus neatver - tos filtrē jau pirms klikšķa).
 */
async function openFreeAccordions(page) {
  const headers = page.locator('button[aria-expanded], [role="button"][aria-expanded], summary');
  const n = await headers.count();
  let opened = 0;
  for (let i = 0; i < n; i++) {
    const h = headers.nth(i);
    if (!(await h.isVisible().catch(() => false))) continue;
    const text = ((await h.textContent().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (!text || isFeeSectionTitle(text) || /open\s+all|close\s+all|avaa\s+kaikki|sulje\s+kaikki|menu|valikko|language|kieli/i.test(text)) continue;
    const expanded = await h.getAttribute("aria-expanded").catch(() => null);
    if (expanded === "true") {
      opened++;
      continue;
    }
    if (expanded === null && (await h.evaluate((el) => el.tagName === "SUMMARY" && el.parentElement?.open).catch(() => false))) {
      opened++;
      continue;
    }
    await h.click().catch(() => undefined);
    opened++;
    await sleep(250);
  }
  return opened;
}

/** Pārlūkā: lapas dati (pašpietiekama funkcija `page.evaluate`). */
export function collectVehicleInfo() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const st = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
  };
  const txt = (el) => (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
  const rowsIn = (root) => {
    const rows = [];
    for (const tr of root.querySelectorAll("tr")) {
      const cells = [...tr.querySelectorAll("th, td")].map(txt).filter(Boolean);
      if (cells.length >= 2) rows.push([cells[0], cells.slice(1).join(" / ")]);
    }
    for (const dl of root.querySelectorAll("dl")) {
      let label = "";
      for (const el of dl.children) {
        if (el.tagName === "DT") label = txt(el);
        else if (el.tagName === "DD" && label) rows.push([label, txt(el)]);
        else if (el.tagName === "DIV") {
          const dt = el.querySelector("dt");
          const dd = [...el.querySelectorAll("dd")].map(txt).join(" / ");
          if (dt && dd) rows.push([txt(dt), dd]);
        }
      }
    }
    if (!rows.length) {
      // Bez tabulām: elementi ar diviem bērniem "etiķete / vērtība".
      for (const el of root.querySelectorAll("div, li")) {
        const kids = [...el.children].filter(vis);
        if (kids.length !== 2 || kids.some((k) => k.children.length > 3)) continue;
        const [a, b] = kids.map(txt);
        if (a && b && a.length <= 120 && !/[.!?]$/.test(a)) rows.push([a, b]);
      }
    }
    return rows;
  };
  const toneOf = (el) => {
    const bits = [];
    for (const n of [el, ...el.querySelectorAll("svg, i, img, span, use")].slice(0, 8)) {
      bits.push(n.getAttribute?.("class") || "", n.getAttribute?.("aria-label") || "", n.getAttribute?.("alt") || "", n.getAttribute?.("href") || "", n.getAttribute?.("xlink:href") || "");
      const c = window.getComputedStyle(n).color || "";
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const [r, g, b] = m.slice(1).map(Number);
        if (r > 170 && g < 90 && b < 90) bits.push("red");
        else if (r > 180 && g > 130 && b < 80) bits.push("yellow");
      }
    }
    return bits.join(" ");
  };
  const main = document.querySelector("main") || document.body;
  const title = txt([...main.querySelectorAll("h1, h2, h3")].find((h) => vis(h) && /^(car|henkilöauto|van|pakettiauto|motorcycle|moottoripyörä|truck|kuorma-auto|trailer|perävaunu|bus|linja-auto)\b/i.test(txt(h))));
  const banners = [...main.querySelectorAll('[role="alert"], [class*="alert" i], [class*="banner" i], [class*="error" i], [class*="danger" i]')]
    .filter(vis)
    .map(txt)
    .filter((t) => t && t.length < 300 && /prohibit|kielto|stolen|varastettu/i.test(t));
  // Augšējā tabula: pirmā tabula/dl pirms akordeoniem.
  const firstAcc = main.querySelector('button[aria-expanded], [role="button"][aria-expanded], details');
  const summaryRoots = [...main.querySelectorAll("table, dl")].filter(
    (t) => vis(t) && (!firstAcc || t.compareDocumentPosition(firstAcc) & Node.DOCUMENT_POSITION_FOLLOWING) && !t.closest('[role="region"], details, [class*="accordion" i] [class*="content" i]'),
  );
  const summary = summaryRoots.flatMap(rowsIn);
  // Ierobežojumi / piezīmes: saraksts zem "Restriction or remark information".
  const remarks = [];
  const remarkHead = [...main.querySelectorAll("h2, h3, h4, strong, p, span, div")].find((el) => /restriction\s+or\s+remark|rajoitus-\s*tai\s+huomautus|rajoitukset/i.test(txt(el)) && txt(el).length < 80);
  if (remarkHead) {
    let box = remarkHead.parentElement;
    for (let i = 0; i < 3 && box && !box.querySelector("li"); i++) box = box.parentElement;
    for (const li of box ? box.querySelectorAll("li") : []) {
      if (!vis(li)) continue;
      const t = txt(li);
      if (t) remarks.push({ text: t, tone: toneOf(li) });
    }
  }
  const source = txt([...main.querySelectorAll("p, span, div, small")].find((el) => /^(source|lähde)\s*:/i.test(txt(el)) && txt(el).length < 120));
  // Akordeoni: virsraksts + saturs (aria-controls vai nākamais elements / details).
  const sections = [];
  for (const h of main.querySelectorAll('button[aria-expanded], [role="button"][aria-expanded], summary')) {
    const title = txt(h);
    if (!title || /open\s+all|close\s+all|avaa\s+kaikki|sulje\s+kaikki/i.test(title)) continue;
    let body = null;
    const ctl = h.getAttribute("aria-controls");
    if (ctl) body = document.getElementById(ctl);
    if (!body && h.tagName === "SUMMARY") body = h.parentElement;
    if (!body) {
      const wrap = h.closest("h2, h3, h4") || h;
      body = wrap.nextElementSibling;
    }
    if (!body) continue;
    sections.push({ title, rows: rowsIn(body) });
  }
  // PDF saite: "Download the vehicle's free information (pdf)".
  const pdfLink = [...main.querySelectorAll("a, button")].find((a) => vis(a) && /free\s+information.*pdf|maksuttomat\s+tiedot.*pdf/i.test(txt(a)));
  return {
    title,
    banners,
    summary,
    remarks,
    source,
    sections,
    pdfHref: pdfLink && pdfLink.tagName === "A" ? pdfLink.href : "",
    hasPdfLink: Boolean(pdfLink),
  };
}

/** Bezmaksas PDF: tieša lejupielāde pēc href (tās pašas sīkdatnes) vai klikšķis + download. */
async function downloadFreePdf(page, info, maxBytes) {
  const context = page.context();
  if (info.pdfHref) {
    try {
      const host = new URL(info.pdfHref).hostname;
      if (isTraficomHost(host)) {
        const res = await context.request.get(info.pdfHref, { timeout: 30_000 });
        const body = await res.body();
        if (res.ok() && body.byteLength <= maxBytes && body.subarray(0, 4).toString("latin1") === "%PDF") return body;
      }
    } catch {
      /* mēģinām ar klikšķi */
    }
  }
  if (!info.hasPdfLink) return null;
  let captured = null;
  const onResponse = async (res) => {
    try {
      if (captured || !(res.headers()["content-type"] || "").toLowerCase().includes("application/pdf")) return;
      if (!isTraficomHost(new URL(res.url()).hostname)) return;
      const body = await res.body();
      if (body.byteLength > 4 && body.byteLength <= maxBytes) captured = body;
    } catch {
      /* aizvērts */
    }
  };
  const popups = [];
  const onPage = (p) => popups.push(p);
  context.on("response", onResponse);
  context.on("page", onPage);
  try {
    const download = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
    // "free information (pdf)" - vārds "free" ir obligāts, maksas saites izslēgtas.
    if (!(await clickByText(page, /free\s+information.*pdf|maksuttomat\s+tiedot.*pdf/i, { selector: "a, button" }))) return null;
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
    context.off("page", onPage);
    for (const p of popups) await p.close().catch(() => undefined);
  }
}

/** eParaksts apstiprinājuma gaidīšana: kamēr pārlūks ir eParaksts gaidīšanas lapā. */
async function waitForEparaksts(page, { onCode, timeoutMs, secrets }) {
  const deadline = Date.now() + timeoutMs;
  let sent = false;
  const codeDeadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const host = (() => {
      try {
        return new URL(page.url()).hostname;
      } catch {
        return "";
      }
    })();
    if (!isEparakstsHost(host)) return { status: "left", codeSent: sent };
    const snap = await snapshot(page).catch(() => null);
    if (snap) {
      const kind = classifySnapshot(snap);
      if (kind === "ep_failed") return { status: "refused", codeSent: sent };
      if (kind === "ep_consent") return { status: "consent", codeSent: sent };
      if (!sent) {
        const code = extractVerificationCode(redact(snap.text, secrets), snap.codeCandidates);
        if (code || Date.now() >= codeDeadline) {
          sent = true;
          await onCode(code);
        }
      }
    }
    await sleep(2000);
  }
  return { status: "timeout", codeSent: sent };
}

/**
 * Viens Traficom vaicājums pēc VIN. `onProgress(state, extra)`: awaiting_eparaksts (ar kodu, ja redzams), searching.
 * Atgriež { found, data, rawText, pdf }.
 */
export async function runTraficomLookup({
  page,
  vin,
  userNumber,
  vehicleType = "car",
  onProgress,
  log,
  debugDir,
  eparakstsTimeoutMs = 300_000,
  maxPdfBytes = 3 * 1024 * 1024,
}) {
  const secrets = [userNumber];
  let numberSent = false;
  let approved = false;
  let searched = false;
  let instructionsDone = 0;
  await page.goto(TRAFICOM_SERVICE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });

  for (let step = 0; step < 30; step++) {
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await sleep(1200);
    const snap = await snapshot(page).catch(async () => {
      await sleep(2000);
      return snapshot(page);
    });
    const kind = classifySnapshot(snap);
    log(`solis ${step}: ${kind} (${snap.host})`);

    if (kind === "captcha") throw new TraficomFlowError("captcha");
    if (kind === "tf_payment") {
      // Nekad: maksājuma solis. Atpakaļ neejam, vienkārši apstājamies.
      await saveDebug(debugDir, "payment-stop", snap, secrets);
      throw new TraficomFlowError("paid");
    }

    if (kind === "fi_choose_method") {
      if (numberSent) throw new TraficomFlowError("eparaksts_refused", "pēc eParaksts atkal metodes izvēle");
      await page.locator("a#eidas_high").first().click();
      continue;
    }
    if (kind === "fi_choose_country") {
      await page.locator("a#LV").first().click();
      continue;
    }
    if (kind === "vpm_choose") {
      if (numberSent) throw new TraficomFlowError("eparaksts_refused", "VISS: atpakaļ uz metodes izvēli");
      const agree = page.locator('input[type="checkbox"][name="agree"]').first();
      if ((await agree.count()) && !(await agree.isChecked().catch(() => true))) {
        await agree.check({ force: true }).catch(async () => {
          const id = await agree.getAttribute("id");
          if (id) await page.locator(`label[for="${id}"]`).click();
        });
        await sleep(700);
      }
      const mobile = page.locator('.js--vpm-auth-button[data-url*="scheme=mobile_eidas" i]').first();
      if (!(await mobile.count())) {
        await saveDebug(debugDir, `vpm-no-mobile-${step}`, snap, secrets);
        throw new TraficomFlowError("page_changed", "VISS: nav eParaksts Mobile izvēles");
      }
      await mobile.click();
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      continue;
    }
    if (kind === "ep_user_number") {
      if (numberSent) {
        await saveDebug(debugDir, `ep-number-again-${step}`, snap, secrets);
        throw new TraficomFlowError("eparaksts_refused", "eParaksts: lietotāja numura forma atkārtojas");
      }
      const input = page.locator("#identifierForm-identifier");
      if (!(await input.isVisible().catch(() => false))) throw new TraficomFlowError("page_changed", "eParaksts: nav lietotāja numura lauka");
      await input.fill(String(userNumber).trim());
      await pause();
      const ok = page.locator("#identifierForm-submitButton");
      if (await ok.isVisible().catch(() => false)) await ok.click();
      else if (!(await clickByText(page, /^\s*(confirm|apstiprin[aā]t)\s*$/i))) throw new TraficomFlowError("page_changed", "eParaksts: nav pogas Confirm");
      numberSent = true;
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      continue;
    }
    if (kind === "ep_wait") {
      if (!numberSent && !approved) {
        await saveDebug(debugDir, `ep-wait-unexpected-${step}`, snap, secrets);
        throw new TraficomFlowError("page_changed", "eParaksts: gaidīšanas lapa bez pieprasījuma");
      }
      const res = await waitForEparaksts(page, {
        secrets,
        timeoutMs: eparakstsTimeoutMs,
        onCode: (code) => onProgress("awaiting_eparaksts", code ? { verificationCode: code } : {}),
      });
      log(`eParaksts gaidīšana: ${res.status}`);
      if (res.status === "refused") throw new TraficomFlowError("eparaksts_refused");
      if (res.status === "timeout") throw new TraficomFlowError("eparaksts_timeout");
      approved = true;
      continue;
    }
    if (kind === "ep_consent") {
      // userConsent: "Agree" (nekad "Cancel"/"Disagree").
      if (!(await clickByText(page, /^\s*(agree|piekr[iī]tu|i\s+agree)\s*$/i))) throw new TraficomFlowError("page_changed", "eParaksts: nav pogas Agree");
      approved = true;
      continue;
    }
    if (kind === "ep_failed") {
      await saveDebug(debugDir, `ep-failed-${step}`, snap, secrets);
      throw new TraficomFlowError(numberSent ? "eparaksts_refused" : "page_changed", "eParaksts atteica");
    }
    if (kind === "fi_continue") {
      await clickByText(page, /continue\s+to\s+(the\s+)?service|jatka\s+palveluun|siirry\s+palveluun|forts[aä]tt/i);
      continue;
    }

    if (kind === "tf_instructions") {
      if (step <= 12) await preferEnglish(page);
      if (++instructionsDone > 3) throw new TraficomFlowError("page_changed", "Traficom: Instructions solis atkārtojas");
      if (!(await clickByText(page, /^\s*(next|seuraava|n[aä]sta)\s*›?\s*$/i))) {
        await saveDebug(debugDir, "instructions-no-next", snap, secrets);
        throw new TraficomFlowError("page_changed", "Traficom: nav pogas Next");
      }
      continue;
    }
    if (kind === "tf_search") {
      if (searched) {
        await saveDebug(debugDir, "search-again", snap, secrets);
        throw new TraficomFlowError("page_changed", "Traficom: meklēšana nedeva rezultātu");
      }
      await onProgress("searching", {});
      if (!(await fillVinSearch(page, vin, vehicleType))) {
        await saveDebug(debugDir, "search-no-field", snap, secrets);
        throw new TraficomFlowError("page_changed", "Traficom: nav VIN lauka");
      }
      await pause();
      if (!(await clickByText(page, /^\s*(search|hae|s[oö]k)\s*$/i))) {
        await saveDebug(debugDir, "search-no-button", snap, secrets);
        throw new TraficomFlowError("page_changed", "Traficom: nav pogas Search");
      }
      searched = true;
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      continue;
    }
    if (kind === "tf_not_found") {
      await saveDebug(debugDir, "not-found", snap, secrets);
      return { found: false, data: null, rawText: "", pdf: null };
    }
    if (kind === "tf_result") {
      if (!searched) await onProgress("searching", {});
      const opened = await openFreeAccordions(page);
      if (!opened) {
        // Nav atsevišķu akordeonu - "Open all" (maksas sekcijas lasot izmet; maksas datus Traficom tur nerāda).
        await clickByText(page, /^\s*(open\s+all|avaa\s+kaikki)\s*$/i).catch(() => false);
      }
      await sleep(1200);
      const raw = await page.evaluate(collectVehicleInfo);
      const data = buildTraficomData(raw, secrets);
      await saveDebug(debugDir, "result", { ...snap, text: snap.text }, secrets);
      if (!traficomDataHasContent(data)) throw new TraficomFlowError("page_changed", "Traficom: rezultāta lapā nav nolasāmu datu");
      const rawText = buildTraficomRawText(data);
      const pdf = await downloadFreePdf(page, raw, maxPdfBytes).catch(() => null);
      log(`nolasīts: ${data.summary.length} pamatrindas, ${data.sections.length} sadaļas, ${data.flags.length} karogi${pdf ? ", PDF" : ""}`);
      return { found: true, data, rawText, pdf };
    }

    if (kind === "tf_other") {
      // Traficom sākumlapa / "My e-services" - ejam tieši uz pakalpojumu (vienreiz pa solim).
      if (!page.url().startsWith(TRAFICOM_SERVICE_URL)) {
        await page.goto(TRAFICOM_SERVICE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
        continue;
      }
      await saveDebug(debugDir, `tf-unknown-${step}`, snap, secrets);
      await sleep(2500);
      continue;
    }
    if (step > 4 && !isLoginHost(snap.host) && !isTraficomHost(snap.host)) throw new TraficomFlowError("page_changed", `nezināms hosts ${snap.host}`);
    await saveDebug(debugDir, `unknown-${step}`, snap, secrets);
    await sleep(2500);
  }
  throw new TraficomFlowError("page_changed", "Traficom: pārāk daudz soļu");
}
