#!/usr/bin/env node
// iriss-waybill-worker: automātiski izraksta STANDARTA CSDD pavadzīmes no rindas (akts "Noformēt pavadzīmi" vai jauna).
// Ik 2-10 s (adaptīvi): GET /api/iriss/aivars/waybill-requests?scope=auto&live=0|1 (serveris dod tikai standarta darbus; live = sirdspuksts UI)
// -> lokāla pārbaude -> VPN /status (Nils lieto VPN -> neko nedara) -> claim (serveris pārbauda vēlreiz) -> VPN lease (iriss-vpn-ctl)
// -> sync.js (numura statuss CSDD, momentuzņēmums -> POST /api/iriss/aivars/waybill-plates) -> [stop.js + sync.js] -> refill.js -> save.js -> PDF -> result
// -> VPN release (vienmēr, finally). Katrs solis tiek ziņots serverim (events stage), UI rāda tikai reālos soļus.
// Nestandarta darbus neaiztiek (Aivars). Nekad neanulē. Aizstāšana (Nils 20.11, A): stop.js «Pārtraukt» TIKAI lietotāja
// apstiprinātai vecajai pavadzīmei, tad jaunā; IRISS_WAYBILL_REPLACE_STOP=0 to izslēdz. annul.js worker nelieto.
// Env (/etc/iriss-ttr/env): IRISS_API_BASE, IRISS_AIVARS_API_TOKEN, IRISS_WAYBILL_WORKER_LIVE=1 (citādi dry-run: tikai logo),
// IRISS_WAYBILL_REPLACE_STOP (aizstāšana ar «Pārtraukt»; noklusējumā ieslēgts, "0" - izslēgts). IRISS_WAYBILL_ANNUL_LIVE vairs netiek lietots.
// CSDD numuru sync (j13, Nils 23.10): tieši pirms un pēc katra darba (processJob) + periodiski TIKAI 08:00-19:00 Rīgas laikā
// ik ~60-75 min ar nejaušu nobīdi, ne uz apaļām minūtēm (csdd-sync-schedule.mjs), tikai ja VPN jau ieslēgts. Naktī neko.
// IRISS_CSDD_SYNC_PERIODIC=0 - periodisko izslēdz (pirms/pēc darba paliek). Vecais IRISS_CSDD_SYNC_MIN vairs netiek lietots.
// Ātrums (Nils 20.11): (1) adaptīvs poll - serveris atbildē dod pollMs (2 s, kad pēdējās 15 min bija pieprasījums vai atvērta
// Pavadzīmju lapa, citādi 10 s); worker pats ātrs 15 min pēc sava darba. (2) Silts pārlūks (IRISS_WAYBILL_WARM_BROWSER,
// noklusējumā ieslēgts; "0" -> vecā uzvedība: katram solim atsevišķs node process ar jaunu pārlūku un pieslēgšanos):
// sync/stop/fill/save worker procesā vienā CSDD sesijā katrai firmai, tie paši sargi un ledger (waybill-warm-core.mjs).
// Pārlūks aizveras pēc IRISS_WAYBILL_WARM_IDLE_MIN (nokl. 10) min dīkstāves. (3) Žurnālā queuedSec (izveide -> claim).

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { nextPeriodicSyncAt } from "./csdd-sync-schedule.mjs";
import { platesForCtx } from "./csdd-waybills-core.mjs";
import { createWarmBrowserPool } from "./waybill-driver.mjs";
import { runCli } from "./waybill-scripts-core.mjs";
import { nextPollMs, runStepInProcess, warmBrowserEnabled, warmIdleMs } from "./waybill-warm-core.mjs";
import {
  callWithOneRetry,
  csddPeriodicSyncEnabled,
  periodicPlateSync,
  processJob,
  replaceStopEnabled,
  resolveWorkerScript,
} from "./waybill-worker-core.mjs";

const run = promisify(execFile);
const TTR_DIR = process.env.IRISS_TTR_DIR || "/root/iriss-ttr";
const API_BASE = (process.env.IRISS_API_BASE || "https://www.provin.lv").replace(/\/+$/, "");
const TOKEN = process.env.IRISS_AIVARS_API_TOKEN || "";
const LIVE = process.env.IRISS_WAYBILL_WORKER_LIVE === "1";
const REPLACE_STOP = replaceStopEnabled(process.env.IRISS_WAYBILL_REPLACE_STOP);
const PERIODIC_SYNC = csddPeriodicSyncEnabled(process.env.IRISS_CSDD_SYNC_PERIODIC);
const SCRIPT_TIMEOUT_MS = 180_000;

function log(msg, extra = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));
}

const pool = createWarmBrowserPool({ ttrDir: TTR_DIR, env: process.env, log, idleMs: warmIdleMs(process.env.IRISS_WAYBILL_WARM_IDLE_MIN) });
const WARM = warmBrowserEnabled(process.env.IRISS_WAYBILL_WARM_BROWSER) && pool.supported();
/** Pēdējā pending atbildē serveris ieteica (pollMs); pēdējais apstrādātais darbs (lokāli ātrs režīms). */
let serverPollMs = 0;
let lastJobAtMs = 0;

async function call(method, p, body, base = "waybill-requests") {
  const res = await fetch(`${API_BASE}/api/iriss/aivars/${base}${p}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const api = {
  async pending() {
    // 19.11: pending_http_500 / tīkla kļūda -> vienreiz atkārto pēc 2 s, tikai tad met kļūdu.
    const r = await callWithOneRetry(() => call("GET", `?scope=auto&live=${LIVE ? "1" : "0"}`), {
      onRetry: (info) => log("pending_retry", info),
    });
    if (r.status !== 200) throw new Error(`pending_http_${r.status}`);
    serverPollMs = Number(r.data.pollMs) || 0;
    return Array.isArray(r.data.requests) ? r.data.requests : [];
  },
  /** Zināmie pavadzīmju numuri pa firmām (CSDD + indekss) periodiskajai sinhronizācijai. */
  async known() {
    const r = await call("GET", `?scope=auto&live=${LIVE ? "1" : "0"}&known=1`);
    if (r.status !== 200) return {};
    return r.data.knownWaybills && typeof r.data.knownWaybills === "object" ? r.data.knownWaybills : {};
  },
  async claim(id) {
    const r = await call("POST", `/${encodeURIComponent(id)}/claim`, { worker: "auto" });
    return r.status === 200;
  },
  /** Atgriež servera statusu (07.11: "cancelled" = lietotājs atcēla - pirms Saglabāt neturpinām). */
  async event(id, body) {
    const r = await call("POST", `/${encodeURIComponent(id)}/events`, body);
    return typeof r.data?.status === "string" ? r.data.status : "";
  },
  async result(id, body) {
    const r = await call("POST", `/${encodeURIComponent(id)}/result`, body);
    if (r.status !== 200) throw new Error(`result_http_${r.status}`);
  },
  async release(id, reason) {
    await call("POST", `/${encodeURIComponent(id)}/release`, { reason });
  },
  /** CSDD numuru momentuzņēmums (aktīvās pavadzīmes, arī ar roku izrakstītās). */
  async plates(snapshot) {
    const r = await call("POST", "", snapshot, "waybill-plates");
    if (r.status !== 200) throw new Error(`plates_http_${r.status}`);
  },
};

/** iriss-vpn-ctl stāvoklis (blocked = Nils lieto VPN). Kļūda -> null (worker tad darbu neņem). */
async function vpnStatus() {
  const res = await fetch("http://127.0.0.1:9334/status", { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`vpn_status_${res.status}`);
  return res.json();
}

async function vpnLease() {
  // purpose waybill: hold režīmā pieslēdzas arī pēc atslēgšanas/izmešanas (Nils 23.10: nākamais pieprasījums pieslēdz).
  const res = await fetch("http://127.0.0.1:9334/lease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose: "waybill" }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error === "vpn_blocked_manual" ? "VPN lieto Nils" : `vpn_lease_${res.status}`);
  }
}

/** Darbs beidzies: atbrīvo lease, lai iriss-vpn-ctl drīz atslēdz VPN (Nila konts ir kopīgs). */
async function vpnRelease() {
  const res = await fetch("http://127.0.0.1:9334/release", { method: "POST", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`vpn_release_${res.status}`);
}

/** Palaiž tikai allowlist skriptu; darbu nodod caur env IRISS_JOB_JSON, rezultāts = pēdējā stdout JSON rinda. */
async function runScript(step, input) {
  // annul.js worker nepalaiž nekad (annulEnabled netiek padots); aizstāšana = stop.js.
  const file = resolveWorkerScript(step, { replaceStopEnabled: REPLACE_STOP });
  if (WARM) {
    // Tas pats runCli un tie paši sargi, tikai siltajā sesijā (bez jauna procesa, pārlūka un pieslēgšanās).
    return runStepInProcess(step, input, {
      pool,
      runCli,
      env: process.env,
      ledgerDir: process.env.IRISS_WAYBILL_LEDGER_DIR || path.join(TTR_DIR, "state", "waybill-jobs"),
      dateFormat: process.env.IRISS_TTR_DATE_FORMAT || "dd.MM.yyyy HH:mm",
      platesForCtx,
      timeoutMs: SCRIPT_TIMEOUT_MS,
      log,
      replaceStopEnabled: REPLACE_STOP,
      stderr: process.stderr,
    });
  }
  const { stdout } = await run("node", [path.join(TTR_DIR, file)], {
    cwd: TTR_DIR,
    env: { ...process.env, IRISS_JOB_JSON: JSON.stringify(input), IRISS_AUTO: "1" },
    timeout: SCRIPT_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  });
  const last = stdout.trim().split("\n").filter(Boolean).pop() || "{}";
  return JSON.parse(last);
}

async function readPdfBase64(p) {
  const resolved = path.resolve(TTR_DIR, p);
  if (!resolved.startsWith(TTR_DIR + path.sep) || !resolved.endsWith(".pdf")) throw new Error("pdf_path_outside");
  return (await fs.readFile(resolved)).toString("base64");
}

const seen = new Set();
/** Darbi, kuriem jau pateikts "VPN aizņemts" (vienreiz uz darbu). */
const vpnBusyNotified = new Set();
let busy = false;
let nextSyncMs = nextPeriodicSyncAt(Date.now());

/** Dienā, kamēr VPN ieslēgts: CSDD numuru stāvoklis (tikai lasa) pēc grafika. Ne darba laikā (busy). */
async function maybeSync() {
  if (!PERIODIC_SYNC || Date.now() < nextSyncMs) return;
  nextSyncMs = nextPeriodicSyncAt(Date.now());
  const res = await periodicPlateSync(
    { vpnStatus, runScript, api, now: () => Date.now(), log },
    await api.known().catch(() => ({})),
  ).catch((err) => ({ outcome: "failed", err: err instanceof Error ? err.message : "error" }));
  if (res.outcome === "failed") log("plates_sync_failed", { err: res.err });
  log("plates_sync_next", { at: new Date(nextSyncMs).toISOString(), outcome: res.outcome });
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const jobs = await api.pending();
    for (const job of jobs) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      const res = await processJob(job, {
        api,
        vpnStatus,
        vpnLease,
        vpnRelease,
        runScript,
        readPdfBase64,
        now: () => Date.now(),
        log,
        dryRun: !LIVE,
        replaceStopEnabled: REPLACE_STOP,
        vpnBusyNotified,
      });
      log("job_done", { id: job.id, warm: WARM, ...res });
      if (res.outcome !== "skipped" && res.outcome !== "dry_run") lastJobAtMs = Date.now();
      // VPN aizņemts (Nils): darbs nav aiztikts, nākamajā tick mēģinās vēlreiz.
      if (res.outcome === "vpn_busy") seen.delete(job.id);
      // Darbs pats sinhronizēja numuru (pirms un pēc): periodisko atliek.
      if (res.outcome !== "skipped" && res.outcome !== "dry_run" && res.outcome !== "vpn_busy") nextSyncMs = nextPeriodicSyncAt(Date.now());
    }
    await maybeSync();
  } catch (err) {
    log("tick_failed", { err: err instanceof Error ? err.message : "error" });
  } finally {
    busy = false;
  }
  // Silto pārlūku dīkstāvē aizver (RAM: serverim 3,7 GB).
  await pool.closeIdle().catch(() => {});
}

/** Nākamā aptauja pēc iepriekšējās beigām (2 s vai 10 s), nevis fiksēts setInterval. */
async function loop() {
  await tick();
  setTimeout(() => void loop(), nextPollMs({ serverPollMs, lastJobAtMs, nowMs: Date.now() }));
}

async function shutdown(sig) {
  log("stopping", { sig });
  await pool.closeAll().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

if (!TOKEN) {
  log("missing_token_env");
  process.exit(2);
}
log("started", { live: LIVE, replaceStop: REPLACE_STOP, periodicSync: PERIODIC_SYNC, warm: WARM, nextSync: new Date(nextSyncMs).toISOString() });
void loop();
