#!/usr/bin/env node
// iriss-vpn-ctl: Hetzner CSDD VPN (systemd iriss-vpn).
// - 127.0.0.1:9334 (tikai lokāli): GET /status, POST /lease (ieslēgt; body {"purpose":"waybill"} no worker), POST /release, POST /stop.
// - Ik 10 s: Vercel GET /api/iriss/aivars/ttr (Aivara Bearer) -> admin "Man vajag VPN" -> stop uzreiz.
// - HOLD (noklusējums, Nils 23.10): VPN tur pastāvīgi (bez idle), lai worker periodiski redz CSDD numuru stāvokli.
//   Atlaiž tikai: "Man vajag VPN" / POST /stop / vpnoff.sh, vai ja Nils izmet serveri (pieslēdzas pats). Tad serveris pats
//   NEPIESLĒDZAS (nekādas cilpas); nākamais pavadzīmes pieprasījums (/lease purpose waybill) pieslēdz un tur atkal.
//   Citi /lease (nakts reģistrs) pēc atslēgšanas/izmešanas gaida 30 min.
// - j13: hold tikai 08:00-19:00 Rīgas laikā. Naktī mūsu turēto VPN pēc lease beigām atslēdz ("night", bez 30 min bloķējuma);
//   pavadzīmes pieprasījums naktī strādā (pieslēdz, pēc darba /release ~1 min un atslēdz). Ārēji ieslēgtu VPN neaiztiek.
// - IRISS_VPN_HOLD=0: vecais režīms - idle autostop pēc IRISS_VPN_IDLE_MIN (15-30, nokl. 20) min, /release saīsina lease.
// - Aivara skripti (run.sh/run2.sh/vpnoff.sh, systemctl start/stop iriss-vpn) strādā kā līdz šim: ja tie VPN aptur,
//   tas skaitās ārēja atslēgšana (serveris pats nepieslēdzas).
// Env (/etc/iriss-ttr/env, root 600): IRISS_API_BASE, IRISS_AIVARS_API_TOKEN, IRISS_VPN_IDLE_MIN, IRISS_VPN_HOLD.
// Nekad neizdrukā tokenu.

import { execFile } from "node:child_process";
import http from "node:http";
import { promisify } from "node:util";
import {
  canStartVpn,
  decideVpnAction,
  extendLease,
  externalDropReason,
  releaseLease,
  vpnHoldMode,
  vpnIdleMinutes,
} from "./vpn-lease.mjs";
import { isCsddSyncWindow } from "./csdd-sync-schedule.mjs";

/** Nakts (19:00-08:00 Rīgas laikā): hold netiek turēts. */
const isNight = (ms = Date.now()) => !isCsddSyncWindow(ms);

const run = promisify(execFile);
const PORT = 9334;
const TICK_MS = 10_000;
const HEARTBEAT_MS = 5 * 60_000;
const VPN_UNIT = "iriss-vpn";
const TUN = "tun-iriss";
const API_BASE = (process.env.IRISS_API_BASE || "https://www.provin.lv").replace(/\/+$/, "");
const TOKEN = process.env.IRISS_AIVARS_API_TOKEN || "";
const IDLE_MIN = vpnIdleMinutes(process.env.IRISS_VPN_IDLE_MIN);
const HOLD = vpnHoldMode(process.env.IRISS_VPN_HOLD);

const state = {
  leaseUntilMs: NaN,
  handledStopAt: "",
  lastStopReason: "",
  lastManualStopMs: NaN,
  stoppingByUs: false,
  lastVpnUp: false,
  /** Hold režīmā: serveris tur VPN (pēc /lease); false pēc atslēgšanas/izmešanas līdz nākamajam /lease. */
  holding: false,
  lastDropAt: "",
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

/** systemd Result pēc VPN apstāšanās ("success" = kāds apturēja; cits = openconnect izgāja ar kļūdu). */
async function vpnResult() {
  try {
    const { stdout } = await run("systemctl", ["show", VPN_UNIT, "-p", "Result", "--value"]);
    return stdout.trim();
  } catch {
    return "";
  }
}

async function stopVpn(reason) {
  state.stoppingByUs = true;
  state.holding = false;
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
      // Ārēja atslēgšana (Restart=no): Nils pieslēdzās ar to pašu kontu (izmeta serveri) vai apturēja ar roku.
      // Serveris pats NEPIESLĒDZAS; nākamais pavadzīmes pieprasījums pieslēgs (hold) vai pēc 30 min (vecais režīms).
      state.lastStopReason = externalDropReason(await vpnResult());
      state.lastManualStopMs = Date.now();
      state.lastDropAt = new Date().toISOString();
      state.leaseUntilMs = NaN;
      state.holding = false;
      log("vpn_dropped_external", { reason: state.lastStopReason, hold: HOLD });
    }
    state.stoppingByUs = false;
    const decision = decideVpnAction({
      vpnUp: up,
      leaseUntilMs: state.leaseUntilMs,
      nowMs: Date.now(),
      stopRequestedAt: remote.stopRequestedAt,
      handledStopAt: state.handledStopAt,
      hold: HOLD,
      night: isNight(),
      holding: state.holding,
    });
    if (decision.action === "stop") {
      state.handledStopAt = decision.handledStopAt;
      if (up || decision.reason === "manual") await stopVpn(decision.reason);
      if (decision.reason === "night") log("vpn_night_release", {});
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
  const nowMs = Date.now();
  return {
    vpn: (await vpnUp()) ? "up" : "down",
    leaseUntil: Number.isFinite(state.leaseUntilMs) ? new Date(state.leaseUntilMs).toISOString() : "",
    idleMin: IDLE_MIN,
    hold: HOLD,
    holdNow: HOLD && !isNight(nowMs),
    holding: state.holding,
    lastStopReason: state.lastStopReason,
    lastDropAt: state.lastDropAt,
    // Vispārīgi /lease (nakts reģistrs): 30 min pēc atslēgšanas/izmešanas.
    blocked: !canStartVpn({ nowMs, lastManualStopMs: state.lastManualStopMs }),
    // Pavadzīmes pieprasījums: hold režīmā pieslēdz uzreiz (Nils 23.10).
    blockedForWaybill: !canStartVpn({ nowMs, lastManualStopMs: state.lastManualStopMs, purpose: "waybill", hold: HOLD }),
  };
}

/** POST ķermenis (neobligāts JSON, piem. {"purpose":"waybill"}). */
async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2048) break;
  }
  try {
    const o = JSON.parse(raw || "{}");
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
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
    if (req.method === "POST" && req.url === "/release") {
      // Worker darbs beidzies (finally). Hold režīmā VPN paliek; vecajā - lease ~1 min, tālāk tick atslēdz kā "idle".
      state.leaseUntilMs = releaseLease(state.leaseUntilMs, Date.now(), HOLD, isNight());
      log("lease_released", { leaseUntil: Number.isFinite(state.leaseUntilMs) ? new Date(state.leaseUntilMs).toISOString() : "" });
      await report(await vpnUp(), true);
      return send(res, 200, await statusBody());
    }
    if (req.method === "POST" && req.url === "/lease") {
      const body = await readBody(req);
      const purpose = body.purpose === "waybill" ? "waybill" : "";
      if (!canStartVpn({ nowMs: Date.now(), lastManualStopMs: state.lastManualStopMs, purpose, hold: HOLD })) {
        return send(res, 409, { error: "vpn_blocked_manual", ...(await statusBody()) });
      }
      state.leaseUntilMs = extendLease(state.leaseUntilMs, Date.now(), IDLE_MIN);
      let upMs = 0;
      if (!(await vpnUp())) {
        upMs = await startVpn();
        // Pavadzīmes pieprasījums pēc atslēgšanas/izmešanas: pieslēdzas un tur atkal (bloķējums vairs nav spēkā).
        if (purpose === "waybill") state.lastManualStopMs = NaN;
      }
      state.holding = HOLD;
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
server.listen(PORT, "127.0.0.1", () => log("listening", { port: PORT, idleMin: IDLE_MIN, hold: HOLD }));
// Pēc restarta: ja VPN jau ieslēgts (piem. pirms restarta turēts), hold režīmā turpina to turēt.
// Naktī ne: ārēji ieslēgtu VPN (Aivara run.sh) nedrīkst atslēgt kā "night".
void vpnUp().then((up) => {
  if (HOLD && up && !isNight()) state.holding = true;
});
setInterval(() => void tick(), TICK_MS);
void tick();
