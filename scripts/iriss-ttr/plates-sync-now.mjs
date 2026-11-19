#!/usr/bin/env node
// TIKAI LASA: tūlītēja CSDD numurzīmju stāvokļa sinhronizācija (B193-7, B762-7, B192-7) -> POST /api/iriss/aivars/waybill-plates.
// Tas pats, ko worker dara periodiski (periodicPlateSync), bet uzreiz - piem. pēc pavadzīmes, kas izrakstīta tieši CSDD.
// VPN: ja nav augšā, paņem lease (purpose waybill); ja Nils/Toms lieto VPN (409) - neko nedara.
// Palaišana (env no /etc/iriss-ttr/env, vērtības netiek drukātas):
//   systemd-run --wait --collect -p EnvironmentFile=/etc/iriss-ttr/env /usr/bin/node /root/iriss-ttr/ctl/plates-sync-now.mjs
// Nekas netiek saglabāts, pārtraukts vai anulēts CSDD.

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { periodicPlateSync, resolveWorkerScript } from "./waybill-worker-core.mjs";

const run = promisify(execFile);
const TTR_DIR = process.env.IRISS_TTR_DIR || "/root/iriss-ttr";
const API_BASE = (process.env.IRISS_API_BASE || "https://www.provin.lv").replace(/\/+$/, "");
const TOKEN = process.env.IRISS_AIVARS_API_TOKEN || "";
const log = (msg, extra = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

async function call(method, p, body, base = "waybill-requests") {
  const res = await fetch(`${API_BASE}/api/iriss/aivars/${base}${p}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const api = {
  async known() {
    const r = await call("GET", "?scope=auto&live=0&known=1");
    return r.status === 200 && r.data.knownWaybills && typeof r.data.knownWaybills === "object" ? r.data.knownWaybills : {};
  },
  async plates(snapshot) {
    const r = await call("POST", "", snapshot, "waybill-plates");
    if (r.status !== 200) throw new Error(`plates_http_${r.status}`);
  },
};

async function vpnStatus() {
  const res = await fetch("http://127.0.0.1:9334/status", { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`vpn_status_${res.status}`);
  return res.json();
}

async function vpnLease() {
  const res = await fetch("http://127.0.0.1:9334/lease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose: "waybill" }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error === "vpn_blocked_manual" ? "VPN lieto Nils/Toms" : `vpn_lease_${res.status}`);
  }
}

async function runScript(step, input) {
  const file = resolveWorkerScript(step, { annulEnabled: false });
  const { stdout } = await run("node", [path.join(TTR_DIR, file)], {
    cwd: TTR_DIR,
    env: { ...process.env, IRISS_JOB_JSON: JSON.stringify(input), IRISS_AUTO: "1" },
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(stdout.trim().split("\n").filter(Boolean).pop() || "{}");
}

try {
  const st = await vpnStatus();
  if (st.vpn !== "up") {
    log("vpn_lease_request");
    await vpnLease();
  }
  const res = await periodicPlateSync({ vpnStatus, runScript, api, now: () => Date.now(), log }, await api.known());
  log("plates_sync_now_done", { outcome: res.outcome, plates: (res.plates || []).map((p) => ({ plate: p.plate, ok: p.ok, active: (p.active || []).map((a) => a.waybillNo) })) });
} catch (err) {
  log("plates_sync_now_failed", { err: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
}
