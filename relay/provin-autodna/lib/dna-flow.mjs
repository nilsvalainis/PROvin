/**
 * AutoDNA pārlūka soļi (Playwright, viens Chrome profils). Tīrā loģika: ./dna-page.mjs.
 *
 * Ko relejs dara:
 *   - pieteikšanās ar e-pastu + paroli (sākumlapas forma #form-login; Google / Facebook pogas NElieto);
 *   - konts: kredītu atlikums (/ajax/get_client_credits) un "vai šim VIN jau nopirkts" (/ajax/client_is_login) -
 *     tie paši pieprasījumi, ko sūta AutoDNA lapa pati;
 *   - "Manas atskaites" (/profile/history, meklēšana ?search=VIN) un nopirktās atskaites PDF (atskaites lapa ->
 *     "Lejupielādēt" -> "Atskaite PDF", tieši kā Nils to dara ar roku);
 *   - priekšpārbaude /vin/<VIN> lapā (Nila likums 25.11): pērk TIKAI, ja «Auto arhīva fotogrāfijas» vai
 *     «Transportlīdzekļa vēsture» rāda >0 ierakstu (./dna-precheck.mjs); pārbauda arī tieši pirms klikšķa;
 *   - pirkums ar KREDĪTU /vin/<VIN> lapā: tikai, ja redzama "maksāt ar kredītiem" izvēle, kopsumma 0 € un viena skaidra
 *     apmaksas poga. Kamēr AUTODNA_PURCHASE_LIVE nav "1", pirkuma solis ir sauss (viss pārbaudīts, poga netiek spiesta).
 * Ko relejs NEKAD nedara: neiet uz pakām / biznesa pakām / bankas vārtejām (navigācija bloķēta), neievada karti,
 * nerisina Turnstile / captcha (-> needs_human), nesūta e-pastus, nelieto partnera API.
 */
import fs from "node:fs/promises";
import path from "node:path";

import {
  DNA_HOME_URL,
  DNA_ORIGIN,
  analyzePurchasePage,
  classifyLoginForm,
  classifyLoginResponse,
  dnaHistoryUrl,
  dnaVinUrl,
  isReportPdfUrl,
  isPdfBase64,
  normalizeVin,
  parseClientCredits,
  parseCreditsFromText,
  parseHistoryItems,
  parseIsLogin,
  pickReportPageHref,
  redact,
  totalLooksLikeCredit,
} from "./dna-page.mjs";
import { DNA_PRECHECK_MESSAGE_LV, decidePrecheck, parsePrecheckHtml } from "./dna-precheck.mjs";
import { collectDomPhotoEntries, downloadArchivePhotos } from "./archive-photos.mjs";

/** Pēc nepareizas paroles nemēģina atkal 6 h (konta bloķēšanas risks); citādi ne biežāk kā reizi 10 min. */
const BAD_CREDENTIALS_COOLDOWN_MS = 6 * 3600_000;
const LOGIN_COOLDOWN_MS = 10 * 60_000;
const PDF_MAX_BYTES = 15 * 1024 * 1024;
/** Sīkdatņu logs dzīvi parādās ~5 s pēc ielādes (24.11.2026). */
const CONSENT_WAIT_MS = 9_000;
const LOGIN_FORM_WAIT_MS = 10_000;

export function createAutodnaBrowser({ getContext, email, password, log, debugDir, secrets = [], purchaseLive = false }) {
  let page = null;
  let lastLoginAttempt = 0;
  let badCredentialsAt = 0;
  /** Apmaksas ceļš (/payment/*) atļauts tikai šajā logā - pēc kredītu apmaksas izvēles un pārbaudes. */
  let paymentArmed = false;
  const allSecrets = [email, password, ...secrets];
  const say = (m) => log(redact(m, allSecrets));

  async function getPage() {
    const ctx = await getContext();
    if (page && !page.isClosed() && page.context() === ctx) return page;
    page = ctx.pages()[0] ?? (await ctx.newPage());
    return page;
  }

  /** Vai profilā jau ir sīkdatņu izvēle (consentmanager `__cmpconsentx*`, derīga ~14 dienas). */
  async function hasConsentCookie(p) {
    const cookies = await p
      .context()
      .cookies(DNA_ORIGIN)
      .catch(() => []);
    const nowSec = Date.now() / 1000;
    return cookies.some((c) => c.name.startsWith("__cmpconsentx") && (c.expires <= 0 || c.expires > nowSec + 60));
  }

  /**
   * Sīkdatņu logs -> "Noraidīt visu". Logs parādās ~5 s PĒC lapas ielādes un pārklāj galveni (24.11 dzīvi), tāpēc,
   * ja profilā nav derīgas izvēles, gaida to līdz CONSENT_WAIT_MS. Atgriež true, ja logs tika aizvērts.
   */
  async function dismissConsent(p, { wait = true } = {}) {
    const no = p.locator("a.cmpboxbtnno").first();
    let visible = await no.isVisible().catch(() => false);
    if (!visible && wait && !(await hasConsentCookie(p))) {
      visible = await no
        .waitFor({ state: "visible", timeout: CONSENT_WAIT_MS })
        .then(() => true)
        .catch(() => false);
    }
    if (!visible) return false;
    await no.click({ timeout: 5_000 }).catch(() => undefined);
    await no.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
    await p.waitForTimeout(400);
    return true;
  }

  /** Cloudflare Turnstile / captcha lapā (NEKAD neapiet -> needs_human). */
  async function captchaVisible(p) {
    return p
      .evaluate(() => {
        const vis = (el) => !!el && el.getClientRects().length > 0;
        const frames = [...document.querySelectorAll("iframe")].filter((f) => /challenges\.cloudflare\.com|turnstile|captcha/i.test(f.src || ""));
        if (frames.some(vis)) return true;
        if ([...document.querySelectorAll(".cf-turnstile, .g-recaptcha, .h-captcha, #challenge-form")].some(vis)) return true;
        return /just a moment|verify you are human|verificējiet, ka esat cilvēks/i.test(`${document.title} ${(document.body?.innerText ?? "").slice(0, 3000)}`);
      })
      .catch(() => false);
  }

  async function onSite(p) {
    if (!p.url().startsWith(DNA_ORIGIN)) {
      await p.goto(DNA_HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await p.waitForTimeout(1500);
      await dismissConsent(p);
    }
  }

  /** Tie paši /ajax pieprasījumi, ko sūta AutoDNA lapa (sīkdatnes no profila). */
  async function ajax(p, pathname, { method = "GET", form = null } = {}) {
    return p
      .evaluate(
        async ({ pathname: u, method: m, form: f }) => {
          const headers = { "X-Requested-With": "XMLHttpRequest" };
          let body;
          if (f) {
            headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
            body = Object.entries(f)
              .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ""))}`)
              .join("&");
          }
          const r = await fetch(u, { method: m, headers, body, credentials: "same-origin" });
          if (!r.ok) return { __status: r.status };
          return r.json().catch(() => ({ __status: -1 }));
        },
        { pathname, method, form },
      )
      .catch(() => null);
  }

  async function isLogin(p, vin = "") {
    const json = await ajax(p, "/ajax/client_is_login", { method: "POST", form: { vin, registration_number: "", registration_number_country_code: "" } });
    return parseIsLogin(json);
  }

  /** Neatpazīts solis: lapas etiķetes un teksts bez e-pastiem, cipari -> # (tikai servisa lietotājam). */
  async function debugDump(p, tag, extra = {}) {
    if (!debugDir) return;
    try {
      const s = await p
        .evaluate(() => ({
          url: location.href,
          text: (document.body?.innerText ?? "").slice(0, 6000),
          labels: [...document.querySelectorAll("button,a,[role=button],input,label")]
            .filter((el) => el.getClientRects().length > 0)
            .map((el) => `${el.tagName.toLowerCase()}#${el.id || ""}.${String(el.className || "").slice(0, 40)} ${(el.innerText || el.value || el.getAttribute("aria-label") || el.getAttribute("name") || "").replace(/\s+/g, " ").trim().slice(0, 80)}`)
            .slice(0, 160),
        }))
        .catch(() => ({ url: p.url(), text: "", labels: [] }));
      await fs.mkdir(debugDir, { recursive: true, mode: 0o700 });
      const body = redact(JSON.stringify({ ...s, extra }, null, 1), allSecrets).replace(/\d/g, "#");
      await fs.writeFile(path.join(debugDir, `${tag}-${Date.now()}.json`), body, { mode: 0o600 });
    } catch {
      /* debug nav kritisks */
    }
  }

  /** Bez jaunas pieteikšanās: vai sesija aktīva. */
  async function peekSession() {
    const p = await getPage();
    await onSite(p);
    const st = await isLogin(p);
    if (!st.known) return { state: "logged_out", code: "is_login_unknown" };
    return st.loggedIn ? { state: "active" } : { state: "logged_out" };
  }

  async function login() {
    const p = await getPage();
    lastLoginAttempt = Date.now();
    await p.goto(DNA_HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await p.waitForTimeout(1500);
    // Sīkdatņu logs nāk ar ~5 s aizturi un pārklāj galveni - vispirms to sagaida un aizver, tikai tad "Login".
    await dismissConsent(p);
    if (await captchaVisible(p)) {
      await debugDump(p, "login-captcha");
      return { state: "needs_human", code: "captcha" };
    }
    const opener = p.locator("button.header-login").first();
    const emailEl = p.locator("#form-login-email");
    const passEl = p.locator("#form-login-pass");
    const buttonFound = await opener.isVisible().catch(() => false);
    let formVisible = false;
    const tries = [];
    if (buttonFound) {
      // 1) parasts klikšķis; 2) vēlreiz pēc sīkdatņu loga (ja tas parādījās vēlāk); 3) DOM klikšķis uz tās pašas pogas.
      for (const how of ["click", "click", "dom"]) {
        if (await passEl.isVisible().catch(() => false)) {
          formVisible = true;
          break;
        }
        await dismissConsent(p, { wait: false });
        let err = "";
        if (how === "dom") {
          await p
            .evaluate(() => document.querySelector("button.header-login")?.click())
            .catch((e) => {
              err = String(e?.message ?? e).split("\n")[0].slice(0, 120);
            });
        } else {
          await opener.click({ timeout: 5_000 }).catch((e) => {
            err = String(e?.message ?? e).split("\n")[0].slice(0, 120);
          });
        }
        formVisible = await passEl
          .waitFor({ state: "visible", timeout: tries.length ? 5_000 : LOGIN_FORM_WAIT_MS })
          .then(() => true)
          .catch(() => false);
        tries.push(`${how}${err ? `: ${err}` : ""}`);
        if (formVisible) break;
        if (await captchaVisible(p)) break;
      }
    }
    const formState = classifyLoginForm({
      captcha: await captchaVisible(p),
      buttonFound,
      formInDom: (await passEl.count().catch(() => 0)) > 0 && (await emailEl.count().catch(() => 0)) > 0,
      formVisible,
    });
    if (formState !== "open") {
      await debugDump(p, `login-${formState.replaceAll("_", "-")}`, { tries });
      say(`pieteikšanās forma: ${formState} (${tries.join(" | ") || "poga nav redzama"})`);
      if (formState === "captcha") return { state: "needs_human", code: "captcha" };
      return { state: "needs_human", code: formState === "page_changed" ? "login_page_changed" : "login_form_not_opened" };
    }
    if (tries.length > 1) say(`pieteikšanās forma atvērta ${tries.length}. mēģinājumā`);
    await emailEl.fill(email);
    await passEl.fill(password);
    if (!(await p.locator("#sidebar-login-checkbox").isChecked().catch(() => false))) {
      await p.locator("label.terms-login-widget-text .terms-checkbox-checkmark").first().click({ timeout: 5_000 }).catch(() => undefined);
    }
    await p.waitForTimeout(400);
    const respP = p.waitForResponse((r) => r.url().includes("/ajax/client_login"), { timeout: 30_000 }).catch(() => null);
    await p.locator("#form-login-submit").click({ force: true }).catch(() => undefined);
    const resp = await respP;
    const json = resp ? await resp.json().catch(() => null) : null;
    const kind = classifyLoginResponse(json);
    say(`pieteikšanās: ${kind}`);
    if (kind === "bad_credentials") {
      badCredentialsAt = Date.now();
      return { state: "needs_human", code: "bad_credentials" };
    }
    if (kind === "captcha") return { state: "needs_human", code: "captcha" };
    if (kind === "code") {
      await debugDump(p, "login-code");
      return { state: "needs_human", code: "login_code" };
    }
    await p.waitForTimeout(2500);
    const st = await isLogin(p);
    if (st.loggedIn) return { state: "active" };
    if (await captchaVisible(p)) {
      await debugDump(p, "login-captcha-after-submit", { kind });
      return { state: "needs_human", code: "captcha" };
    }
    await debugDump(p, "login-after-submit", { kind });
    return { state: "needs_human", code: "login_unknown" };
  }

  async function ensureSession() {
    const s = await peekSession();
    if (s.state === "active") return s;
    if (badCredentialsAt && Date.now() - badCredentialsAt < BAD_CREDENTIALS_COOLDOWN_MS) return { state: "needs_human", code: "bad_credentials" };
    if (Date.now() - lastLoginAttempt < LOGIN_COOLDOWN_MS) return { state: "logged_out", code: "login_cooldown" };
    return login();
  }

  /** Konts: kredītu atlikums + vai šim VIN atskaite jau nopirkta. */
  async function account(vin = "") {
    const p = await getPage();
    await onSite(p);
    const st = await isLogin(p, vin ? normalizeVin(vin) : "");
    if (!st.loggedIn) {
      const err = new Error("not_logged_in");
      err.code = "not_logged_in";
      throw err;
    }
    let credits = parseClientCredits(await ajax(p, "/ajax/get_client_credits"));
    if (credits == null) {
      const text = await p.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      credits = parseCreditsFromText(text);
      if (credits == null) await debugDump(p, "credits-unknown");
    }
    say(`konts: kredīti ${credits ?? "?"}${vin ? `, VIN nopirkts: ${st.reportBought ? "jā" : "nē"}` : ""}`);
    return { credits, bought: st.reportBought, reportDate: st.reportDate ?? "", reportReady: st.isReport || !st.isTimeout };
  }

  /** Konta vēsture (5 jaunākās vai meklēšana pēc VIN): rindas ar saiti uz atskaites lapu. */
  async function historyItems(p, vin = "") {
    await p.goto(dnaHistoryUrl(vin), { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
    await p.waitForTimeout(2500);
    await dismissConsent(p);
    if (!p.url().includes("/profile")) return [];
    return p
      .evaluate(() =>
        [...document.querySelectorAll("a[href*='autodna_vhr']")].slice(0, 100).map((a) => {
          const item = a.closest(".report-item") ?? a.parentElement;
          return { href: a.href, text: (item?.innerText || "").replace(/\s+/g, " ").slice(0, 400) };
        }),
      )
      .catch(() => []);
  }

  /** "Manas atskaites" (tikai lasīšana): VIN + pirkuma datums + derīguma termiņš. */
  async function listReports() {
    const p = await getPage();
    const rows = parseHistoryItems(await historyItems(p));
    if (!rows.length) await debugDump(p, "history-empty");
    return rows;
  }

  /**
   * Nopirktās atskaites PDF: vēsture ?search=VIN -> atskaites lapa -> "Lejupielādēt" -> #report-link -> lejupielāde
   * (/rcontent/...pdf). Tikai lasīšana, kredīti netiek tērēti.
   */
  async function downloadPdf(vin) {
    const v = normalizeVin(vin);
    const p = await getPage();
    const href = pickReportPageHref(await historyItems(p, v), v);
    if (!href) {
      await debugDump(p, "pdf-not-in-history");
      return { ok: false, code: "not_in_history" };
    }
    await p.goto(href, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await p.waitForTimeout(3500);
    await dismissConsent(p);
    const menu = p.locator("button.dropdown-btn").filter({ hasText: /Lejupiel/i }).first();
    const link = p.locator("#report-link").first();
    if (!(await menu.isVisible().catch(() => false))) {
      await debugDump(p, "pdf-no-menu");
      return { ok: false, code: "pdf_link_missing" };
    }
    await menu.click().catch(() => undefined);
    await p.waitForTimeout(700);
    const dlP = p.waitForEvent("download", { timeout: 90_000 }).catch(() => null);
    await link.click({ timeout: 10_000 }).catch(() => undefined);
    const dl = await dlP;
    if (!dl) {
      await debugDump(p, "pdf-no-download");
      return { ok: false, code: "pdf_no_download" };
    }
    try {
      if (!isReportPdfUrl(dl.url())) return { ok: false, code: "pdf_foreign_url" };
      const file = await dl.path();
      const buf = file ? await fs.readFile(file) : null;
      if (!buf) return { ok: false, code: "pdf_read_failed" };
      if (buf.length > PDF_MAX_BYTES) return { ok: false, code: "pdf_too_large" };
      const base64 = buf.toString("base64");
      if (!isPdfBase64(base64)) return { ok: false, code: "not_pdf" };
      say(`PDF ${v}: ${buf.length} B`);
      return { ok: true, base64, size: buf.length };
    } finally {
      await dl.delete().catch(() => undefined);
    }
  }

  /** /vin/<VIN> lapas kopsavilkums pirkuma lēmumam (bez klikšķiem). */
  async function purchaseSnapshot(p, vin) {
    return p
      .evaluate((v) => {
        const vis = (el) => Boolean(el) && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
        const text = document.body?.innerText ?? "";
        const pending = /Meklē pieejamo informāciju/i.test(text) || vis(document.querySelector("#precheck_loading"));
        const captcha = [...document.querySelectorAll(".captcha[data-type], .cf-turnstile, iframe[src*='challenges.cloudflare.com']")].some(vis);
        const credit = document.getElementById("payment-select-credit");
        const creditInput = credit ? (credit.matches("input") ? credit : credit.querySelector("input")) : null;
        const scope = credit?.closest("form") ?? credit?.closest("[class*=payment], [class*=cart], [class*=summary]")?.parentElement ?? null;
        const payButtons = scope
          ? [...scope.querySelectorAll("button, input[type=submit], a.btn, [role=button]")].filter(vis).map((b) => (b.innerText || b.value || "").replace(/\s+/g, " ").trim())
          : [];
        const totalEl = scope?.querySelector("[class*=total], [class*=summary-price], [class*=price-sum]");
        return {
          pending,
          turnstile: pending && captcha,
          invalidVin: /nepareizs vin|invalid vin|vin nav derīgs/i.test(text) && !text.includes(v),
          vinOnPage: text.toUpperCase().includes(v) ? v : "",
          creditOption: { present: vis(credit), checked: Boolean(creditInput?.checked), disabled: Boolean(creditInput?.disabled) },
          payButtons,
          totalText: (totalEl?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
        };
      }, normalizeVin(vin))
      .catch(() => ({ pending: false, turnstile: false, creditOption: { present: false }, payButtons: [] }));
  }

  /** Atver /vin/<VIN> un gaida priekšpārbaudi (Turnstile netiek risināts). */
  async function openVinPage(vin) {
    const p = await getPage();
    await p.goto(dnaVinUrl(vin), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await p.waitForTimeout(2500);
    await dismissConsent(p);
    let snap = await purchaseSnapshot(p, vin);
    for (let i = 0; i < 12 && snap.pending; i++) {
      await p.waitForTimeout(2500);
      snap = await purchaseSnapshot(p, vin);
    }
    return { p, snap };
  }

  /** Priekšpārbaude no jau atvērtās /vin/<VIN> lapas HTML (tā pati parsēšana kā PROVIN VIN SCAN). */
  async function readPrecheck(p) {
    const html = await p.content().catch(() => "");
    const page = parsePrecheckHtml(html);
    return { ...decidePrecheck(page), pageState: page.state };
  }

  /** Tikai lasīšana: AutoDNA bezmaksas priekšpārbaude šim VIN (arhīva foto / vēstures ierakstu skaits). */
  async function precheck(vin) {
    const v = normalizeVin(vin);
    const { p, snap } = await openVinPage(v);
    const out = await readPrecheck(p);
    say(`priekšpārbaude ${v}: ${out.allowed ? "drīkst" : out.code} (lapa ${out.pageState}, foto ${out.photos ?? "?"}, vēsture ${out.history ?? "?"})`);
    if (out.pageState !== "ready") await debugDump(p, `precheck-${out.pageState}`, { out, pending: snap.pending, turnstile: snap.turnstile });
    return { ...out, turnstile: Boolean(snap.turnstile) };
  }

  /** Tikai lasīšana: ko pirkuma lapa rāda šim VIN (galvenajam pirms AUTODNA_PURCHASE_LIVE=1). */
  async function probe(vin) {
    const { p, snap } = await openVinPage(vin);
    const decision = analyzePurchasePage(snap, vin);
    await debugDump(p, "probe", { decision, snap });
    return { decision, creditOption: snap.creditOption, payButtons: snap.payButtons.slice(0, 10), totalText: snap.totalText };
  }

  /**
   * Pirkums ar kredītu. Atgriež {ok, clicked, code?}. `clicked` = vai apmaksas poga tika nospiesta
   * (pēc tās VIN reģistrs paliek, lai otrreiz nepirktu).
   */
  async function purchase(vin, { creditsBefore = null } = {}) {
    const v = normalizeVin(vin);
    const { p, snap } = await openVinPage(v);
    // Otrā priekšpārbaude tajā pašā lapā tieši pirms pirkuma soļa (ja AutoDNA lapa starp soļiem mainījusies).
    const pre = await readPrecheck(p);
    if (!pre.allowed) {
      await debugDump(p, `purchase-${pre.code}`, { pre });
      return { ok: false, clicked: false, code: pre.code, message: DNA_PRECHECK_MESSAGE_LV[pre.code], photos: pre.photos, history: pre.history };
    }
    const first = analyzePurchasePage(snap, v);
    if (first.step !== "ready") {
      await debugDump(p, `purchase-${first.step}`, { first, snap });
      const msg = {
        turnstile: "AutoDNA prasa apstiprināt, ka esi cilvēks (Turnstile) - atver saiti savā pārlūkā, tad spied vēlreiz",
        pending: "AutoDNA priekšpārbaude vēl nav gatava - mēģini pēc brīža",
        no_credit_option: "AutoDNA nepiedāvā apmaksu ar kredītiem - pērc ar roku",
        credit_disabled: "AutoDNA kredītu apmaksa nav pieejama šim produktam - pērc ar roku",
        pay_button_unclear: "AutoDNA pirkuma lapa izskatās citādi - pērc ar roku",
        vin_mismatch: "AutoDNA lapā cits VIN - nepērku",
        invalid_vin: "AutoDNA neatzīst šo VIN",
      }[first.step];
      return { ok: false, clicked: false, code: first.step, message: msg ?? "AutoDNA pirkuma lapa nav atpazīta" };
    }
    // Apmaksa ar kredītiem: izvēle + pārbaude, ka kopsumma nav nauda.
    if (!snap.creditOption.checked) {
      await p.locator("#payment-select-credit").first().click().catch(() => undefined);
      await p.waitForTimeout(1200);
    }
    const armedSnap = await purchaseSnapshot(p, v);
    if (!armedSnap.creditOption.checked || !totalLooksLikeCredit(armedSnap.totalText)) {
      await debugDump(p, "purchase-credit-not-selected", { armedSnap });
      return { ok: false, clicked: false, code: "credit_not_selected", message: "Neizdevās izvēlēties apmaksu ar kredītiem - nepērku" };
    }
    // Noteikumu / atteikuma tiesību ķekši pirkuma formā (nekad jaunumu / mārketinga).
    const boxes = await p
      .evaluate(() => {
        const credit = document.getElementById("payment-select-credit");
        const scope = credit?.closest("form") ?? document;
        let n = 0;
        for (const box of scope.querySelectorAll("input[type=checkbox]")) {
          const label = (box.closest("label")?.innerText || box.parentElement?.innerText || "").toLowerCase();
          if (box.checked || box.disabled) continue;
          if (/jaunum|newsletter|mārketing|marketing|reklām/.test(label)) continue;
          if (!/noteikum|terms|piekrīt|piekrit|atkāp|withdraw|regulamin/.test(label)) continue;
          (box.closest("label") ?? box).click();
          n++;
        }
        return n;
      })
      .catch(() => 0);
    if (boxes) await p.waitForTimeout(600);
    if (!purchaseLive) {
      await debugDump(p, "purchase-dry-run", { payLabel: first.payLabel, boxes, armedSnap });
      say(`pirkums ${v}: sausais režīms (AUTODNA_PURCHASE_LIVE nav 1) - poga "${first.payLabel}" netika spiesta`);
      return { ok: false, clicked: false, code: "dry_run", message: "Pirkuma solis pārbaudīts, bet tiešais pirkums vēl nav ieslēgts (AUTODNA_PURCHASE_LIVE)" };
    }
    say(`pirkums ar kredītu: ${v} ("${first.payLabel}")`);
    paymentArmed = true;
    let clicked = false;
    try {
      const credit = p.locator("#payment-select-credit").first();
      const scope = p.locator("form").filter({ has: credit }).first();
      const btn = (await scope.count()) ? scope.getByText(first.payLabel, { exact: true }).first() : p.getByText(first.payLabel, { exact: true }).first();
      await btn.click({ timeout: 10_000 });
      clicked = true;
      for (let i = 0; i < 40; i++) {
        await p.waitForTimeout(3000);
        if (!p.url().startsWith(DNA_ORIGIN)) continue;
        const st = await isLogin(p, v);
        if (st.reportBought) return { ok: true, clicked: true };
        const credits = parseClientCredits(await ajax(p, "/ajax/get_client_credits"));
        if (typeof creditsBefore === "number" && typeof credits === "number" && credits < creditsBefore) return { ok: true, clicked: true };
      }
      await debugDump(p, "purchase-unconfirmed");
      return { ok: false, clicked: true, code: "purchase_unconfirmed", message: "Poga nospiesta, bet pirkums nav apstiprināts - pārbaudi AutoDNA kontā" };
    } catch (e) {
      await debugDump(p, "purchase-click-failed", { error: String(e?.message ?? "").slice(0, 120) });
      return { ok: false, clicked, code: clicked ? "purchase_unconfirmed" : "pay_click_failed", message: "AutoDNA pirkuma poga neizdevās" };
    } finally {
      paymentArmed = false;
    }
  }

  /**
   * Arhīva foto JAU NOPIRKTAI atskaitei (tikai lasīšana, tas pats ceļš kā PDF): vēsture ?search=VIN -> atskaites lapa ->
   * sadaļa «Transportlīdzekļa arhīva fotogrāfijas» -> bilžu saites + datumi -> lejupielāde lapas kontekstā.
   * Neko nespiež (izņemot sīkdatņu logu "Noraidīt"), uz /vin/<VIN> pirkuma lapu neiet.
   */
  async function reportPhotos(vin) {
    const v = normalizeVin(vin);
    const p = await getPage();
    const href = pickReportPageHref(await historyItems(p, v), v);
    if (!href) return { ok: false, code: "not_in_history" };
    await p.goto(href, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await p.waitForTimeout(3500);
    await dismissConsent(p);
    // Slinkā ielāde: aizritina līdz sadaļai un tai cauri.
    await p
      .evaluate(async () => {
        const re = /arh[iī]va\s+fotogr|archive\s+photo|archiwaln/i;
        const head = [...document.querySelectorAll("h1,h2,h3,h4,h5,.title,.section-title,[class*='title']")].find((el) => re.test(el.textContent || ""));
        if (!head) return;
        head.scrollIntoView();
        for (let i = 0; i < 12; i++) {
          window.scrollBy(0, 700);
          await new Promise((r) => setTimeout(r, 250));
        }
      })
      .catch(() => undefined);
    await p.waitForTimeout(1500);
    const items = await p
      .evaluate(() => {
        const re = /arh[iī]va\s+fotogr|archive\s+photo|archiwaln/i;
        const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,.title,.section-title,[class*='title']")];
        const head = heads.find((el) => re.test(el.textContent || ""));
        if (!head) return null;
        const level = /^H[1-6]$/.test(head.tagName) ? Number(head.tagName[1]) : 3;
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        walker.currentNode = head;
        let n = 0;
        let node = walker.nextNode();
        while (node && n < 3000) {
          n++;
          if (node.nodeType === 1) {
            const el = node;
            if (/^H[1-6]$/.test(el.tagName) && Number(el.tagName[1]) <= level && !re.test(el.textContent || "") && out.some((x) => x.type === "img")) break;
            if (el.tagName === "IMG") {
              const a = el.closest("a[href]");
              out.push({
                type: "img",
                href: a ? a.href : "",
                dataFull: el.getAttribute("data-full") || el.getAttribute("data-large") || el.getAttribute("data-original") || "",
                dataSrc: el.getAttribute("data-src") || el.getAttribute("data-lazy") || "",
                srcset: el.getAttribute("srcset") || el.getAttribute("data-srcset") || "",
                src: el.currentSrc || el.src || "",
              });
            }
          } else {
            const t = (node.textContent || "").trim();
            if (t && /\d{2}\.\d{2}\.\d{4}/.test(t) && t.length <= 60) out.push({ type: "date", text: t });
          }
          node = walker.nextNode();
        }
        return out;
      })
      .catch(() => null);
    if (!items) {
      await debugDump(p, "photos-no-section");
      return { ok: true, groups: [] };
    }
    const entries = collectDomPhotoEntries(items, { dateStyle: "day" });
    if (!entries.length) {
      await debugDump(p, "photos-none");
      return { ok: true, groups: [] };
    }
    const groups = await downloadArchivePhotos(p, entries, { log: say });
    return { ok: true, groups };
  }

  return {
    reportPhotos,
    peekSession,
    ensureSession,
    login,
    account,
    listReports,
    downloadPdf,
    purchase,
    precheck,
    probe,
    paymentArmed: () => paymentArmed,
  };
}
