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
  extractVerificationCode,
  isEcsddHost,
  isPayText,
  isSsoHost,
  looksLikeSsoFailure,
  redact,
} from "./ecsdd-page.mjs";

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
    const codeCandidates = [...document.querySelectorAll('[id*="code" i], [class*="code" i], [id*="verif" i], [class*="verif" i], [class*="kods" i]')]
      .filter(vis)
      .map((el) => (el.textContent || "").replace(/\s+/g, "").slice(0, 12));
    return {
      path: location.pathname,
      text: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 20000),
      inputs,
      buttons,
      links,
      codeCandidates,
      hasAgree: Boolean(document.querySelector('input[type="checkbox"][name="agree"]')),
      hasCaptchaFrame: Boolean(document.querySelector('iframe[src*="captcha" i], .g-recaptcha, .h-captcha')),
    };
  });
  return { host, ...data };
}

export function createEcsddBrowser({ getContext, personalCode, log = () => undefined, debugDir = "", smartIdTimeoutMs = 120_000 }) {
  const secrets = [personalCode];

  async function saveDebug(name, snap) {
    // Tikai e.csdd lapas (nekad SSO / Smart-ID lapas).
    if (!debugDir || !isEcsddHost(snap.host)) return;
    try {
      await fs.mkdir(debugDir, { recursive: true, mode: 0o700 });
      const body = JSON.stringify({ host: snap.host, path: snap.path, text: redact(snap.text, secrets).slice(0, 8000), buttons: snap.buttons, links: snap.links }, null, 1);
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
        const snap = await snapshot(page);
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
          const agree = page.locator('input[type="checkbox"][name="agree"]').first();
          if ((await agree.count()) && !(await agree.isChecked().catch(() => true))) {
            await agree.check({ force: true }).catch(async () => {
              const id = await agree.getAttribute("id");
              if (id) await page.locator(`label[for="${id}"]`).click();
            });
          }
          await sleep(800);
          const smartId = page.locator('.js--vpm-auth-button[data-url*="scheme=smartid" i]').first();
          if (await smartId.count()) await smartId.click();
          else if (!(await clickByText(page, /smart[\s-]?id/i))) throw new EcsddFlowError("page_changed", "Vienotā pieteikšanās: nav Smart-ID izvēles");
          await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
          await sleep(1500);
          continue;
        }

        if (kind === "sso_code_input") {
          if (codeFilled) throw new EcsddFlowError("page_changed", "Smart-ID: personas koda forma atkārtojas");
          let input = page.locator("#identity-number");
          if (!(await input.count())) input = page.locator('input[type="text"], input[type="tel"], input:not([type])').first();
          if (!(await input.isVisible().catch(() => false))) throw new EcsddFlowError("page_changed", "Smart-ID: nav personas koda lauka");
          await input.fill(personalCode);
          codeFilled = true;
          const ok = page.locator("#ok");
          if (await ok.count()) await ok.click();
          else if (!(await clickByText(page, /autentific|turpin[aā]t|pieteikties|t[aā]l[aā]k|apstiprin/i))) await page.keyboard.press("Enter");
          await sleep(2500);
          continue;
        }

        if (kind === "sso_wait") {
          const code = extractVerificationCode(snap.text, snap.codeCandidates);
          if (!code) throw new EcsddFlowError("code_not_read");
          if (!codeSent) {
            codeSent = true;
            await onCode(code);
          }
          const deadline = Date.now() + smartIdTimeoutMs;
          while (Date.now() < deadline) {
            await sleep(2000);
            if (!isSsoHost(new URL(page.url()).hostname)) break;
            const t = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
            if (looksLikeSsoFailure(t)) throw new EcsddFlowError("smartid_refused");
          }
          if (isSsoHost(new URL(page.url()).hostname)) {
            // Pēc apstiprinājuma SSO var prasīt vēl vienu "Turpināt".
            const after = await snapshot(page);
            if (!extractVerificationCode(after.text, after.codeCandidates) && (await clickByText(page, /turpin[aā]t|piekr[iī]tu|apstiprin/i))) continue;
            throw new EcsddFlowError("smartid_timeout");
          }
          continue;
        }

        if (kind === "sso_failed") throw new EcsddFlowError(codeSent ? "smartid_refused" : "page_changed", "Vienotā pieteikšanās atteica");

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
