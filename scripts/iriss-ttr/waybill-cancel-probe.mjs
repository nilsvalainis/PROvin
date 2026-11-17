#!/usr/bin/env node
// #928 atcelšanas dzīvais tests uz Hetzner, BEZ CSDD (sk. waybill-cancel-probe-core.mjs).
// Lietošana (Hetzner, root):
//   systemctl stop iriss-waybill-worker            # citādi īstais worker paņem testa darbu
//   set -a; . /etc/iriss-ttr/env; set +a
//   IRISS_CANCEL_PROBE=1 node waybill-cancel-probe.mjs <wbr_id> [saving|filling]
//   systemctl start iriss-waybill-worker           # VIENMĒR pēc testa
// Rezultāts: pēdējā rinda JSON { pass, outcome, reason, ... }; exit 0 = PASS, 1 = FAIL, 2 = nav palaists.

import { execFileSync } from "node:child_process";
import { runCancelProbe, CANCEL_POINTS } from "./waybill-cancel-probe-core.mjs";

const API_BASE = (process.env.IRISS_API_BASE || "https://www.provin.lv").replace(/\/+$/, "");
const TOKEN = process.env.IRISS_AIVARS_API_TOKEN || "";
const WAIT_MS = 180_000;

function log(msg, extra = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));
}

function stop(reason) {
  log("probe_not_run", { reason });
  process.exit(2);
}

async function call(method, p, body) {
  const res = await fetch(`${API_BASE}/api/iriss/aivars/waybill-requests${p}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const [id, cancelAt = "saving"] = process.argv.slice(2);
if (process.env.IRISS_CANCEL_PROBE !== "1") stop("vajag IRISS_CANCEL_PROBE=1");
if (!TOKEN) stop("nav IRISS_AIVARS_API_TOKEN (ielādē /etc/iriss-ttr/env)");
if (!/^wbr_[A-Za-z0-9_-]+$/.test(id || "")) stop("pirmais arguments: pieprasījuma id (wbr_...)");
if (!CANCEL_POINTS.includes(cancelAt)) stop(`otrais arguments: ${CANCEL_POINTS.join(" / ")}`);
let workerState = "";
try {
  workerState = execFileSync("systemctl", ["is-active", "iriss-waybill-worker"], { encoding: "utf8" }).trim();
} catch (err) {
  workerState = String(err?.stdout || "").trim();
}
if (workerState === "active") stop("iriss-waybill-worker darbojas - vispirms systemctl stop iriss-waybill-worker");

const list = await call("GET", "?scope=auto&live=1");
if (list.status !== 200) stop(`pending_http_${list.status}`);
const job = (Array.isArray(list.data.requests) ? list.data.requests : []).find((r) => r.id === id);
if (!job) stop("pieprasījums nav rindā (jau paņemts, atcelts vai nav standarta)");

const waitForCancel = async () => {
  const until = Date.now() + WAIT_MS;
  while (Date.now() < until) {
    const r = await call("GET", `/${encodeURIComponent(id)}`).catch(() => null);
    if (r?.status === 200 && (r.data.cancelled === true || r.data.status === "cancelled")) return true;
    await new Promise((ok) => setTimeout(ok, 3_000));
  }
  return false;
};

const api = {
  async claim(jobId) {
    return (await call("POST", `/${encodeURIComponent(jobId)}/claim`, { worker: "auto" })).status === 200;
  },
  async event(jobId, body) {
    const r = await call("POST", `/${encodeURIComponent(jobId)}/events`, body);
    return typeof r.data?.status === "string" ? r.data.status : "";
  },
  async release(jobId, reason) {
    await call("POST", `/${encodeURIComponent(jobId)}/release`, { reason });
  },
};

log("probe_start", { id, cancelAt, plate: job.vehicle?.plate });
const res = await runCancelProbe(job, { api, waitForCancel, now: () => Date.now(), log }, cancelAt);
const after = await call("GET", `/${encodeURIComponent(id)}`).catch(() => null);
const final = { ...res, serverStatus: after?.data?.status || "", waybillNo: after?.data?.waybillNo || "" };
if (final.serverStatus !== "cancelled" || final.waybillNo) {
  final.pass = false;
  final.reason = [final.reason, `serverī status=${final.serverStatus} waybillNo=${final.waybillNo || "-"}`].filter(Boolean).join("; ");
}
// Testa darbu NEatdod Aivaram (viņš to izrakstītu pa īstam): ja nav atcelts, testētājs to atceļ IRISS ar roku.
if (final.serverStatus !== "cancelled") log("probe_cleanup", { hint: "Testa pieprasījumu IRISS atcel ar roku (Atcelt pieprasījumu)" });
console.log(JSON.stringify(final));
log("probe_done", { hint: "Tagad: systemctl start iriss-waybill-worker" });
process.exit(final.pass ? 0 : 1);
