#!/usr/bin/env node
// iriss-waybill-worker: automātiski izraksta STANDARTA CSDD pavadzīmes no rindas (akts "Noformēt pavadzīmi" vai jauna).
// Ik 10 s: GET /api/iriss/aivars/waybill-requests?scope=auto&live=0|1 (serveris dod tikai standarta darbus; live = sirdspuksts UI)
// -> lokāla pārbaude -> VPN /status (Nils lieto VPN -> neko nedara) -> claim (serveris pārbauda vēlreiz) -> VPN lease (iriss-vpn-ctl)
// -> sync.js (numura statuss CSDD, momentuzņēmums -> POST /api/iriss/aivars/waybill-plates) -> [annul.js] -> refill.js -> save.js -> PDF -> result
// -> VPN release (vienmēr, finally). Katrs solis tiek ziņots serverim (events stage), UI rāda tikai reālos soļus.
// Nestandarta darbus neaiztiek (Aivars). Pats nekad nepārtrauc/neanulē; annul.js tikai lietotāja apstiprinātai pavadzīmei un
// tikai ar IRISS_WAYBILL_ANNUL_LIVE=1 (noklusējumā izslēgts).
// Env (/etc/iriss-ttr/env): IRISS_API_BASE, IRISS_AIVARS_API_TOKEN, IRISS_WAYBILL_WORKER_LIVE=1 (citādi dry-run: tikai logo),
// IRISS_WAYBILL_ANNUL_LIVE=1 (anulēt iepriekšējo un izveidot jaunu; noklusējumā nē),
// CSDD numuru sync (j13, Nils 23.10): tieši pirms un pēc katra darba (processJob) + periodiski TIKAI 08:00-19:00 Rīgas laikā
// ik ~60-75 min ar nejaušu nobīdi, ne uz apaļām minūtēm (csdd-sync-schedule.mjs), tikai ja VPN jau ieslēgts. Naktī neko.
// IRISS_CSDD_SYNC_PERIODIC=0 - periodisko izslēdz (pirms/pēc darba paliek). Vecais IRISS_CSDD_SYNC_MIN vairs netiek lietots.

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { nextPeriodicSyncAt } from "./csdd-sync-schedule.mjs";
import { csddPeriodicSyncEnabled, periodicPlateSync, processJob, resolveWorkerScript } from "./waybill-worker-core.mjs";

const run = promisify(execFile);
const TTR_DIR = process.env.IRISS_TTR_DIR || "/root/iriss-ttr";
const API_BASE = (process.env.IRISS_API_BASE || "https://www.provin.lv").replace(/\/+$/, "");
const TOKEN = process.env.IRISS_AIVARS_API_TOKEN || "";
const LIVE = process.env.IRISS_WAYBILL_WORKER_LIVE === "1";
const ANNUL_LIVE = process.env.IRISS_WAYBILL_ANNUL_LIVE === "1";
const PERIODIC_SYNC = csddPeriodicSyncEnabled(process.env.IRISS_CSDD_SYNC_PERIODIC);
const POLL_MS = 10_000;
const SCRIPT_TIMEOUT_MS = 180_000;

function log(msg, extra = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));
}

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
    const r = await call("GET", `?scope=auto&live=${LIVE ? "1" : "0"}`);
    if (r.status !== 200) throw new Error(`pending_http_${r.status}`);
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
  async event(id, body) {
    await call("POST", `/${encodeURIComponent(id)}/events`, body);
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
  const file = resolveWorkerScript(step, { annulEnabled: ANNUL_LIVE });
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
        annulEnabled: ANNUL_LIVE,
        vpnBusyNotified,
      });
      log("job_done", { id: job.id, ...res });
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
}

if (!TOKEN) {
  log("missing_token_env");
  process.exit(2);
}
log("started", { live: LIVE, annul: ANNUL_LIVE, periodicSync: PERIODIC_SYNC, nextSync: new Date(nextSyncMs).toISOString() });
setInterval(() => void tick(), POLL_MS);
void tick();
