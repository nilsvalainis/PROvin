/**
 * AutoDNA pārlūka soļi (Playwright, viens Chrome profils). Tīrā loģika: ./dna-page.mjs.
 *
 * Ko relejs dara:
 *   - pieteikšanās ar e-pastu + paroli (sākumlapas forma #form-login; Google / Facebook pogas NElieto);
 *   - konts: kredītu atlikums (/ajax/get_client_credits) un "vai šim VIN jau nopirkts" (/ajax/client_is_login) -
 *     tie paši pieprasījumi, ko sūta AutoDNA lapa pati;
 *   - "Manas atskaites" (/profile/history) un nopirktās atskaites PDF;
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
  DNA_PROFILE_URLS,
  analyzePurchasePage,
  classifyLoginResponse,
  dnaVinUrl,
  isPdfBase64,
  normalizeVin,
  parseClientCredits,
  parseCreditsFromText,
  parseHistoryRows,
  parseIsLogin,
  pickPdfHref,
  redact,
  totalLooksLikeCredit,
} from "./dna-page.mjs";

/** Pēc nepareizas paroles nemēģina atkal 6 h (konta bloķēšanas risks); citādi ne biežāk kā reizi 10 min. */
const BAD_CREDENTIALS_COOLDOWN_MS = 6 * 3600_000;
const LOGIN_COOLDOWN_MS = 10 * 60_000;
const PDF_MAX_BYTES = 15 * 1024 * 1024;

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

  async function dismissConsent(p) {
    const no = p.locator("a.cmpboxbtnno").first();
    if (await no.isVisible().catch(() => false)) {
      await no.click().catch(() => undefined);
      await p.waitForTimeout(600);
    }
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
    await p.waitForTimeout(2500);
    await dismissConsent(p);
    const opener = p.locator("button.header-login").first();
    if (!(await opener.isVisible().catch(() => false))) {
      await debugDump(p, "login-no-button");
      return { state: "needs_human", code: "login_page_changed" };
    }
    await opener.click().catch(() => undefined);
    await p.waitForTimeout(1200);
    await dismissConsent(p);
    const emailEl = p.locator("#form-login-email");
    const passEl = p.locator("#form-login-pass");
    if (!(await passEl.isVisible().catch(() => false))) {
      await debugDump(p, "login-no-form");
      return { state: "needs_human", code: "login_page_changed" };
    }
    await emailEl.fill(email);
    await passEl.fill(password);
    if (!(await p.locator("#sidebar-login-checkbox").isChecked().catch(() => false))) {
      await p.locator("label.terms-login-widget-text .terms-checkbox-checkmark").first().click().catch(() => undefined);
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

  /** Konta vēstures lapas rindas (VIN + saites). */
  async function historyRows(p) {
    for (const url of DNA_PROFILE_URLS) {
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
      await p.waitForTimeout(2500);
      await dismissConsent(p);
      if (!p.url().includes("/profile")) continue;
      const rows = await p
        .evaluate(() =>
          [...document.querySelectorAll("tr, li, .card, [class*=report], [class*=history] > div")]
            .filter((el) => el.getClientRects().length > 0 && /[A-HJ-NPR-Z0-9]{17}/i.test(el.innerText || ""))
            .slice(0, 200)
            .map((el) => ({
              text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 400),
              links: [...el.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href") || "", text: (a.innerText || "").trim().slice(0, 60) })),
            })),
        )
        .catch(() => []);
      const parsed = parseHistoryRows(rows);
      if (parsed.length) return parsed;
    }
    return [];
  }

  /** "Manas atskaites" (tikai lasīšana): VIN + datums. */
  async function listReports() {
    const p = await getPage();
    const rows = await historyRows(p);
    if (!rows.length) await debugDump(p, "history-empty");
    return rows.map((r) => ({ vin: r.vin, date: r.date, links: r.links.length }));
  }

  async function fetchPdf(href) {
    const ctx = await getContext();
    const res = await ctx.request.get(href, { timeout: 90_000, maxRedirects: 5 }).catch(() => null);
    if (!res || !res.ok()) return { ok: false, code: `pdf_get_${res ? res.status() : "x"}` };
    let host = "";
    try {
      host = new URL(res.url()).hostname;
    } catch {
      /* */
    }
    if (!/(^|\.)autodna\.(lv|com|pl)$/i.test(host)) return { ok: false, code: "pdf_foreign_host" };
    const buf = await res.body();
    if (buf.length > PDF_MAX_BYTES) return { ok: false, code: "pdf_too_large" };
    const base64 = buf.toString("base64");
    if (!isPdfBase64(base64)) return { ok: false, code: "not_pdf" };
    return { ok: true, base64, size: buf.length };
  }

  /** Nopirktās atskaites PDF: konta vēsture -> šī VIN rinda -> lejupielādes saite (vai atskaites lapa -> saite). */
  async function downloadPdf(vin) {
    const v = normalizeVin(vin);
    const p = await getPage();
    const rows = (await historyRows(p)).filter((r) => r.vin === v);
    const links = rows.flatMap((r) => r.links);
    let href = pickPdfHref(links, v);
    if (!href) {
      // Rindā ir saite uz atskaites lapu (nevis tieši PDF) - atver to un meklē lejupielādes saiti.
      for (const l of links.slice(0, 4)) {
        let u;
        try {
          u = new URL(l.href, DNA_ORIGIN);
        } catch {
          continue;
        }
        if (u.origin !== DNA_ORIGIN) continue;
        await p.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
        await p.waitForTimeout(3000);
        const pageLinks = await p
          .evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href") || "", text: (a.innerText || "").trim().slice(0, 60) })))
          .catch(() => []);
        href = pickPdfHref(pageLinks, v);
        if (href) break;
      }
    }
    if (!href) {
      await debugDump(p, "pdf-link-missing", { rows: rows.length });
      return { ok: false, code: rows.length ? "pdf_link_missing" : "not_in_history" };
    }
    const out = await fetchPdf(href);
    if (out.ok) say(`PDF ${v}: ${out.size} B`);
    return out;
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

  return {
    peekSession,
    ensureSession,
    login,
    account,
    listReports,
    downloadPdf,
    purchase,
    probe,
    paymentArmed: () => paymentArmed,
  };
}
