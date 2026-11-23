/**
 * e.csdd pārlūka soļi (Playwright, īsts Chrome zem Xvfb): pieteikšanās ar Vienoto pieteikšanos + Smart-ID,
 * keep-alive pārbaude, `tadati` uzziņa pēc VIN vai numura, iziešana.
 * Tikai lasīšana: nekad nespiež maksājumu, "Saglabāt", "Anulēt" vai citas e.csdd darbības.
 *
 * Drošība: personas kods tiek ievadīts ar `locator.fill` un nekur netiek logots; SSO (vpm.viss.gov.lv / latvija.lv)
 * lapām netiek saglabāts nekas. Atkļūdošanai `debug/` tikai e.csdd lapu teksts ar aizvietotiem personas kodiem.
 */
import fs from "node:fs/promises";
import path from "node:path";

import {
  classifySnapshot,
  ECSDD_HOME_URL,
  ECSDD_SSO_URL,
  ECSDD_TADATI_URL,
  extractTadatiText,
  formatTadatiPanels,
  isEcsddHost,
  isPayText,
  isSsoHost,
  pickAccountIndex,
  redact,
} from "./ecsdd-page.mjs";
import {
  appRegisterUrl,
  appUserAgentOverride,
  classifyPaidPage,
  findPreparedFooter,
  findSmsHrefs,
  formatPaidReportPanels,
  MOBINT_STUB_SCRIPT,
  PAID_REPORT_TITLES,
  paidReportLooksComplete,
  PAID_FORBIDDEN_RE,
  PAID_LIST_LINK_RE,
  PAID_MENU_RE,
  PAID_REFRESH_RE,
  PAID_REQUEST_RE,
  parsePaidConfirmText,
  parsePaidListRows,
  parseSmsHref,
  pickPaidReport,
  redactPaidText,
  smsBodyMatchesPlate,
  smsHrefsFromMobintCalls,
} from "./ecsdd-paid.mjs";
import { chooseSmartId, collectSsoExtras, submitPersonalCode, waitForSmartId } from "./viss-sso.mjs";

export class EcsddFlowError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(2000 + Math.round(Math.random() * 3000));

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
      return [byFor?.textContent, el.closest("label")?.textContent, el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.getAttribute("name"), id]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 300);
    };
    const inputs = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea")].map((el) => ({
      label: labelOf(el),
      type: (el.getAttribute("type") || "").toLowerCase(),
      id: el.getAttribute("id") || "",
      visible: vis(el),
    }));
    const buttons = [...document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button, a[role="button"]')].map((el) => ({
      text: (el.textContent || el.getAttribute("value") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 160),
      visible: vis(el),
    }));
    const links = [...document.querySelectorAll("a[href]")]
      .filter(vis)
      .map((el) => ({ text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80), href: (el.getAttribute("href") || "").slice(0, 200) }))
      .slice(0, 200);
    const accounts = [...document.querySelectorAll("li.account-item")].map((li) => ({
      id: li.getAttribute("id") || "",
      name: (li.querySelector("a > p")?.textContent || li.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
    }));
    // Ielogotā cilvēka vārds (galvene, profils, privātpersonas konts) - tikai, lai to izņemtu no atkļūdošanas failiem.
    const personNames = [
      ...[...document.querySelectorAll(".profile-select nav header h4, .profile-select > a > p, #page-e-csdd-profile .group-right h1")].map((el) => el.textContent || ""),
      ...accounts.filter((a) => a.id === "1").map((a) => a.name),
    ]
      .map((t) => t.replace(/\s+/g, " ").trim())
      .filter((t) => t.length >= 3);
    return {
      accounts,
      personNames,
      accountSwitch: Boolean(document.querySelector("#page-e-csdd-account-switch, .account-switch")),
      hasLogout: Boolean(document.querySelector('#logout, a[href="/login/"] .icon-exit')),
      path: location.pathname,
      text: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 20000),
      inputs,
      buttons,
      links,
      hasCaptchaFrame: Boolean(document.querySelector('iframe[src*="captcha" i], .g-recaptcha, .h-captcha')),
    };
  });
  const sso = isSsoHost(host) ? await page.evaluate(collectSsoExtras).catch(() => ({})) : {};
  return { host, ...data, ...sso };
}

/** Pārlūkā: `tadati` akordeona paneļi ar VISĀM tabulu rindām (arī aizvērtajiem paneļiem, ko innerText nerāda). */
export function collectTadatiPanels() {
  const cell = (el) => {
    // Ikonu <svg>/<style> saturs nav teksts.
    const c = el.cloneNode(true);
    for (const x of c.querySelectorAll("style, svg, script")) x.remove();
    return (c.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  };
  const panels = [...document.querySelectorAll("section")]
    .filter((s) => s.querySelector(':scope > input[name="panels"]'))
    .map((s) => ({
      title: s.querySelector(":scope > label") ? cell(s.querySelector(":scope > label")) : "",
      rows: [...s.querySelectorAll("tr")].map((tr) => [...tr.children].filter((c) => /^(TD|TH)$/.test(c.tagName)).map(cell)),
    }));
  const foot = document.querySelector("tr.tr-basedata");
  return { panels, footer: foot ? cell(foot) : "" };
}

/**
 * Pārlūkā: visas klikšķināmās vadīklas (arī paslēptās izvēlnē) ar marķieri `data-provin-ctl`, lai tās var atrast vēlreiz.
 * Tikai lasa un iezīmē - neko nespiež.
 */
export function collectPaidControls() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const st = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
  };
  const els = [...document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"], [onclick]')];
  return els.map((el, i) => {
    el.setAttribute("data-provin-ctl", String(i));
    return {
      i,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || el.getAttribute("value") || el.getAttribute("title") || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 160),
      href: el.getAttribute("href") || "",
      onclick: (el.getAttribute("onclick") || "").slice(0, 400),
      data: [...el.attributes].filter((a) => /^data-/.test(a.name)).map((a) => a.value).join(" ").slice(0, 400),
      visible: vis(el),
    };
  });
}

/** Pārlūkā: tabulu rindas (šūnu teksti), rinda iezīmēta ar `data-provin-row`; vai rindā ir saite. */
export function collectPaidTableRows() {
  return [...document.querySelectorAll("tr")].map((tr, i) => {
    tr.setAttribute("data-provin-row", String(i));
    // innerText: <br> starp datumu un laiku -> atstarpe (textContent tos salīmētu).
    const cells = [...tr.children].filter((c) => /^(TD|TH)$/.test(c.tagName)).map((c) => (c.innerText || c.textContent || "").replace(/\s+/g, " ").trim());
    const a = tr.querySelector("a[href]");
    return { cells, href: a ? a.getAttribute("href") || "" : "", clickable: Boolean(a || tr.getAttribute("onclick") || tr.querySelector("button, [onclick]") || tr.dataset.href) };
  });
}

/**
 * Pārlūkā: maksas izziņas akordeoni ar visām rindām (arī aizvērtie). `titles` - zināmie virsraksti (salocīti).
 * 1) tāda pati struktūra kā tadati (section > input[name=panels]); 2) elements ar virsraksta tekstu + tuvākais konteiners.
 */
export function collectPaidPanels(titles) {
  const fold = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim().replace(/:$/, "");
  const want = new Set(titles);
  const cell = (el) => {
    const c = el.cloneNode(true);
    for (const x of c.querySelectorAll("style, svg, script")) x.remove();
    return (c.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  };
  const rowsOf = (root) => {
    const rows = [...root.querySelectorAll("tr")].map((tr) => [...tr.children].filter((c) => /^(TD|TH)$/.test(c.tagName)).map(cell));
    for (const dl of root.querySelectorAll("dl")) {
      const dts = [...dl.querySelectorAll("dt")];
      for (const dt of dts) rows.push([cell(dt), dt.nextElementSibling ? cell(dt.nextElementSibling) : ""]);
    }
    return rows.filter((r) => r.some(Boolean));
  };
  const linesOf = (root, titleEl) => {
    const c = root.cloneNode(true);
    for (const x of c.querySelectorAll("style, svg, script, table, dl, button")) x.remove();
    const t = titleEl ? cell(titleEl) : "";
    return (c.innerText || c.textContent || "")
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l && l !== t);
  };
  const sections = [...document.querySelectorAll("section")].filter((s) => s.querySelector(':scope > input[name="panels"]'));
  if (sections.length >= 3) {
    return sections.map((s) => {
      const lab = s.querySelector(":scope > label");
      const rows = rowsOf(s);
      return { title: lab ? cell(lab) : "", rows, lines: rows.length ? [] : linesOf(s, lab) };
    });
  }
  const heads = [...document.querySelectorAll("label, h1, h2, h3, h4, h5, button, a, summary, span, div, p, dt")].filter((el) => {
    if (!want.has(fold(el.textContent))) return false;
    // tikai iekšējākais elements ar šo tekstu
    return ![...el.children].some((c) => fold(c.textContent) === fold(el.textContent));
  });
  const seen = new Set();
  const out = [];
  for (const h of heads) {
    const key = fold(h.textContent);
    if (seen.has(key)) continue;
    seen.add(key);
    // Konteiners: augšup, kamēr tajā ir tikai šis virsraksts un parādās saturs.
    let box = h.parentElement;
    for (let up = 0; box && up < 6; up++) {
      const others = heads.filter((x) => x !== h && box.contains(x));
      if (others.length) {
        box = null;
        break;
      }
      const hasContent = box.querySelector("table, dl, p, li, div") && (box.textContent || "").replace(/\s+/g, " ").trim().length > (h.textContent || "").trim().length + 2;
      if (hasContent) break;
      box = box.parentElement;
    }
    // Saturs var būt nākamais brālis (akordeona virsraksts + panelis).
    if (!box) {
      const sib = h.closest("label, button, a, summary, div, h1, h2, h3, h4, h5")?.nextElementSibling;
      out.push({ title: cell(h), rows: sib ? rowsOf(sib) : [], lines: sib && !sib.querySelector("table, dl") ? linesOf(sib, null) : [] });
      continue;
    }
    const rows = rowsOf(box);
    out.push({ title: cell(h), rows, lines: rows.length ? [] : linesOf(box, h) });
  }
  return out;
}

const PAID_REPORT_TITLES_FOLDED = PAID_REPORT_TITLES.map((t) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(),
);

export function createEcsddBrowser({
  getContext,
  personalCode,
  account = "person",
  log = () => undefined,
  debugDir = "",
  smartIdTimeoutMs = 120_000,
  appUid = "",
  appRegister = true,
}) {
  const secrets = [personalCode];

  /** Lapa "Izvēlies kontu": izvēlas `account` (noklusējums privātpersona). Kontu nosaukumi žurnālā netiek rakstīti. */
  async function chooseAccount(page, snap) {
    const idx = pickAccountIndex(snap.accounts, account);
    if (idx < 0) {
      await saveDebug("account-not-found", snap);
      throw new EcsddFlowError("page_changed", "e.csdd: prasītais konts nav sarakstā");
    }
    log(`konta izvēle: ${idx + 1}. no ${snap.accounts.length} (${/^person$/i.test(account) ? "privātpersona" : "pēc nosaukuma"})`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined),
      page.locator("li.account-item").nth(idx).locator("a").first().click(),
    ]);
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await sleep(1500);
  }

  async function saveDebug(name, snap) {
    // e.csdd lapas: teksts bez personas kodiem. SSO lapas: tikai neatpazītos soļos, visi cipari aizvietoti ar `#`.
    if (!debugDir || (!isEcsddHost(snap.host) && !isSsoHost(snap.host))) return;
    try {
      await fs.mkdir(debugDir, { recursive: true, mode: 0o700 });
      const sso = isSsoHost(snap.host);
      const text = redact(snap.text, secrets);
      const body = JSON.stringify(
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
          : { host: snap.host, path: snap.path, text: text.slice(0, 8000), buttons: snap.buttons, links: snap.links, accounts: (snap.accounts ?? []).length },
        null,
        1,
      );
      // Vārds/uzvārds nekad failā (garākie vispirms, bez reģistra atšķirības).
      let safe = redact(body, secrets);
      for (const n of [...new Set(snap.personNames ?? [])].sort((a, b) => b.length - a.length)) {
        safe = safe.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), "***");
      }
      await fs.writeFile(path.join(debugDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${name}.json`), safe, { mode: 0o600 });
    } catch {
      /* atkļūdošana nav obligāta */
    }
  }

  async function clickByText(page, re) {
    const candidates = page.locator('button, input[type="submit"], input[type="button"], a');
    const n = await candidates.count();
    for (let i = 0; i < n; i++) {
      const el = candidates.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const text = ((await el.textContent().catch(() => "")) || (await el.getAttribute("value").catch(() => "")) || "").trim();
      if (!re.test(text) || isPayText(text)) continue;
      await el.click();
      return true;
    }
    return false;
  }

  async function withPage(fn) {
    const ctx = await getContext();
    const page = await ctx.newPage();
    try {
      return await fn(page);
    } catch (e) {
      if (e instanceof EcsddFlowError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new EcsddFlowError(/timeout|net::|ERR_/i.test(msg) ? "unavailable" : "error", redact(msg, secrets).slice(0, 200));
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  /** Sākumlapa: vai sesija ir ielogota. */
  async function homeState(page) {
    await page.goto(ECSDD_HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    let snap = await snapshot(page);
    let kind = classifySnapshot(snap);
    if (kind === "ecsdd_account_choose") {
      await chooseAccount(page, snap);
      snap = await snapshot(page);
      kind = classifySnapshot(snap);
    }
    if (kind === "ecsdd_logged_in") return "ok";
    if (kind === "ecsdd_logged_out") return "logged_out";
    if (kind === "captcha") throw new EcsddFlowError("captcha");
    await saveDebug("home-unknown", snap);
    throw new EcsddFlowError("page_changed", `e.csdd sākumlapa neatpazīta (${snap.host})`);
  }

  async function login({ onCode }) {
    return withPage(async (page) => {
      let codeFilled = false;
      let codeSent = false;
      let accountChosen = false;
      let ssoVisits = 0;
      await page.goto(ECSDD_SSO_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
      for (let step = 0; step < 25; step++) {
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        // Pāradresācijas laikā (VISS forma iesniedz ar fetch + location.replace) evaluate var krist - vēlreiz.
        const snap = await snapshot(page).catch(async () => {
          await sleep(2000);
          await page.waitForLoadState("domcontentloaded").catch(() => undefined);
          return snapshot(page);
        });
        const kind = classifySnapshot(snap);
        log(`pieteikšanās solis ${step}: ${kind} (${snap.host})`);

        if (kind === "captcha") throw new EcsddFlowError("captcha");
        if (kind === "ecsdd_logged_in") {
          // Cits konts nekā privātpersona: e.csdd pēc noklusējuma atver privātpersonu, tāpēc izvēlamies sarakstā.
          if (!/^person$/i.test(account) && !accountChosen) {
            await page.goto(`${ECSDD_HOME_URL}?userlist=true`, { waitUntil: "domcontentloaded", timeout: 45_000 });
            const list = await snapshot(page);
            if (classifySnapshot(list) !== "ecsdd_account_choose") {
              await saveDebug("account-list-unknown", list);
              throw new EcsddFlowError("page_changed", "e.csdd: kontu saraksts neatpazīts");
            }
            await chooseAccount(page, list);
            accountChosen = true;
            continue;
          }
          return;
        }

        if (kind === "ecsdd_account_choose") {
          if (accountChosen) {
            await saveDebug(`account-repeat-${step}`, snap);
            throw new EcsddFlowError("page_changed", "e.csdd: konta izvēle atkārtojas");
          }
          await chooseAccount(page, snap);
          accountChosen = true;
          continue;
        }

        if (kind === "ecsdd_logged_out") {
          if (codeSent) throw new EcsddFlowError("login_not_kept", "pēc Smart-ID e.csdd joprojām nav ielogots");
          if (++ssoVisits > 2) throw new EcsddFlowError("page_changed", "e.csdd nepāradresē uz Vienoto pieteikšanos");
          await page.goto(ECSDD_SSO_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
          continue;
        }

        if (kind === "sso_choose") {
          if (codeFilled) throw new EcsddFlowError(codeSent ? "smartid_refused" : "page_changed", "Vienotā pieteikšanās: atpakaļ uz metodes izvēli");
          if (!(await chooseSmartId(page))) {
            await saveDebug(`sso-no-smartid-${step}`, snap);
            throw new EcsddFlowError("page_changed", "Vienotā pieteikšanās: nav Smart-ID izvēles");
          }
          continue;
        }

        if (kind === "sso_code_input") {
          if (codeFilled) throw new EcsddFlowError("page_changed", "Smart-ID: personas koda forma atkārtojas");
          if (!(await submitPersonalCode(page, personalCode))) {
            await saveDebug(`sso-no-input-${step}`, snap);
            throw new EcsddFlowError("page_changed", "Smart-ID: nav personas koda lauka");
          }
          codeFilled = true;
          continue;
        }

        if (kind === "sso_wait") {
          if (!codeFilled && !codeSent) {
            await saveDebug(`sso-wait-unexpected-${step}`, snap);
            throw new EcsddFlowError("page_changed", "Smart-ID: koda lapa bez pieprasījuma");
          }
          const res = await waitForSmartId(page, { snapshotFn: snapshot, onCode, codeAlreadySent: codeSent, timeoutMs: smartIdTimeoutMs });
          codeSent = codeSent || res.codeSent;
          log(`Smart-ID gaidīšana: ${res.status}`);
          if (res.status === "refused") throw new EcsddFlowError("smartid_refused");
          if (res.status === "timeout") {
            await saveDebug(`sso-timeout-${step}`, await snapshot(page).catch(() => snap));
            throw new EcsddFlowError("smartid_timeout");
          }
          continue;
        }

        if (kind === "sso_failed") {
          await saveDebug(`sso-failed-${step}`, snap);
          throw new EcsddFlowError(codeFilled ? "smartid_refused" : "page_changed", "Vienotā pieteikšanās atteica");
        }

        // Nezināma lapa. Pēc SSO e.csdd var atvērt profila lapu - pārbaudām sākumlapu.
        if (isEcsddHost(snap.host) && codeSent) {
          const st = await homeState(page);
          if (st === "ok") return;
          throw new EcsddFlowError("login_not_kept", "pēc Smart-ID e.csdd nav ielogots");
        }
        if (step > 4 && !isSsoHost(snap.host) && !isEcsddHost(snap.host)) throw new EcsddFlowError("page_changed", `nezināms hosts ${snap.host}`);
        await saveDebug(`login-unknown-${step}`, snap);
        await sleep(2500);
      }
      throw new EcsddFlowError("page_changed", "pieteikšanās: pārāk daudz soļu");
    });
  }

  async function ping() {
    return withPage((page) => homeState(page));
  }

  async function lookup(query) {
    return withPage(async (page) => {
      await page.goto(ECSDD_HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
      let home = await snapshot(page);
      let homeKind = classifySnapshot(home);
      if (homeKind === "ecsdd_account_choose") {
        await chooseAccount(page, home);
        home = await snapshot(page);
        homeKind = classifySnapshot(home);
      }
      if (homeKind === "ecsdd_logged_out") return { status: "logged_out" };
      if (homeKind === "captcha") throw new EcsddFlowError("captcha");
      await pause();
      // Tas pats pieprasījums, ko sūta e.csdd galvenes meklēšanas forma (#mobile-search: POST /tadati/ rn=...).
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined),
        page.evaluate(
          ({ action, rn }) => {
            const f = document.createElement("form");
            f.method = "post";
            f.action = action;
            const i = document.createElement("input");
            i.type = "hidden";
            i.name = "rn";
            i.value = rn;
            f.appendChild(i);
            document.body.appendChild(f);
            f.submit();
          },
          { action: ECSDD_TADATI_URL, rn: query },
        ),
      ]);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      const snap = await snapshot(page);
      const kind = classifySnapshot(snap, { submitted: true });
      log(`uzziņa: ${kind}`);
      if (kind === "captcha") throw new EcsddFlowError("captcha");
      if (kind === "ecsdd_logged_out") return { status: "logged_out" };
      if (kind === "tadati_not_found") {
        await saveDebug("tadati-not-found", snap);
        return { status: "not_found" };
      }
      if (kind === "tadati_result") {
        // Akordeona paneļi (Tehniskie dati, Detalizētais vērtējums, Nobraukuma vēsture LV ...) - arī aizvērtie.
        const { panels, footer } = await page.evaluate(collectTadatiPanels).catch(() => ({ panels: [], footer: "" }));
        let rawText = formatTadatiPanels(panels, footer, secrets);
        if (!rawText) {
          const full = await page.evaluate(() => document.body?.innerText || "");
          rawText = extractTadatiText(full, secrets);
        }
        if (!rawText) {
          await saveDebug("tadati-empty", snap);
          throw new EcsddFlowError("page_changed", "tadati: tukšs teksts");
        }
        return { status: "found", rawText };
      }
      if (snap.buttons.some((b) => b.visible !== false && isPayText(b.text))) throw new EcsddFlowError("paid");
      await saveDebug("tadati-unknown", snap);
      throw new EcsddFlowError("page_changed", "tadati: nezināma rezultātu lapa");
    });
  }

  async function logout() {
    const ctx = await getContext();
    const page = await ctx.newPage();
    try {
      await page.goto(ECSDD_HOME_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await clickByText(page, /\b(iziet|izrakst[iī]ties|beigt\s+darbu)\b/i).catch(() => false);
      await sleep(1500);
    } catch {
      /* iziešana nav obligāta - sīkdatnes tiek dzēstas jebkurā gadījumā */
    } finally {
      await page.close().catch(() => undefined);
      await ctx.clearCookies().catch(() => undefined);
    }
  }

  // ---- Maksas izziņa (1,50 € ar SMS). Relejs tikai lasa: nekad nesūta SMS, nemaksā, nespiež "Nosūtīt uz e-pastu". ----

  /**
   * Režīmi: "app" - CSDD Android lietotnes identitāte (UA ar `csdd_mob_app_android_v2`, `window.mobint`, 390 px);
   * "app_reg" - tas pats + lietotnes starta GET `?AppVers=..&AppOS=Android` šai sesijai; "desktop" - parasts web.
   * Web (dators un iPhone Safari) maksas sadaļas nerāda (23.11.2026), tāpēc vispirms lietotne.
   */
  const PAID_MODES = appRegister ? ["app", "app_reg", "desktop"] : ["app", "desktop"];
  /** Pēdējais režīms, kurā maksas izziņu sadaļas bija redzamas. */
  let paidMode = PAID_MODES[0];

  async function withModePage(mode, fn) {
    return withPage(async (page) => {
      if (mode === "app" || mode === "app_reg") {
        // Tikai šai cilnei (CDP override ir cilnes līmenī; pārējās releja cilnes paliek ar parasto UA).
        // Īstā Chrome versija (persistentam kontekstam browser() ir null -> no about:blank navigator.userAgent).
        const version =
          (await Promise.resolve(page.context().browser()?.version()).catch(() => "")) ||
          (await page.evaluate(() => navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? "").catch(() => ""));
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Network.setUserAgentOverride", appUserAgentOverride({ chromeVersion: version, ...(appUid ? { uid: appUid } : {}) }));
        await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }).catch(() => undefined);
        await page.addInitScript(MOBINT_STUB_SCRIPT);
        if (mode === "app_reg") {
          await page.goto(appRegisterUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
          await sleep(800);
        }
      }
      return fn(page);
    });
  }

  /** Visos režīmos pēc kārtas (vispirms tas, kas strādāja pēdējo reizi); `fn` atgriež {status:"no_button"}, ja sadaļas nav. */
  async function inModes(name, fn) {
    const order = [paidMode, ...PAID_MODES.filter((m) => m !== paidMode)];
    let last = null;
    for (const mode of order) {
      last = await withModePage(mode, (page) => fn(page, mode));
      if (last?.status !== "no_button") {
        if (last?.status !== "logged_out") paidMode = mode;
        return { ...last, mode };
      }
      log(`${name}: ${mode} režīmā sadaļa nav redzama`);
    }
    return { ...last, mode: order[order.length - 1] };
  }

  async function saveDebugPaid(name, page) {
    const snap = await snapshot(page).catch(() => null);
    if (!snap) return;
    await saveDebug(name, {
      ...snap,
      text: redactPaidText(snap.text),
      links: (snap.links ?? []).map((l) => ({ text: redactPaidText(l.text), href: redactPaidText(l.href) })),
      buttons: (snap.buttons ?? []).map((b) => ({ ...b, text: redactPaidText(b.text) })),
    });
  }

  /** Sākumlapa ielogotā kontā: "ok" | "logged_out". */
  async function openHome(page) {
    await page.goto(ECSDD_HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    let snap = await snapshot(page);
    let kind = classifySnapshot(snap);
    if (kind === "ecsdd_account_choose") {
      await chooseAccount(page, snap);
      snap = await snapshot(page);
      kind = classifySnapshot(snap);
    }
    if (kind === "captcha") throw new EcsddFlowError("captcha");
    if (kind === "ecsdd_logged_out") return "logged_out";
    return "ok";
  }

  /** Atver vadīklu: saite ar e.csdd href -> goto; citādi klikšķis. Nekad - aizliegtās pogas un sms:. */
  async function openControl(page, ctl) {
    if (PAID_FORBIDDEN_RE.test(ctl.text) || /^sms:/i.test(ctl.href)) throw new EcsddFlowError("page_changed", "aizliegta vadīkla");
    const href = ctl.href && !/^(javascript:|#|mailto:|tel:)/i.test(ctl.href) ? new URL(ctl.href, page.url()).toString() : "";
    if (href && isEcsddHost(new URL(href).hostname)) {
      await page.goto(href, { waitUntil: "domcontentloaded", timeout: 45_000 });
    } else {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined),
        page.locator(`[data-provin-ctl="${ctl.i}"]`).first().click({ force: true, timeout: 10_000 }),
      ]);
    }
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await sleep(800);
  }

  async function findControl(page, re) {
    const ctls = await page.evaluate(collectPaidControls);
    return ctls.filter((c) => re.test(c.text)).sort((a, b) => Number(b.visible) - Number(a.visible))[0] ?? null;
  }

  async function submitTadati(page, query) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined),
      page.evaluate(
        ({ action, rn }) => {
          const f = document.createElement("form");
          f.method = "post";
          f.action = action;
          const i = document.createElement("input");
          i.type = "hidden";
          i.name = "rn";
          i.value = rn;
          f.appendChild(i);
          document.body.appendChild(f);
          f.submit();
        },
        { action: ECSDD_TADATI_URL, rn: query },
      ),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  }

  /**
   * `tadati` -> "Pieprasīt maksas izziņu" -> NOLASA "Sagatavot īsziņu" saiti (nespiež).
   * -> { status: "ok", number, body, price, vehicle, plate } | logged_out | not_found | no_button
   */
  async function paidSmsLink(query) {
    return inModes("sms-link", async (page, mode) => {
      if ((await openHome(page)) === "logged_out") return { status: "logged_out" };
      await pause();
      await submitTadati(page, query);
      const snap = await snapshot(page);
      const kind = classifySnapshot(snap, { submitted: true });
      if (kind === "ecsdd_logged_out") return { status: "logged_out" };
      if (kind === "captcha") throw new EcsddFlowError("captcha");
      if (kind === "tadati_not_found") return { status: "not_found" };
      const req = await findControl(page, PAID_REQUEST_RE);
      if (!req) {
        await saveDebugPaid(`paid-no-request-${mode}`, page);
        return { status: "no_button" };
      }
      await openControl(page, req);
      const confirm = await snapshot(page);
      const ctls = await page.evaluate(collectPaidControls);
      const html = await page.content();
      const prep = ctls.find((c) => /sagatavot\s+[iī]szi[ņn]u/i.test(c.text));
      const mobintCalls = await page.evaluate(() => window.__provinMobintCalls ?? []).catch(() => []);
      const candidates = [
        prep?.href,
        prep?.onclick,
        prep?.data,
        ...ctls.filter((c) => /^sms:/i.test(c.href)).map((c) => c.href),
        ...findSmsHrefs(html),
        ...smsHrefsFromMobintCalls(mobintCalls),
      ]
        .flatMap((v) => (v ? findSmsHrefs(v).concat(/^sms:/i.test(v) ? [v] : []) : []))
        .filter(Boolean);
      const info = parsePaidConfirmText(confirm.text);
      for (const href of candidates) {
        const sms = parseSmsHref(href);
        if (!sms) continue;
        const plate = info.plate || (/^[A-Z0-9]{2,8}$/.test(query) && /[A-Z]/.test(query) ? query : "");
        if (plate && !smsBodyMatchesPlate(sms.body, plate)) {
          log("sms-link: SMS teksts neatbilst numuram");
          continue;
        }
        log(`sms-link: saite nolasīta (${mode})`);
        return { status: "ok", number: sms.number, body: sms.body, price: info.price, vehicle: info.vehicle, plate: plate || sms.body.split(/\s+/).pop() };
      }
      await saveDebugPaid(`paid-confirm-unknown-${mode}`, page);
      if (classifyPaidPage(confirm) !== "paid_confirm") return { status: "no_button" };
      throw new EcsddFlowError("page_changed", "maksas izziņa: nav sms saites");
    });
  }

  /** Izvēlne -> Maksas Izziņas -> Apmaksātās izziņas (+ "Atjaunot sarakstu"). Atgriež true, ja saraksta lapa atvērta. */
  async function openPaidList(page) {
    let ctl = await findControl(page, PAID_LIST_LINK_RE);
    if (!ctl) {
      const menu = await findControl(page, PAID_MENU_RE);
      if (menu) {
        await openControl(page, menu);
        ctl = await findControl(page, PAID_LIST_LINK_RE);
      }
    }
    if (!ctl) return false;
    await openControl(page, ctl);
    const refresh = await findControl(page, PAID_REFRESH_RE);
    if (refresh) await openControl(page, refresh);
    return classifyPaidPage(await snapshot(page)) === "paid_list";
  }

  async function readPaidList(page) {
    const rows = await page.evaluate(collectPaidTableRows);
    return { rows, list: parsePaidListRows(rows.map((r) => r.cells)) };
  }

  /** -> { status: "ok", items: [{plate, status, paidAt, dateText}] } | logged_out | no_button */
  async function paidList() {
    return inModes("paid-list", async (page, mode) => {
      if ((await openHome(page)) === "logged_out") return { status: "logged_out" };
      if (!(await openPaidList(page))) {
        await saveDebugPaid(`paid-list-missing-${mode}`, page);
        return { status: "no_button" };
      }
      const { list } = await readPaidList(page);
      return { status: "ok", items: list.map((r) => ({ plate: r.plate, status: r.status, paidAt: r.paidAt, dateText: r.dateText })) };
    });
  }

  /**
   * Jaunākā apmaksātā izziņa numuram `plate` (ne vecāka par `sinceIso`) -> pilns teksts CSDD blokam.
   * -> { status: "found", rawText, plate, paidAt } | pending | logged_out | no_button
   */
  async function paidReport(plate, sinceIso = "") {
    return inModes("paid-report", async (page, mode) => {
      if ((await openHome(page)) === "logged_out") return { status: "logged_out" };
      if (!(await openPaidList(page))) {
        await saveDebugPaid(`paid-list-missing-${mode}`, page);
        return { status: "no_button" };
      }
      const { rows, list } = await readPaidList(page);
      const hit = pickPaidReport(list, plate, sinceIso);
      if (!hit) return { status: "pending", listed: list.length };
      const row = rows[hit.index];
      if (row?.href && !/^(javascript:|#)/i.test(row.href)) {
        await page.goto(new URL(row.href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
      } else {
        const tr = page.locator(`[data-provin-row="${hit.index}"]`).first();
        const inner = tr.locator("a, button, [onclick]").first();
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined),
          ((await inner.count()) ? inner : tr.locator("td").first()).click({ force: true, timeout: 10_000 }),
        ]);
      }
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await sleep(800);
      const titles = PAID_REPORT_TITLES_FOLDED;
      let panels = await page.evaluate(collectPaidPanels, titles);
      let footer = findPreparedFooter(await page.evaluate(() => document.body?.textContent || ""));
      let rawText = formatPaidReportPanels(panels, footer, (t) => redact(t, secrets));
      if (!paidReportLooksComplete(rawText)) {
        // Akordeoni ielādē saturu tikai atverot: atveram katru virsrakstu vienreiz (nekad "Nosūtīt uz e-pastu").
        const heads = await page.evaluate((t) => {
          const fold = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim().replace(/:$/, "");
          const want = new Set(t);
          return [...document.querySelectorAll("label, summary, h2, h3, h4, [aria-expanded], .accordion-title, .uk-accordion-title")]
            .map((el, i) => {
              el.setAttribute("data-provin-head", String(i));
              return { i, ok: want.has(fold(el.textContent)) };
            })
            .filter((h) => h.ok)
            .map((h) => h.i);
        }, titles);
        for (const i of heads) {
          await page.locator(`[data-provin-head="${i}"]`).first().click({ timeout: 5000 }).catch(() => undefined);
          await sleep(400);
        }
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
        panels = await page.evaluate(collectPaidPanels, titles);
        footer = findPreparedFooter(await page.evaluate(() => document.body?.textContent || "")) || footer;
        rawText = formatPaidReportPanels(panels, footer, (t) => redact(t, secrets));
      }
      if (!paidReportLooksComplete(rawText)) {
        // Pēdējā iespēja: visa lapas teksta daļa starp pirmo virsrakstu un pogām.
        const body = await page.evaluate(() => document.body?.innerText || "");
        const start = body.search(/Aizliegumi|B[uū]tiski\s+boj[aā]jumi|Re[gģ]istr[aā]cijas\s+dati/i);
        const end = body.search(/Nos[uū]t[iī]t\s+uz\s+re[gģ]istr[eē]to|Atgriezties\s+uz\s+izzi/i);
        const slice = start >= 0 ? body.slice(start, end > start ? end : undefined) : "";
        const alt = formatPaidReportPanels([{ title: "", lines: slice.split("\n") }], footer, (t) => redact(t, secrets));
        if (paidReportLooksComplete(alt)) rawText = alt;
      }
      if (!paidReportLooksComplete(rawText)) {
        await saveDebugPaid(`paid-report-unknown-${mode}`, page);
        throw new EcsddFlowError("page_changed", "maksas izziņa: neatpazīts saturs");
      }
      log(`paid-report: izziņa nolasīta (${mode}, ${rawText.length} zīmes)`);
      return { status: "found", rawText, plate: hit.plate, paidAt: hit.paidAt };
    });
  }

  return { login, ping, lookup, logout, paidSmsLink, paidList, paidReport };
}
