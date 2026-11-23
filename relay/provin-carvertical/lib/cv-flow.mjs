/**
 * CarVertical pārlūka soļi (Playwright, viens Chrome profils). Tīrā loģika: ./cv-page.mjs.
 *
 * Ko relejs dara:
 *   - pieteikšanās ar e-pastu + paroli (CarVertical tad nosūta 6 rakstzīmju kodu uz konta e-pastu; kodu ievada Nils adminā);
 *   - "Manas atskaites" (/lv/user/reports): kredītu atlikums un atskaišu saraksts no lapas pašas API atbildēm;
 *   - PDF lejupielāde jau nopirktai atskaitei;
 *   - pirkums ar KREDĪTU: precheck lapā saite "Izmantot atskaiti" (useOneReport), kas ved uz atskaites lapu.
 * Ko relejs NEKAD nedara: neiet uz checkout / pricing / billing (navigācija bloķēta), neievada karti, nerisina captcha,
 * nelieto Google / Apple pieteikšanos, nesūta e-pastus.
 */
import fs from "node:fs/promises";
import path from "node:path";

import {
  CV_API,
  CV_AUTH_URL,
  CV_ORIGIN,
  CV_REPORTS_URL,
  classifyAuthPage,
  isForbiddenPath,
  isPdfBase64,
  normalizeVin,
  parseCreditsFromText,
  parseQuotas,
  parseReportsList,
  pickCreditUseHref,
  redact,
} from "./cv-page.mjs";

const CODE_TTL_MS = 15 * 60_000;

export function createCarverticalBrowser({ getContext, email, password, log, debugDir, secrets = [], locale = "lv" }) {
  let page = null;
  /** Pēdējās lapas API atbildes (tikai atmiņā). */
  const seen = { productId: null, quotas: null, reports: null, reportsAt: 0, quotasAt: 0, createdReport: null };
  /** CarVertical sesijas Bearer (no lapas pašas pieprasījumiem). Nekad netiek logots vai saglabāts diskā. */
  let bearer = "";
  let codeRequestedAt = 0;
  let lastLoginAttempt = 0;
  const allSecrets = [email, password, ...secrets];
  const say = (m) => log(redact(m, allSecrets));

  function attach(p) {
    p.on("request", (req) => {
      try {
        const u = new URL(req.url());
        if (u.hostname !== new URL(CV_API).hostname) return;
        const auth = req.headers()["authorization"] ?? "";
        if (/^Bearer\s+\S{16,}/.test(auth)) bearer = auth;
        const pid = u.searchParams.get("productId");
        if (pid && /^\d{1,12}$/.test(pid)) seen.productId = pid;
      } catch {
        /* nederīgs URL */
      }
    });
    p.on("response", async (res) => {
      try {
        const u = new URL(res.url());
        if (u.hostname !== new URL(CV_API).hostname || !res.ok()) return;
        if (u.pathname === "/user/quotas") {
          seen.quotas = await res.json();
          seen.quotasAt = Date.now();
        } else if (u.pathname === "/reports" && res.request().method() === "GET") {
          seen.reports = await res.json();
          seen.reportsAt = Date.now();
        } else if (u.pathname === "/reports" && res.request().method() === "POST") {
          seen.createdReport = await res.json().catch(() => null);
        }
      } catch {
        /* ne JSON */
      }
    });
  }

  async function getPage() {
    const ctx = await getContext();
    if (page && !page.isClosed() && page.context() === ctx) return page;
    page = ctx.pages()[0] ?? (await ctx.newPage());
    attach(page);
    return page;
  }

  async function snapshot(p) {
    return p
      .evaluate(() => {
        const vis = (el) => {
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.opacity !== "0";
        };
        const challenge = [...document.querySelectorAll('iframe[src*="recaptcha/api2/bframe"]')].some((f) => {
          let el = f;
          for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
            const st = getComputedStyle(el);
            if (st.visibility === "hidden" || st.opacity === "0") return false;
          }
          return f.getBoundingClientRect().height > 200;
        });
        return {
          url: location.href,
          text: (document.body?.innerText ?? "").slice(0, 20_000),
          hasCodeInput: [...document.querySelectorAll('input[name="code"]')].some(vis),
          hasPasswordInput: [...document.querySelectorAll('input[name="password"]')].some(vis),
          captchaChallenge: challenge,
        };
      })
      .catch(() => ({ url: p.url(), text: "", hasCodeInput: false, hasPasswordInput: false, captchaChallenge: false }));
  }

  /** Neatpazīts solis: lapas etiķetes un teksts bez e-pastiem, cipari -> # (tikai servisa lietotājam). */
  async function debugDump(p, tag) {
    if (!debugDir) return;
    try {
      const s = await snapshot(p);
      const labels = await p
        .evaluate(() =>
          [...document.querySelectorAll("button,a,[role=button],input")]
            .map((el) => (el.innerText || el.getAttribute("aria-label") || el.getAttribute("name") || "").replace(/\s+/g, " ").trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 120),
        )
        .catch(() => []);
      await fs.mkdir(debugDir, { recursive: true, mode: 0o700 });
      const body = redact(JSON.stringify({ url: s.url, labels, text: s.text.slice(0, 6000) }, null, 1), allSecrets).replace(/\d/g, "#");
      await fs.writeFile(path.join(debugDir, `${tag}-${Date.now()}.json`), body, { mode: 0o600 });
    } catch {
      /* debug nav kritisks */
    }
  }

  async function stayInLatvia(p) {
    const stay = p.locator('[data-testid="stayInCurrentMarket"]');
    if (await stay.isVisible().catch(() => false)) {
      await stay.click().catch(() => undefined);
      await p.waitForTimeout(1200);
      say("tirgus: palikt Latvijā");
    }
  }

  async function classifyNow(p) {
    const s = await snapshot(p);
    return { kind: classifyAuthPage(s), snap: s };
  }

  /** Bez jaunas pieteikšanās: vai sesija aktīva (atver "Manas atskaites"). Koda gaidīšanas laikā lapu neaiztiek. */
  async function peekSession() {
    const p = await getPage();
    if (codeRequestedAt && Date.now() - codeRequestedAt < CODE_TTL_MS) {
      const { kind } = await classifyNow(p);
      if (kind === "code") return { state: "awaiting_code", codeRequestedAt: new Date(codeRequestedAt).toISOString() };
    }
    await p.goto(CV_REPORTS_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await p.waitForTimeout(3500);
    await stayInLatvia(p);
    const { kind } = await classifyNow(p);
    if (kind === "logged_in") {
      codeRequestedAt = 0;
      return { state: "active" };
    }
    return { state: "logged_out" };
  }

  async function login() {
    const p = await getPage();
    lastLoginAttempt = Date.now();
    await p.goto(CV_AUTH_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await p.waitForTimeout(3000);
    await stayInLatvia(p);
    let { kind } = await classifyNow(p);
    if (kind === "logged_in") return { state: "active" };
    if (kind !== "login_form") {
      await debugDump(p, "login-unknown");
      return { state: "needs_human", code: "login_page_changed" };
    }
    await p.locator('input[name="email"]').first().fill(email);
    await p.locator('input[name="password"]').first().fill(password);
    await p.waitForTimeout(600);
    // Formas poga (nevis "Turpināt ar Google/Apple").
    await p.locator('form button[type="submit"]').first().click();
    for (let i = 0; i < 20; i++) {
      await p.waitForTimeout(1000);
      ({ kind } = await classifyNow(p));
      if (kind === "code" || kind === "logged_in" || kind === "captcha" || kind === "bad_credentials") break;
    }
    say(`pieteikšanās: ${kind}`);
    if (kind === "code") {
      codeRequestedAt = Date.now();
      return { state: "awaiting_code", codeRequestedAt: new Date(codeRequestedAt).toISOString() };
    }
    if (kind === "logged_in") return { state: "active" };
    if (kind === "captcha") return { state: "needs_human", code: "captcha" };
    if (kind === "bad_credentials") return { state: "needs_human", code: "bad_credentials" };
    await debugDump(p, "login-after-submit");
    return { state: "needs_human", code: "login_unknown" };
  }

  async function ensureSession() {
    const s = await peekSession();
    if (s.state === "active" || s.state === "awaiting_code") return s;
    // Nesūtam jaunu kodu biežāk kā reizi 15 min (Nilam e-pastā nekrājas kodi).
    if (Date.now() - lastLoginAttempt < CODE_TTL_MS) return { state: "logged_out", code: "login_cooldown" };
    return login();
  }

  async function submitCode(code) {
    const p = await getPage();
    const { kind } = await classifyNow(p);
    if (kind !== "code") return { state: "logged_out", code: "no_code_page" };
    await p.locator('input[name="code"]').first().fill(code);
    await p.waitForTimeout(500);
    const btn = p.locator('form button[type="submit"]').first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
    else await p.keyboard.press("Enter");
    let k = "code";
    for (let i = 0; i < 20; i++) {
      await p.waitForTimeout(1000);
      ({ kind: k } = await classifyNow(p));
      if (k !== "code") break;
    }
    if (k === "code") {
      const s = await snapshot(p);
      if (/nepareiz|invalid|incorrect|beidzies|expired/i.test(s.text)) return { state: "awaiting_code", code: "wrong_code", codeRequestedAt: new Date(codeRequestedAt).toISOString() };
    }
    const s = await peekSession();
    say(`kods: ${s.state}`);
    return s.state === "active" ? s : { state: "logged_out", code: "code_not_accepted" };
  }

  /** "Manas atskaites": atlikums + saraksts no lapas API atbildēm (rezerve - lapas teksts atlikumam). */
  async function account() {
    const p = await getPage();
    const t0 = Date.now();
    await p.goto(CV_REPORTS_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await stayInLatvia(p);
    for (let i = 0; i < 20; i++) {
      await p.waitForTimeout(750);
      if (seen.quotasAt > t0 && seen.reportsAt > t0) break;
    }
    const { kind, snap } = await classifyNow(p);
    if (kind !== "logged_in") {
      const err = new Error("not_logged_in");
      err.code = "not_logged_in";
      throw err;
    }
    let credits = seen.quotasAt > t0 ? parseQuotas(seen.quotas, seen.productId) : null;
    if (credits == null) credits = parseCreditsFromText(snap.text);
    const reports = seen.reportsAt > t0 ? parseReportsList(seen.reports) : [];
    if (seen.reportsAt <= t0 || credits == null) await debugDump(p, "account-partial");
    say(`konts: kredīti ${credits ?? "?"}, atskaites ${reports.length}${seen.reportsAt > t0 ? "" : " (saraksts nav nolasīts)"}`);
    return { credits, reports, listRead: seen.reportsAt > t0 };
  }

  /**
   * Pirkums ar kredītu. Atgriež {ok, clicked, reportId?, code?}. `clicked` = vai tika nospiesta kredīta saite
   * (pēc tās VIN reģistrs paliek, lai otrreiz nepirktu).
   */
  async function purchase(vin) {
    const v = normalizeVin(vin);
    const p = await getPage();
    seen.createdReport = null;
    await p.goto(`${CV_ORIGIN}/lv/precheck/searching?identifier=${encodeURIComponent(v)}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await stayInLatvia(p);
    let href = "";
    for (let i = 0; i < 40 && !href; i++) {
      await p.waitForTimeout(1000);
      let pathname = "";
      try {
        pathname = new URL(p.url()).pathname;
      } catch {
        /* */
      }
      if (/\/precheck\/existing(\/|$)/.test(pathname)) return { ok: false, clicked: false, code: "existing_report", message: "CarVertical rāda, ka atskaite jau ir" };
      if (isForbiddenPath(pathname)) return { ok: false, clicked: false, code: "no_credit_path", message: "CarVertical piedāvā tikai apmaksu - nepērku" };
      const links = await p
        .evaluate(() =>
          [...document.querySelectorAll("a[href]")].map((a) => ({
            href: a.getAttribute("href") || "",
            analytics: a.getAttribute("data-analytics-name") || a.getAttribute("data-ph-capture-attribute-name") || "",
            text: (a.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
          })),
        )
        .catch(() => []);
      href = pickCreditUseHref(links, v);
      // Precheck atrada vairākus auto / prasa VIN apstiprinājumu: to nespiežam - cilvēkam.
      const txt = (await snapshot(p)).text;
      if (!href && /vai šis vin izskatās pareizs|does this vin look right/i.test(txt)) {
        await debugDump(p, "precheck-vin-confirm");
        return { ok: false, clicked: false, code: "vin_confirm_needed", message: "CarVertical prasa apstiprināt VIN - pērc ar roku" };
      }
    }
    if (!href) {
      await debugDump(p, "precheck-no-credit-link");
      return { ok: false, clicked: false, code: "no_credit_link", message: "Precheck lapā nav kredīta saites" };
    }
    say(`pirkums ar kredītu: ${v}`);
    await p.goto(href, { waitUntil: "domcontentloaded", timeout: 60_000 });
    for (let i = 0; i < 30 && !seen.createdReport; i++) await p.waitForTimeout(1000);
    const created = seen.createdReport;
    const reportId = created && (typeof created.id === "string" || typeof created.id === "number") ? String(created.id) : "";
    return { ok: true, clicked: true, reportId };
  }

  /** PDF tai pašai sesijai lapas kontekstā (tieši tā, kā to dara CarVertical "Lejupielādēt PDF"). */
  async function downloadPdf(reportId) {
    const p = await getPage();
    if (!bearer || !p.url().startsWith(CV_ORIGIN)) await account().catch(() => undefined);
    if (!bearer) return { ok: false, code: "no_session_token" };
    const out = await p
      .evaluate(
        async ({ api, id, auth, loc }) => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          for (let i = 0; i < 90; i++) {
            const r = await fetch(`${api}/reports/${encodeURIComponent(id)}/pdf/full?locale=${loc}`, { headers: { Authorization: auth } });
            if (r.status === 404) {
              await sleep(2000);
              continue;
            }
            if (!r.ok) return { ok: false, code: `pdf_url_${r.status}` };
            const j = await r.json().catch(() => ({}));
            if (!j.pdfUrl) {
              await sleep(2000);
              continue;
            }
            const u = new URL(j.pdfUrl);
            const f = await fetch(`/pdf${u.pathname}`);
            if (!f.ok) return { ok: false, code: `pdf_get_${f.status}` };
            const bytes = new Uint8Array(await f.arrayBuffer());
            let bin = "";
            for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
            return { ok: true, base64: btoa(bin), size: bytes.length };
          }
          return { ok: false, code: "pdf_timeout" };
        },
        { api: CV_API, id: reportId, auth: bearer, loc: locale },
      )
      .catch((e) => ({ ok: false, code: "pdf_eval", message: String(e?.message ?? "").slice(0, 120) }));
    if (out.ok && !isPdfBase64(out.base64)) return { ok: false, code: "not_pdf" };
    if (out.ok) say(`PDF ${reportId.slice(0, 8)}: ${out.size} B`);
    return out;
  }

  return { peekSession, ensureSession, login, submitCode, account, purchase, downloadPdf };
}
