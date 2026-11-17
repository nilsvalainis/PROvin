#!/usr/bin/env node
/**
 * CSDD tirdzniecības reģistrs (ows.csdd.gov.lv:7775) -> PROVIN Autoparks. Bez AI. TIKAI LASĪŠANA.
 *
 * Palaiž run.sh (systemd taimeris 03:30 Europe/Riga, atkārto ik 20 min līdz 06:00). VPN lease caur vpn-ctl (9334).
 * Katrai firmai sava pieslēgšanās un savs pārlūka konteksts: IRISS (CSDD_TTR_ENV_FILE) un DZA (CSDD_TTR_ENV_FILE_DZA,
 * firma kiest_id 5092). Saraksts kā Aivara export-pien.js: ex('rep_lapt_tl'), ķeksis #lapt_veids, meklēšana, lapošana
 * (lib/csdd-session.mjs). Tad JSON `iriss-csdd-tirdzn-registrs/v1` + snapshot -> POST uz PROVIN importētāju.
 *
 * Aizsardzība: lib/readonly-guard.mjs - tīklā tikai GET/HEAD; POST tikai pieslēgšanās/firmas izvēles formai (login fāze)
 * un TIKAI meklēšanai `rep_lapt_tl` (read fāze, whitelist). Pogas ar rakstošu nozīmi netiek spiestas, dialogi noraidīti.
 *
 * Karogi: --dry-run (nesūta uz PROVIN, tikai saglabā failu un izdrukā skaitus).
 * Izejas kodi: 0 ok, 2 nolasīšanas kļūda, 3 PROVIN kļūda, 75 VPN nav pieejams / lease zaudēts (mēģināt vēlāk).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { buildRegistryFile, summarizeRegistryFile } from "./lib/parse-registry.mjs";
import { loginCsdd, ownerLogin, playwrightOps, readTradeReport } from "./lib/csdd-session.mjs";
import { installReadOnlyGuard } from "./lib/readonly-guard.mjs";

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

/**
 * VPN: tas pats lease, ko lieto pavadzīmes (scripts/iriss-ttr/vpn-ctl.mjs, 127.0.0.1:9334). VPN loģiku nedublē.
 * `POST /lease` ieslēdz VPN (ja nav) un pagarina lease; 409 `vpn_blocked_manual` = Nils lieto VPN ("Man vajag VPN")
 * -> izlaižam un mēģinām pēc 20 min. Atbrīvošana = vpn-ctl idle autostop (atsevišķa release nav).
 */
const VPN_CTL_URL = (env.VPN_CTL_URL || "http://127.0.0.1:9334").replace(/\/$/, "");

async function vpnLease() {
  try {
    const res = await fetch(`${VPN_CTL_URL}/lease`, { method: "POST", signal: AbortSignal.timeout(90000) });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) return { ok: false, reason: "vpn_blocked_manual" };
    if (!res.ok) return { ok: false, reason: `vpn_ctl_${res.status}` };
    return { ok: body.vpn === "up", reason: body.vpn === "up" ? "" : "vpn_down" };
  } catch {
    return { ok: false, reason: "vpn_ctl_unreachable" };
  }
}

/** Keep-alive: ik 60 s pagarina lease; ja lease atteikts vai VPN atslēgts ("Man vajag VPN") - darbs tiek pārtraukts. */
function startKeepAlive(onLost) {
  const t = setInterval(async () => {
    const r = await vpnLease();
    if (!r.ok) onLost(r.reason);
  }, Number(env.VPN_KEEPALIVE_MS || 60000));
  return () => clearInterval(t);
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
  const lease = await vpnLease();
  if (!lease.ok) {
    log(`VPN nav pieejams (${lease.reason}) - mēģināsim vēlāk`);
    writeLast({ ok: false, error: lease.reason, retry: true });
    return EX_TEMPFAIL;
  }
  if (!(await tcpReachable(BASE_URL))) {
    log("reģistrs nav sasniedzams (VPN?) - mēģināsim vēlāk");
    return EX_TEMPFAIL;
  }
  let lost = false;
  const stopKeepAlive = startKeepAlive((reason) => {
    lost = true;
    log(`VPN lease zaudēts (${reason}) - pārtraucu, nekas netiek sūtīts`);
  });
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const blocked = [];
  try {
    const pages = [];
    for (const owner of OWNERS) {
      if (lost) return EX_TEMPFAIL;
      // Katrai firmai savs konteksts (sīkdatnes): DZA firmas izvēle neietekmē ĪRISS sesiju un otrādi.
      const context = await browser.newContext({ ignoreHTTPSErrors: env.REGISTRS_IGNORE_TLS === "1" });
      const guard = await installReadOnlyGuard(context, {
        loginPostRe: env.REGISTRS_LOGIN_POST_RE ? new RegExp(env.REGISTRS_LOGIN_POST_RE, "i") : null,
        readPostRe: env.REGISTRS_READ_POST_RE ? new RegExp(env.REGISTRS_READ_POST_RE, "i") : null,
        csddBaseUrl: BASE_URL,
        log,
      });
      try {
        const ops = playwrightOps(await context.newPage(), Number(env.REGISTRS_TIMEOUT_MS || 90000));
        await loginCsdd(ops, ownerLogin(owner, env), { baseUrl: BASE_URL, log });
        guard.setPhase("read");
        const read = await readTradeReport(ops, { owner, maxPages: MAX_PAGES, isLost: () => lost });
        log(`${owner}: ${read.length} lapas`);
        pages.push(...read);
      } finally {
        blocked.push(...guard.blocked);
        await context.close().catch(() => {});
      }
    }
    if (lost) return EX_TEMPFAIL;
    const file = buildRegistryFile(pages, { owners: OWNERS, generatedAt: rigaDate() });
    const summary = summarizeRegistryFile(file);
    // Nezināma firma pilnā nolasījumā nozīmētu nepareizu īpašnieku jaunam auto - tad neko nesūtām.
    if (summary.byOwner["?"]) {
      writeLast({ ok: false, error: "owner_unknown", summary });
      log(`${summary.byOwner["?"]} auto bez firmas - pārbaudi REGISTRS_OWNERS un firmas kolonnu`);
      return 2;
    }
    const out = path.join(STATE_DIR, `registrs-${rigaDate()}.json`);
    writeFileSync(out, JSON.stringify(file, null, 2), { mode: 0o600 });
    log(`nolasīti ${summary.total} auto ${JSON.stringify(summary.byOwner)}; bloķēti pieprasījumi: ${blocked.length}`);
    if (summary.total === 0) {
      log("0 auto - visticamāk nolasīšanas kļūda, PROVIN netiek sūtīts");
      writeLast({ ok: false, error: "empty_read", summary });
      return 2;
    }
    if (DRY_RUN) {
      writeLast({ ok: true, dryRun: true, summary, blocked: blocked.length, blockedList: blocked.slice(0, 20) });
      return 0;
    }
    const result = await postToProvin(file);
    writeLast({ ok: true, summary, result, blocked: blocked.length });
    log(`PROVIN: ${JSON.stringify(result)}`);
    return 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`kļūda: ${msg}`);
    writeLast({ ok: false, error: msg, blocked: blocked.length, blockedList: blocked.slice(0, 20) });
    if (msg === "vpn_lost") return EX_TEMPFAIL;
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
