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
  isEcsddHost,
  isPayText,
  isSsoHost,
  redact,
} from "./ecsdd-page.mjs";
import { chooseSmartId, collectSsoExtras, submitPersonalCode, waitForSmartId } from "./viss-sso.mjs";

export class EcsddFlowError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(2000 + Math.round(Math.random() * 3000));

async function snapshot(page) {
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
    return {
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

export function createEcsddBrowser({ getContext, personalCode, log = () => undefined, debugDir = "", smartIdTimeoutMs = 120_000 }) {
  const secrets = [personalCode];

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
          : { host: snap.host, path: snap.path, text: text.slice(0, 8000), buttons: snap.buttons, links: snap.links },
        null,
        1,
      );
      await fs.writeFile(path.join(debugDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${name}.json`), redact(body, secrets), { mode: 0o600 });
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
    const snap = await snapshot(page);
    const kind = classifySnapshot(snap);
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
        if (kind === "ecsdd_logged_in") return;

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
      const home = await snapshot(page);
      const homeKind = classifySnapshot(home);
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
        const full = await page.evaluate(() => document.body?.innerText || "");
        const rawText = extractTadatiText(full, secrets);
        if (!rawText) throw new EcsddFlowError("page_changed", "tadati: tukšs teksts");
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

  return { login, ping, lookup, logout };
}
