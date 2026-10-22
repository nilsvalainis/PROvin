#!/usr/bin/env node
// iriss-waybill-worker: automātiski izraksta STANDARTA CSDD pavadzīmes no rindas.
// Ik 10 s: GET /api/iriss/aivars/waybill-requests?scope=auto (serveris dod tikai standarta darbus)
// -> lokāla pārbaude -> claim (serveris pārbauda vēlreiz) -> VPN lease (iriss-vpn-ctl) -> refill.js -> save.js -> PDF -> result.
// Nestandarta darbus neaiztiek (Aivars). Nekad nepārtrauc/neanulē aktīvu pavadzīmi (tikai ALLOWED_SCRIPTS).
// Env (/etc/iriss-ttr/env): IRISS_API_BASE, IRISS_AIVARS_API_TOKEN, IRISS_WAYBILL_WORKER_LIVE=1 (citādi dry-run: tikai logo).

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { processJob, resolveWorkerScript } from "./waybill-worker-core.mjs";

const run = promisify(execFile);
const TTR_DIR = process.env.IRISS_TTR_DIR || "/root/iriss-ttr";
const API_BASE = (process.env.IRISS_API_BASE || "https://www.provin.lv").replace(/\/+$/, "");
const TOKEN = process.env.IRISS_AIVARS_API_TOKEN || "";
const LIVE = process.env.IRISS_WAYBILL_WORKER_LIVE === "1";
const POLL_MS = 10_000;
const SCRIPT_TIMEOUT_MS = 180_000;

function log(msg, extra = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));
}

async function call(method, p, body) {
  const res = await fetch(`${API_BASE}/api/iriss/aivars/waybill-requests${p}`, {
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
    const r = await call("GET", "?scope=auto");
    if (r.status !== 200) throw new Error(`pending_http_${r.status}`);
    return Array.isArray(r.data.requests) ? r.data.requests : [];
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
};

async function vpnLease() {
  const res = await fetch("http://127.0.0.1:9334/lease", { method: "POST", signal: AbortSignal.timeout(45_000) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error === "vpn_blocked_manual" ? "VPN lieto Nils" : `vpn_lease_${res.status}`);
  }
}

/** Palaiž tikai allowlist skriptu; darbu nodod caur env IRISS_JOB_JSON, rezultāts = pēdējā stdout JSON rinda. */
async function runScript(step, input) {
  const file = resolveWorkerScript(step);
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
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const jobs = await api.pending();
    for (const job of jobs) {
      if (!LIVE && seen.has(job.id)) continue;
      seen.add(job.id);
      const res = await processJob(job, {
        api,
        vpnLease,
        runScript,
        readPdfBase64,
        now: () => Date.now(),
        log,
        dryRun: !LIVE,
      });
      log("job_done", { id: job.id, ...res });
    }
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
log("started", { live: LIVE });
setInterval(() => void tick(), POLL_MS);
void tick();
