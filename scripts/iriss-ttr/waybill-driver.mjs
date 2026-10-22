// CSDD TTR Playwright draiveris refill.js / save.js vajadzībām (līgums: waybill-scripts-core.mjs, "Draivera līgums").
// Selektori un adreses: <IRISS_TTR_DIR>/waybill-ui.json (paraugs waybill-ui.example.json). Bez tā - kļūda pirms jebkādas darbības.
// CSDD soļi: <IRISS_TTR_DIR>/waybill-adapter.cjs (waybill-adapter.cjs, Aivara jaunas standarta pavadzīmes soļi) pārraksta
// draivera soļus. main.js netiek importēts automātiski: tā augšējā līmeņa kods var palaist citu plūsmu.
// Aizsardzība (vienmēr, arī adaptera soļiem): tīkla bloķētājs, DOM klikšķu sargs, dialogu sargs (waybill-scripts-core.mjs).

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { dialogDecision, extractWaybillNo, FORBIDDEN_ACTION_RE, isClickAllowed, isRequestForbidden, SAVE_ACTION_RE } from "./waybill-scripts-core.mjs";

const FIELD_KEYS = ["plate", "brandModel", "vin", "routeFrom", "routeTo", "validFrom", "validUntil", "validHours"];

export function loadConfig(ttrDir) {
  const file = path.join(ttrDir, "waybill-ui.json");
  if (!fs.existsSync(file)) throw new Error("nav waybill-ui.json (selektori nav uzstādīti)");
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!cfg.startUrl) throw new Error("waybill-ui.json: nav startUrl");
  return cfg;
}

async function loadPlaywright(ttrDir) {
  try {
    return await import("playwright");
  } catch {
    return createRequire(path.join(ttrDir, "package.json"))("playwright");
  }
}

function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

/** "label:Regex" -> getByLabel, "text:Regex" -> getByText, citādi Playwright selektors. "{vin}" aizvieto. */
function loc(page, sel, vars = {}) {
  const s = String(sel).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
  if (s.startsWith("label:")) return page.getByLabel(new RegExp(s.slice(6), "i")).first();
  if (s.startsWith("text:")) return page.getByText(new RegExp(s.slice(5), "i")).first();
  return page.locator(s).first();
}

/** Lapā: klikšķu sargs (capture fāzē), kas bloķē pārtraukšanas/anulēšanas un - ārpus save fāzes - saglabāšanas vadīklas. */
function domGuardScript({ forbidden, save, phase }) {
  const F = new RegExp(forbidden, "i");
  const S = new RegExp(save, "i");
  window.__irissPhase = window.__irissPhase || phase;
  if (window.__irissGuard) return;
  window.__irissGuard = true;
  const label = (el) =>
    [el.innerText, el.value, el.id, el.name, el.title, el.getAttribute && el.getAttribute("aria-label"), el.getAttribute && el.getAttribute("onclick"), el.getAttribute && el.getAttribute("href")]
      .filter(Boolean)
      .join(" ");
  const block = (e) => {
    const el =
      e.type === "submit"
        ? e.submitter || e.target
        : e.target && e.target.closest
          ? e.target.closest("button,a,input,[onclick],[role=button]")
          : null;
    const text = el ? label(el) : "";
    const p = window.__irissPhase;
    if (F.test(text) || (p !== "save" && p !== "login" && S.test(text))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.warn("[iriss-guard] bloķēts:", text.slice(0, 80));
    }
  };
  document.addEventListener("click", block, true);
  document.addEventListener("submit", block, true);
}

/**
 * @param {"fill" | "save"} step
 * @param {{ ttrDir: string, env: Record<string, string | undefined>, log: (m: string, e?: object) => void }} opts
 */
export async function createPlaywrightDriver(step, { ttrDir, env, log }) {
  const cfg = loadConfig(ttrDir);
  const sel = cfg.selectors || {};
  const timeout = Number(cfg.timeoutMs || 30000);
  const adapterFile = path.join(ttrDir, "waybill-adapter.cjs");
  const adapter = fs.existsSync(adapterFile) ? createRequire(adapterFile)(adapterFile) : {};
  const { chromium } = await loadPlaywright(ttrDir);
  let browser;
  let context;
  let page;
  let phase = "fill";
  let own = false;

  async function setPhase(p) {
    phase = p;
    await page.evaluate((v) => {
      window.__irissPhase = v;
    }, p).catch(() => {});
  }

  /** Vienīgais klikšķu ceļš skriptā: pārbauda nozīmi pirms klikšķa. */
  async function safeClick(locator, why) {
    await locator.waitFor({ state: "visible", timeout });
    const el = await locator.evaluate((n) => ({
      text: (n.innerText || n.textContent || "").trim().slice(0, 120),
      value: n.value || "",
      id: n.id || "",
      name: n.getAttribute("name") || "",
      title: n.getAttribute("title") || "",
      ariaLabel: n.getAttribute("aria-label") || "",
      onclick: n.getAttribute("onclick") || "",
      href: n.getAttribute("href") || "",
    }));
    const verdict = isClickAllowed(el, phase);
    if (!verdict.allowed) throw new Error(`klikšķis aizliegts (${why}: ${verdict.reason})`);
    await locator.click({ timeout });
  }

  async function installGuards() {
    await context.route("**/*", (route) => {
      const req = route.request();
      if (isRequestForbidden({ url: req.url(), postData: req.postData() })) {
        log("blocked_request", { method: req.method(), url: req.url().slice(0, 120) });
        return route.abort();
      }
      return route.fallback();
    });
    const args = { forbidden: FORBIDDEN_ACTION_RE.source, save: SAVE_ACTION_RE.source, phase };
    await context.addInitScript(domGuardScript, args);
    await page.evaluate(domGuardScript, args).catch(() => {});
    page.on("dialog", (d) => {
      const decision = dialogDecision(d.message(), phase);
      log("dialog", { decision, text: d.message().slice(0, 80) });
      void (decision === "accept" ? d.accept() : d.dismiss()).catch(() => {});
    });
  }

  async function login() {
    const pass = loc(page, sel.pass || "input[type=password]");
    if ((await pass.count()) === 0) return;
    const ttrEnv = readEnvFile(env.CSDD_TTR_ENV_FILE || path.join(ttrDir, ".env"));
    const user = env[cfg.userVar || "CSDD_USER"] || ttrEnv[cfg.userVar || "CSDD_USER"] || "";
    const pw = env[cfg.passVar || "CSDD_PASS"] || ttrEnv[cfg.passVar || "CSDD_PASS"] || "";
    if (!user || !pw) throw new Error("nav CSDD piekļuves (env)");
    await loc(page, sel.user || "input[type=text]").fill(user);
    await pass.fill(pw);
    await setPhase("login");
    await safeClick(loc(page, sel.loginButton || "button[type=submit], input[type=submit]"), "login");
    await page.waitForLoadState("domcontentloaded", { timeout });
    await setPhase("fill");
    if ((await loc(page, sel.pass || "input[type=password]").count()) > 0) throw new Error("CSDD pieslēgšanās neizdevās");
  }

  const helpers = { loc: (s, v) => loc(page, s, v), safeClick, setPhase, log, cfg, ttrDir };

  const driver = {
    async open(input) {
      if (cfg.browserUrl) {
        browser = cfg.browserUrl.startsWith("ws") ? await chromium.connect(cfg.browserUrl) : await chromium.connectOverCDP(cfg.browserUrl);
        context = browser.contexts()[0] || (await browser.newContext());
        // Katram darbam sava cilne (window.name), lai refill un save strādā vienā un tajā pašā formā.
        for (const p of context.pages()) {
          if ((await p.evaluate(() => window.name).catch(() => "")) === `iriss-job-${input.jobId}`) page = p;
        }
      } else {
        own = true;
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ ignoreHTTPSErrors: cfg.ignoreTls === true });
      }
      const reuse = Boolean(page);
      page = page || (await context.newPage());
      page.setDefaultTimeout(timeout);
      await installGuards();
      if (adapter.open) return adapter.open(page, input, helpers);
      if (!reuse) {
        await page.goto(cfg.startUrl, { waitUntil: "domcontentloaded", timeout });
        await page.evaluate((n) => {
          window.name = n;
        }, `iriss-job-${input.jobId}`);
        await login();
        const company = sel.company?.[String(input.ctx)];
        if (company) await safeClick(loc(page, company), "company");
      }
    },
    async findActiveWaybill(input) {
      if (adapter.findActiveWaybill) return adapter.findActiveWaybill(page, input, helpers);
      return null;
    },
    async openFromTradeAct(input) {
      if (adapter.openFromTradeAct) return adapter.openFromTradeAct(page, input, helpers);
      if (!sel.tradeActList || !sel.tradeActRow || !sel.tradeActIssue) return false;
      await page.goto(new URL(sel.tradeActList, cfg.startUrl).toString(), { waitUntil: "domcontentloaded", timeout });
      const row = loc(page, sel.tradeActRow, { vin: input.vin });
      if ((await row.count()) === 0) return false;
      await safeClick(row.locator(sel.tradeActIssue).first(), "trade_act");
      await page.waitForLoadState("domcontentloaded", { timeout });
      return true;
    },
    async openNewWaybill(input) {
      if (adapter.openNewWaybill) return adapter.openNewWaybill(page, input, helpers);
      if (!sel.newWaybill) throw new Error("waybill-ui.json: nav selectors.newWaybill");
      await safeClick(loc(page, sel.newWaybill), "new_waybill");
      await page.waitForLoadState("domcontentloaded", { timeout });
    },
    async fillForm(values) {
      if (adapter.fillForm) return adapter.fillForm(page, values, helpers);
      const fields = sel.fields || {};
      for (const key of FIELD_KEYS) {
        if (!fields[key] || values[key] === "" || values[key] == null) continue;
        const el = loc(page, fields[key]);
        if ((await el.count()) === 0) continue;
        const tag = await el.evaluate((n) => n.tagName.toLowerCase());
        if (tag === "select") await el.selectOption({ label: values[key] }).catch(() => el.selectOption(values[key]));
        else if ((await el.inputValue()) !== values[key]) await el.fill(values[key]);
      }
    },
    async readForm() {
      if (adapter.readForm) return adapter.readForm(page, helpers);
      const out = {};
      for (const [key, s] of Object.entries(sel.fields || {})) {
        const el = loc(page, s);
        if ((await el.count()) === 0) continue;
        out[key] = await el.evaluate((n) => (n.tagName === "SELECT" ? n.options[n.selectedIndex]?.text || "" : "value" in n ? n.value : n.textContent || ""));
      }
      return out;
    },
    async formMode() {
      if (adapter.formMode) return adapter.formMode(page, helpers);
      const plate = sel.fields?.plate ? loc(page, sel.fields.plate) : null;
      return plate && (await plate.count()) > 0 ? "open" : "";
    },
    async clickSave() {
      if (step !== "save") throw new Error("Saglabāt drīkst tikai save.js");
      await setPhase("save");
      try {
        if (adapter.clickSave) await adapter.clickSave(page, helpers);
        else await safeClick(loc(page, sel.save || "button:has-text('Saglabāt'), input[value='Saglabāt']"), "save");
        await page.waitForLoadState("domcontentloaded", { timeout });
      } finally {
        await setPhase("pdf");
      }
    },
    async readWaybillNo() {
      if (adapter.readWaybillNo) return adapter.readWaybillNo(page, helpers);
      const re = cfg.waybillNoRe ? new RegExp(cfg.waybillNoRe, "i") : undefined;
      if (sel.waybillNo) {
        const el = loc(page, sel.waybillNo);
        await el.waitFor({ timeout }).catch(() => {});
        const t = ((await el.textContent().catch(() => "")) || "").trim();
        if (t) return re ? extractWaybillNo(t, re) : t;
      }
      return extractWaybillNo(await page.innerText("body"), re);
    },
    async downloadPdf(name) {
      if (adapter.downloadPdf) return adapter.downloadPdf(page, name, helpers);
      if (!sel.pdf) return "";
      const dir = path.join(ttrDir, "pdf");
      fs.mkdirSync(dir, { recursive: true });
      const [download] = await Promise.all([page.waitForEvent("download", { timeout }), safeClick(loc(page, sel.pdf), "pdf")]);
      const rel = path.join("pdf", `${name}.pdf`);
      await download.saveAs(path.join(ttrDir, rel));
      return rel;
    },
    async close({ keepPage }) {
      if (page && !keepPage && !own) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    },
  };
  return driver;
}
