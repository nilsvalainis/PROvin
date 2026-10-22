#!/usr/bin/env node
/**
 * CSDD tirdzniecības reģistrs (ows.csdd.gov.lv:7775) -> PROVIN Autoparks. Bez AI. TIKAI LASĪŠANA.
 *
 * Palaiž run.sh (systemd taimeris 03:30 Europe/Riga, atkārto ik 20 min līdz 06:00), kad VPN lease ir iegūts.
 * 1) pieslēdzas ar to pašu CSDD loginu, ko /root/iriss-ttr (env), 2) atver pieņemto auto sarakstu katrai firmai (GET),
 * 3) nolasa tabulas, 4) uzbūvē JSON `iriss-csdd-tirdzn-registrs/v1` + snapshot, 5) POST uz PROVIN importētāju.
 *
 * Aizsardzība: lib/readonly-guard.mjs - tīklā tikai GET/HEAD (POST tikai pieslēgšanās adresei pieslēgšanās fāzē),
 * pogas ar rakstošu nozīmi netiek spiestas, dialogi tiek noraidīti.
 *
 * Karogi: --dry-run (nesūta uz PROVIN, tikai saglabā failu un izdrukā skaitus).
 * Izejas kodi: 0 ok, 2 nolasīšanas kļūda, 3 PROVIN kļūda, 75 VPN nav pieejams / lease zaudēts (mēģināt vēlāk).
 */

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { buildRegistryFile, summarizeRegistryFile } from "./lib/parse-registry.mjs";
import { installReadOnlyGuard, safeClick } from "./lib/readonly-guard.mjs";

const EX_TEMPFAIL = 75;
const env = process.env;
const DRY_RUN = process.argv.includes("--dry-run");
const STATE_DIR = env.REGISTRS_STATE_DIR || "/var/lib/csdd-registrs";
const BASE_URL = (env.REGISTRS_BASE_URL || "https://ows.csdd.gov.lv:7775").replace(/\/$/, "");
const OWNERS = (env.REGISTRS_OWNERS || "IRISS,DZA").split(",").map((s) => s.trim().toUpperCase()).filter((s) => s === "IRISS" || s === "DZA");
const MAX_PAGES = Number(env.REGISTRS_MAX_PAGES || 30);
const started = Date.now();

function log(msg) {
  console.log(`[csdd-registrs] ${new Date().toISOString()} ${msg}`);
}

function rigaDate(d = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Riga" }).format(d);
}

/** Vienkāršs KEY=VALUE lasītājs (tas pats CSDD logins no /root/iriss-ttr env faila). Vērtības nekad neizdrukā. */
function readEnvFile(file) {
  const out = {};
  if (!file || !existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

function credentials() {
  const ttr = readEnvFile(env.CSDD_TTR_ENV_FILE || "/root/iriss-ttr/.env");
  const userVar = env.CSDD_USER_VAR || "CSDD_USER";
  const passVar = env.CSDD_PASS_VAR || "CSDD_PASS";
  return { user: env[userVar] || ttr[userVar] || "", pass: env[passVar] || ttr[passVar] || "" };
}

/** Playwright: vispirms savs node_modules, citādi tas pats, ko lieto /root/iriss-ttr. */
async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const dir = env.IRISS_TTR_DIR || "/root/iriss-ttr";
    const req = createRequire(path.join(dir, "package.json"));
    return req("playwright");
  }
}

function tcpReachable(urlStr, timeoutMs = 5000) {
  const u = new URL(urlStr);
  return new Promise((resolve) => {
    const sock = net.connect({ host: u.hostname, port: Number(u.port || 443) });
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
  });
}

/** VPN keep-alive caur kopīgo lease komandu. Ja lease zaudēts ("Man vajag VPN"), darbs tiek pārtraukts. */
function startKeepAlive(onLost) {
  const cmd = env.VPN_LEASE_CMD;
  if (!cmd) return () => {};
  const holder = env.VPN_LEASE_HOLDER || "csdd-registrs";
  const t = setInterval(() => {
    const p = spawn("/bin/sh", ["-c", `${cmd} keepalive ${holder}`], { stdio: "ignore" });
    p.on("exit", (code) => {
      if (code !== 0) onLost(code);
    });
  }, Number(env.VPN_KEEPALIVE_MS || 60000));
  return () => clearInterval(t);
}

async function extractTables(page) {
  return page.evaluate(() => {
    const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
    return [...document.querySelectorAll("table")]
      .map((t) => {
        const rows = [...t.querySelectorAll("tr")];
        if (rows.length < 2) return null;
        const headRow = t.querySelector("thead tr") || rows.find((r) => r.querySelector("th")) || rows[0];
        const headers = [...headRow.querySelectorAll("th,td")].map((c) => clean(c.textContent));
        const body = rows.filter((r) => r !== headRow).map((r) => [...r.querySelectorAll("td")].map((c) => clean(c.textContent)));
        return { headers, rows: body.filter((r) => r.length >= 2) };
      })
      .filter(Boolean);
  });
}

async function login(page) {
  const loginUrl = env.REGISTRS_LOGIN_URL || `${BASE_URL}/`;
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  const pass = page.locator(env.REGISTRS_PASS_SELECTOR || "input[type=password]").first();
  if ((await pass.count()) === 0) {
    log("pieslēgšanās forma nav redzama (sesija jau aktīva)");
    return;
  }
  const { user, pass: pw } = credentials();
  if (!user || !pw) throw new Error("csdd_credentials_missing");
  await page.locator(env.REGISTRS_USER_SELECTOR || "input[type=text], input[type=email], input:not([type])").first().fill(user);
  await pass.fill(pw);
  const btn = page.locator(env.REGISTRS_LOGIN_BUTTON_SELECTOR || "button, input[type=submit]").filter({ hasText: /./ }).first();
  if ((await btn.count()) > 0) await safeClick(btn, "login");
  else await pass.press("Enter");
  await page.waitForLoadState("domcontentloaded", { timeout: 60000 });
  if ((await page.locator("input[type=password]").count()) > 0) throw new Error("csdd_login_failed");
  log("pieslēgts");
}

/** Saraksta lapas: tikai GET navigācija (goto + saites ar href). */
async function readListPages(page, url, owner) {
  await page.goto(url.startsWith("http") ? url : `${BASE_URL}${url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const pages = [];
  const seen = new Set();
  for (let i = 0; i < MAX_PAGES; i++) {
    seen.add(page.url());
    pages.push({ owner, tables: await extractTables(page) });
    const next = page.locator(env.REGISTRS_NEXT_SELECTOR || "a[href]").filter({ hasText: /^\s*(nākamā|nakama|nākošā|›|»|>)\s*$/i }).first();
    if ((await next.count()) === 0) break;
    const href = await next.getAttribute("href");
    if (!href || /^javascript:/i.test(href)) break;
    const abs = new URL(href, page.url()).toString();
    if (seen.has(abs)) break;
    await safeClick(next, "read");
    await page.waitForLoadState("domcontentloaded", { timeout: 60000 });
  }
  return pages;
}

async function postToProvin(file) {
  const url = env.PROVIN_REGISTRS_URL || "https://provin.lv/api/iriss/csdd-registrs";
  const token = env.PROVIN_REGISTRS_TOKEN || "";
  if (!token) throw new Error("provin_token_missing");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(file),
    signal: AbortSignal.timeout(120000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`provin_${res.status}_${body.error || ""}`);
  return body;
}

async function main() {
  mkdirSync(STATE_DIR, { recursive: true });
  if (!(await tcpReachable(BASE_URL))) {
    log("reģistrs nav sasniedzams (VPN?) - mēģināsim vēlāk");
    return EX_TEMPFAIL;
  }
  let lost = false;
  const stopKeepAlive = startKeepAlive((code) => {
    lost = true;
    log(`VPN lease zaudēts (kods ${code}) - pārtraucu`);
  });
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: env.REGISTRS_IGNORE_TLS === "1" });
  const guard = await installReadOnlyGuard(context, {
    loginPostRe: env.REGISTRS_LOGIN_POST_RE ? new RegExp(env.REGISTRS_LOGIN_POST_RE, "i") : /login|logon|auth|j_security_check|signin/i,
    readPostRe: env.REGISTRS_READ_POST_RE ? new RegExp(env.REGISTRS_READ_POST_RE, "i") : null,
    log,
  });
  try {
    const page = await context.newPage();
    await login(page);
    guard.setPhase("read");
    const pages = [];
    // Katrai firmai sava saraksta adrese (REGISTRS_LIST_URL_IRISS / _DZA) vai viena kopīga (REGISTRS_LIST_URL) ar firmas kolonnu.
    const perOwner = OWNERS.every((o) => env[`REGISTRS_LIST_URL_${o}`]);
    const lists = perOwner
      ? OWNERS.map((o) => ({ url: env[`REGISTRS_LIST_URL_${o}`], owner: o }))
      : [{ url: env.REGISTRS_LIST_URL, owner: OWNERS.length === 1 ? OWNERS[0] : undefined }];
    for (const l of lists) {
      if (!l.url) throw new Error("list_url_missing");
      if (lost) return EX_TEMPFAIL;
      pages.push(...(await readListPages(page, l.url, l.owner)));
    }
    if (lost) return EX_TEMPFAIL;
    const file = buildRegistryFile(pages, { owners: OWNERS, generatedAt: rigaDate() });
    const summary = summarizeRegistryFile(file);
    // Nezināma firma pilnā nolasījumā nozīmētu nepareizu īpašnieku jaunam auto - tad neko nesūtām.
    if (summary.byOwner["?"]) {
      writeLast({ ok: false, error: "owner_unknown", summary });
      log(`${summary.byOwner["?"]} auto bez firmas - pārbaudi REGISTRS_LIST_URL_* vai firmas kolonnu`);
      return 2;
    }
    const out = path.join(STATE_DIR, `registrs-${rigaDate()}.json`);
    writeFileSync(out, JSON.stringify(file, null, 2), { mode: 0o600 });
    log(`nolasīti ${summary.total} auto ${JSON.stringify(summary.byOwner)}; bloķēti pieprasījumi: ${guard.blocked.length}`);
    if (summary.total === 0) {
      log("0 auto - visticamāk nolasīšanas kļūda, PROVIN netiek sūtīts");
      writeLast({ ok: false, error: "empty_read", summary });
      return 2;
    }
    if (DRY_RUN) {
      writeLast({ ok: true, dryRun: true, summary, blocked: guard.blocked.length });
      return 0;
    }
    const result = await postToProvin(file);
    writeLast({ ok: true, summary, result, blocked: guard.blocked.length });
    log(`PROVIN: ${JSON.stringify(result)}`);
    return 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`kļūda: ${msg}`);
    writeLast({ ok: false, error: msg });
    return msg.startsWith("provin_") ? 3 : 2;
  } finally {
    stopKeepAlive();
    await browser.close().catch(() => {});
  }
}

function writeLast(data) {
  const rec = { ...data, at: new Date().toISOString(), durationSec: Math.round((Date.now() - started) / 1000) };
  writeFileSync(path.join(STATE_DIR, "last-run.json"), JSON.stringify(rec, null, 2), { mode: 0o600 });
}

main().then(
  (code) => process.exit(code),
  (e) => {
    log(`negaidīta kļūda: ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  },
);
