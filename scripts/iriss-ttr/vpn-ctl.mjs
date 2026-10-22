#!/usr/bin/env node
// iriss-vpn-ctl: tur Hetzner CSDD VPN (systemd iriss-vpn) tikai tik ilgi, cik vajag darbiem.
// - 127.0.0.1:9334 (tikai lokāli): GET /status, POST /lease (ieslēgt + pagarināt), POST /stop.
// - Ik 10 s: Vercel GET /api/iriss/aivars/ttr (Aivara Bearer) -> admin "Man vajag VPN" -> stop uzreiz.
// - Idle autostop pēc IRISS_VPN_IDLE_MIN (15-30, nokl. 20) min kopš pēdējā darba.
// - Ja VPN nokrīt ārēji (Nils pieslēdzās ar to pašu kontu), serveris to neatjauno 30 min.
// Env (/etc/iriss-ttr/env, root 600): IRISS_API_BASE, IRISS_AIVARS_API_TOKEN, IRISS_VPN_IDLE_MIN.
// Nekad neizdrukā tokenu.

import { execFile } from "node:child_process";
import http from "node:http";
import { promisify } from "node:util";
import { canStartVpn, decideVpnAction, extendLease, vpnIdleMinutes } from "./vpn-lease.mjs";

const run = promisify(execFile);
const PORT = 9334;
const TICK_MS = 10_000;
const HEARTBEAT_MS = 5 * 60_000;
const VPN_UNIT = "iriss-vpn";
const TUN = "tun-iriss";
const API_BASE = (process.env.IRISS_API_BASE || "https://www.provin.lv").replace(/\/+$/, "");
const TOKEN = process.env.IRISS_AIVARS_API_TOKEN || "";
const IDLE_MIN = vpnIdleMinutes(process.env.IRISS_VPN_IDLE_MIN);

const state = {
  leaseUntilMs: NaN,
  handledStopAt: "",
  lastStopReason: "",
  lastManualStopMs: NaN,
  stoppingByUs: false,
  lastVpnUp: false,
  lastReportKey: "",
  lastReportMs: 0,
};

function log(msg, extra = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));
}

async function vpnUp() {
  try {
    const { stdout } = await run("systemctl", ["is-active", VPN_UNIT]);
    if (stdout.trim() !== "active") return false;
  } catch {
    return false;
  }
  try {
    await run("ip", ["link", "show", TUN]);
    return true;
  } catch {
    return false;
  }
}

async function stopVpn(reason) {
  state.stoppingByUs = true;
  try {
    await run("systemctl", ["stop", VPN_UNIT]);
  } catch (err) {
    log("vpn_stop_failed", { err: err instanceof Error ? err.message : "error" });
  }
  state.leaseUntilMs = NaN;
  state.lastStopReason = reason;
  if (reason === "manual") state.lastManualStopMs = Date.now();
  log("vpn_stopped", { reason });
}

async function startVpn() {
  const t0 = Date.now();
  await run("systemctl", ["start", VPN_UNIT]);
  for (let i = 0; i < 60; i++) {
    if (await vpnUp()) {
      log("vpn_up", { ms: Date.now() - t0 });
      return Date.now() - t0;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("vpn_up_timeout");
}

async function api(method, body) {
  const res = await fetch(`${API_BASE}/api/iriss/aivars/ttr`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`ttr_http_${res.status}`);
  return res.json();
}

async function report(up, force = false) {
  const body = {
    vpn: up ? "up" : "down",
    leaseUntil: Number.isFinite(state.leaseUntilMs) ? new Date(state.leaseUntilMs).toISOString() : "",
    handledStopAt: state.handledStopAt,
    lastStopReason: state.lastStopReason,
  };
  const key = JSON.stringify(body);
  const now = Date.now();
  if (!force && key === state.lastReportKey && now - state.lastReportMs < HEARTBEAT_MS) return;
  try {
    await api("POST", body);
    state.lastReportKey = key;
    state.lastReportMs = now;
  } catch (err) {
    log("report_failed", { err: err instanceof Error ? err.message : "error" });
  }
}

let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    let remote = { stopRequestedAt: "", handledStopAt: state.handledStopAt };
    try {
      remote = await api("GET");
      // Pēc restarta pārņem jau apstrādāto stop, lai vecs pieprasījums neatkārtojas.
      if (!state.handledStopAt && remote.handledStopAt) state.handledStopAt = remote.handledStopAt;
    } catch (err) {
      log("poll_failed", { err: err instanceof Error ? err.message : "error" });
    }
    let up = await vpnUp();
    if (state.lastVpnUp && !up && !state.stoppingByUs) {
      // Ārēja atslēgšana (Restart=no): visticamāk Nils pieslēdzās ar to pašu kontu.
      state.lastStopReason = "external";
      state.lastManualStopMs = Date.now();
      state.leaseUntilMs = NaN;
      log("vpn_dropped_external");
    }
    state.stoppingByUs = false;
    const decision = decideVpnAction({
      vpnUp: up,
      leaseUntilMs: state.leaseUntilMs,
      nowMs: Date.now(),
      stopRequestedAt: remote.stopRequestedAt,
      handledStopAt: state.handledStopAt,
    });
    if (decision.action === "stop") {
      state.handledStopAt = decision.handledStopAt;
      if (up || decision.reason === "manual") await stopVpn(decision.reason);
      up = await vpnUp();
      state.stoppingByUs = false;
    }
    state.lastVpnUp = up;
    await report(up);
  } finally {
    ticking = false;
  }
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function statusBody() {
  return {
    vpn: (await vpnUp()) ? "up" : "down",
    leaseUntil: Number.isFinite(state.leaseUntilMs) ? new Date(state.leaseUntilMs).toISOString() : "",
    idleMin: IDLE_MIN,
    lastStopReason: state.lastStopReason,
    blocked: !canStartVpn({ nowMs: Date.now(), lastManualStopMs: state.lastManualStopMs }),
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/status") return send(res, 200, await statusBody());
    if (req.method === "POST" && req.url === "/stop") {
      await stopVpn("manual");
      state.lastVpnUp = false;
      await report(false, true);
      return send(res, 200, await statusBody());
    }
    if (req.method === "POST" && req.url === "/lease") {
      if (!canStartVpn({ nowMs: Date.now(), lastManualStopMs: state.lastManualStopMs })) {
        return send(res, 409, { error: "vpn_blocked_manual", ...(await statusBody()) });
      }
      state.leaseUntilMs = extendLease(state.leaseUntilMs, Date.now(), IDLE_MIN);
      let upMs = 0;
      if (!(await vpnUp())) upMs = await startVpn();
      state.lastVpnUp = true;
      await report(true, true);
      return send(res, 200, { ...(await statusBody()), upMs });
    }
    return send(res, 404, { error: "not_found" });
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : "error" });
  }
});

if (!TOKEN) {
  log("missing_token_env");
  process.exit(2);
}
server.listen(PORT, "127.0.0.1", () => log("listening", { port: PORT, idleMin: IDLE_MIN }));
setInterval(() => void tick(), TICK_MS);
void tick();
