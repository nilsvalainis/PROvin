#!/usr/bin/env node
/**
 * PROVIN CarVertical relejs (Hetzner): atskaites pirkums ar KREDĪTU fonā pēc Nila pogas adminā, kredītu atlikums,
 * jau nopirktu atskaišu PDF. Atsevišķs serviss: CSDD API 8787, mnt 8788, listings 8789, e.csdd 8790, LTAB 8791, šis 8792.
 *
 * PROVIN (Vercel) -> Caddy /carvertical/* -> 127.0.0.1:8792 -> īsts Chrome (Xvfb :95), profils /var/lib/provin-carvertical/profile.
 * Notikumus relejs sūta uz PROVIN_CARVERTICAL_CALLBACK_URL (Bearer tas pats CARVERTICAL_RELAY_TOKEN).
 *
 * Vide (/etc/provin-carvertical.env, root 600):
 *   CARVERTICAL_RELAY_TOKEN          obligāts (>= 16); tas pats, kas Vercel CARVERTICAL_RELAY_TOKEN
 *   CARVERTICAL_EMAIL / _PASSWORD    CarVertical konta pieteikšanās (1Password "Cowork Claude" / "Carvertical"). Nekad netiek logoti.
 *   PROVIN_CARVERTICAL_CALLBACK_URL  noklusējums https://www.provin.lv/api/carvertical/relay-callback
 *   CARVERTICAL_RELAY_HOST/PORT      noklusējums 127.0.0.1 / 8792
 *   CARVERTICAL_DATA_DIR             noklusējums /var/lib/provin-carvertical
 *   CARVERTICAL_CHROME_CHANNEL       noklusējums chrome (ja nav, Playwright Chromium)
 *   CARVERTICAL_BALANCE_MIN          noklusējums 30 (atlikuma atjaunošana aktīvā sesijā)
 *   DISPLAY                          Xvfb (systemd): :95
 *
 * API (zem /carvertical, prefiksu Caddy nenoņem):
 *   GET  /carvertical/health          bez auth: dzīvs, vai pieteikšanās dati iestatīti (bez vērtībām)
 *   GET  /carvertical/session         sesija + atlikuma kešs
 *   POST /carvertical/login           Nila poga: sākt pieteikšanos (CarVertical sūta kodu uz konta e-pastu)
 *   POST /carvertical/login/code      {code}: Nila ievadītais 6 rakstzīmju kods; {code, source:"email", receivedAt}: kods no
 *                                     konta e-pasta (Apps Script -> PROVIN /api/carvertical/login-code) - tikai ja relejs gaida
 *                                     kodu un vēstule pienākusi pēc pieteikšanās sākuma. Push Nilam tikai pēc 10 min bez koda.
 *   GET  /carvertical/balance         {credits, checkedAt} no keša; ja vecāks par 30 min - atjauno fonā
 *   POST /carvertical/reports         "Manas atskaites" saraksts (tikai lasīšana)
 *   POST /carvertical/purchase        {vin, ref, requestId, confirm:true} -> {jobId}; TIKAI ar confirm:true (Nila poga)
 *   POST /carvertical/report          {vin, ref} -> {jobId}; jau nopirktas atskaites PDF, nekad nepērk
 *   POST /carvertical/report-photos   {vin} -> arhīva foto jau nopirktai atskaitei (tikai lasīšana, nekad nepērk)
 *   GET  /carvertical/jobs/:id        uzdevuma stāvoklis
 *   GET  /carvertical/jobs/:id/pdf    saņemtais PDF (glabājas 48 h; PROVIN to paņem pēc "result" notikuma)
 *   POST /carvertical/logout          kill switch: aizver pārlūku + izdzēš profilu
 */
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import { createCarverticalBrowser } from "./lib/cv-flow.mjs";
import { isAllowedHost, isForbiddenPath, isValidVin, normalizeVin, redact } from "./lib/cv-page.mjs";
import { createRelayCore, filePdfStore } from "./lib/relay-core.mjs";

const HOST = process.env.CARVERTICAL_RELAY_HOST || "127.0.0.1";
const PORT = Number(process.env.CARVERTICAL_RELAY_PORT || 8792);
const TOKEN = (process.env.CARVERTICAL_RELAY_TOKEN ?? "").trim();
const EMAIL = (process.env.CARVERTICAL_EMAIL ?? "").trim();
const PASSWORD = process.env.CARVERTICAL_PASSWORD ?? "";
const CALLBACK_URL = (process.env.PROVIN_CARVERTICAL_CALLBACK_URL || "https://www.provin.lv/api/carvertical/relay-callback").trim();
const DATA_DIR = process.env.CARVERTICAL_DATA_DIR || "/var/lib/provin-carvertical";
const PROFILE_DIR = path.join(DATA_DIR, "profile");
const DEBUG_DIR = path.join(DATA_DIR, "debug");
const CHROME_CHANNEL = (process.env.CARVERTICAL_CHROME_CHANNEL ?? "chrome").trim();
const BALANCE_MIN = Math.max(5, Number(process.env.CARVERTICAL_BALANCE_MIN || 30));
const SECRETS = [TOKEN, EMAIL, PASSWORD];
const credentialsSet = () => EMAIL.includes("@") && PASSWORD.length >= 6;

if (TOKEN.length < 16) {
  console.error("CARVERTICAL_RELAY_TOKEN nav iestatīts vai par īsu (>= 16). Relejs nestartē.");
  process.exit(1);
}
if (!CALLBACK_URL.startsWith("https://")) {
  console.error("PROVIN_CARVERTICAL_CALLBACK_URL jābūt https. Relejs nestartē.");
  process.exit(1);
}

function log(msg) {
  console.log(`[carvertical-relay] ${new Date().toISOString()} ${redact(msg, SECRETS)}`);
}

function bearerOk(req) {
  const header = req.headers.authorization ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (given.length !== TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < TOKEN.length; i++) diff |= given.charCodeAt(i) ^ TOKEN.charCodeAt(i);
  return diff === 0;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req, limitBytes = 16_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new Error("body par lielu");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

async function notify(body) {
  // redirect: "error": pāradresācijā fetch atmestu Authorization un PROVIN atbildētu 401.
  const res = await fetch(CALLBACK_URL, {
    method: "POST",
    redirect: "error",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok && res.status !== 409) throw new Error(`PROVIN ${res.status}`);
}

let context = null;

/** Pieteikšanās sīkdatnes paliek pēc restarta ("turpināt, kur beidzu"), cilnes netiek atjaunotas. */
async function keepSessionCookies(profileDir) {
  const def = path.join(profileDir, "Default");
  const prefsFile = path.join(def, "Preferences");
  try {
    await fs.mkdir(def, { recursive: true, mode: 0o700 });
    let prefs = {};
    try {
      prefs = JSON.parse(await fs.readFile(prefsFile, "utf8"));
    } catch {
      /* jauns profils */
    }
    prefs.session = { ...(prefs.session ?? {}), restore_on_startup: 1 };
    prefs.profile = { ...(prefs.profile ?? {}), exit_type: "Normal", exited_cleanly: true };
    await fs.writeFile(prefsFile, JSON.stringify(prefs), { mode: 0o600 });
    await fs.rm(path.join(def, "Sessions"), { recursive: true, force: true });
  } catch (e) {
    log(`profila iestatījumi: ${e instanceof Error ? e.message : e}`);
  }
}

async function getContext() {
  if (context) return context;
  if (!credentialsSet()) {
    const err = new Error("not_configured");
    err.code = "not_configured";
    throw err;
  }
  await fs.mkdir(PROFILE_DIR, { recursive: true, mode: 0o700 });
  await keepSessionCookies(PROFILE_DIR);
  const opts = {
    headless: false,
    locale: "lv-LV",
    timezoneId: "Europe/Riga",
    viewport: { width: 1366, height: 900 },
    acceptDownloads: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check", "--disable-dev-shm-usage"],
  };
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, { ...opts, ...(CHROME_CHANNEL ? { channel: CHROME_CHANNEL } : {}) });
  } catch {
    context = await chromium.launchPersistentContext(PROFILE_DIR, opts);
  }
  // Galvenā loga navigācija tikai uz carvertical.com un nekad uz checkout / pricing / billing.
  await context.route("**/*", (route) => {
    const req = route.request();
    let mainNav = false;
    try {
      mainNav = req.isNavigationRequest() && req.frame() === req.frame().page().mainFrame();
    } catch {
      /* service worker */
    }
    if (mainNav) {
      let u = null;
      try {
        u = new URL(req.url());
      } catch {
        /* nederīgs */
      }
      if (!u || !isAllowedHost(u.hostname) || isForbiddenPath(u.pathname)) {
        log(`BLOĶĒTS: navigācija uz ${u ? `${u.hostname}${u.pathname}` : "?"}`);
        return route.abort("blockedbyclient");
      }
    }
    return route.continue();
  });
  for (const p of context.pages().slice(1)) await p.close().catch(() => undefined);
  context.on("close", () => {
    context = null;
  });
  return context;
}

async function closeContext() {
  const c = context;
  context = null;
  if (c) await c.close().catch(() => undefined);
}

await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o750 }).catch(() => undefined);

const browser = createCarverticalBrowser({ getContext, email: EMAIL, password: PASSWORD, log, debugDir: DEBUG_DIR, secrets: [TOKEN] });
const core = createRelayCore({
  browser,
  notify,
  stateFile: path.join(DATA_DIR, "state.json"),
  log,
  balanceTtlMs: BALANCE_MIN * 60_000,
  pdfStore: filePdfStore(path.join(DATA_DIR, "pdf")),
});
await core.load();

let pumping = false;
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    for (let i = 0; i < 10 && (await core.tick()); i++) {
      /* nākamais */
    }
  } catch (e) {
    log(`pump kļūda: ${e instanceof Error ? e.message : "?"}`);
  } finally {
    pumping = false;
  }
}
setInterval(() => void pump(), 20_000).unref();
// Atlikums ik 30 min (tikai aktīvā sesijā; jaunu pieteikšanos/kodu nesāk).
setInterval(() => void core.refreshBalance(), BALANCE_MIN * 60_000).unref();
// Kods no e-pasta neatnāca 10 min laikā -> viens push Nilam "ievadi kodu".
setInterval(() => void core.checkCodeReminder().catch(() => undefined), 30_000).unref();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const p = url.pathname.replace(/^\/carvertical(?=\/|$)/, "") || "/";
  try {
    if (req.method === "GET" && p === "/health") {
      return sendJson(res, 200, { ok: true, credentialsSet: credentialsSet(), session: core.session().state, ...core.stats() });
    }
    if (!bearerOk(req)) return sendJson(res, 401, { error: "unauthorized" });
    if (!credentialsSet()) return sendJson(res, 503, { error: "not_configured" });

    if (req.method === "GET" && p === "/session") {
      return sendJson(res, 200, { session: core.session(), balance: core.balance(), ...core.stats() });
    }
    if (req.method === "POST" && p === "/login") {
      const out = await core.login();
      return sendJson(res, out.ok ? 200 : 409, out);
    }
    if (req.method === "POST" && p === "/login/code") {
      const body = await readJson(req);
      // source "email": kods no konta e-pasta (Apps Script -> PROVIN); relejs to ņem tikai, ja gaida kodu un vēstule ir jaunāka.
      const source = body.source === "email" ? "email" : "";
      const out = await core.submitCode(body.code, { source, receivedAt: typeof body.receivedAt === "string" ? body.receivedAt : "" });
      if (source === "email") log(`kods no e-pasta: ${out.ok ? "pieņemts" : out.error || out.session?.code || "nav pieņemts"}`);
      if (out.ok) setTimeout(() => void pump(), 50);
      return sendJson(res, out.error === "invalid_code" ? 400 : 200, out);
    }
    if (req.method === "GET" && p === "/balance") {
      const force = url.searchParams.get("refresh") === "1";
      const cached = core.balance();
      void core.refreshBalance({ force });
      return sendJson(res, 200, { balance: cached, session: core.session() });
    }
    if (req.method === "POST" && p === "/reports") {
      return sendJson(res, 200, await core.listReports());
    }
    if (req.method === "POST" && p === "/report-photos") {
      const body = await readJson(req);
      const out = await core.reportPhotos(body.vin);
      const status = out.status === "ok" || out.status === "no_photos" ? 200 : out.status === "busy" ? 409 : out.status === "invalid_vin" ? 400 : out.status === "not_found" ? 404 : out.status === "needs_login" ? 409 : 502;
      return sendJson(res, status, out);
    }
    if (req.method === "POST" && (p === "/purchase" || p === "/report")) {
      const body = await readJson(req);
      const vin = normalizeVin(body.vin);
      const ref = String(body.ref ?? "").trim();
      if (!isValidVin(vin)) return sendJson(res, 400, { error: "invalid_vin" });
      if (!/^[A-Za-z0-9_-]{6,120}$/.test(ref)) return sendJson(res, 400, { error: "invalid_ref" });
      const kind = p === "/purchase" ? "purchase" : "report";
      // Maksas pirkums tikai ar skaidru operatora apstiprinājumu (admin poga + dialogs).
      if (kind === "purchase" && body.confirm !== true) return sendJson(res, 403, { error: "missing_confirm" });
      const requestId = typeof body.requestId === "string" ? body.requestId.slice(0, 80) : "";
      const out = core.enqueue({ ref, vin, kind, requestId });
      log(`rindā ${out.jobId.slice(0, 8)} ${kind}${out.duplicate ? " (jau bija)" : ""}`);
      setTimeout(() => void pump(), 50);
      return sendJson(res, 202, out);
    }
    const pdfMatch = p.match(/^\/jobs\/([a-f0-9-]{36})\/pdf$/);
    if (req.method === "GET" && pdfMatch) {
      const buf = await core.readPdf(pdfMatch[1]);
      if (!buf) return sendJson(res, 404, { error: "not_found" });
      res.writeHead(200, { "content-type": "application/pdf", "content-length": String(buf.length), "cache-control": "no-store" });
      return res.end(buf);
    }
    const jobMatch = p.match(/^\/jobs\/([a-f0-9-]{36})$/);
    if (req.method === "GET" && jobMatch) {
      const job = core.getJob(jobMatch[1]);
      if (!job) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { jobId: job.jobId, state: job.state, kind: job.kind });
    }
    if (req.method === "POST" && p === "/logout") {
      await closeContext();
      await fs.rm(PROFILE_DIR, { recursive: true, force: true });
      log("profils izdzēsts (logout)");
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { error: "not_found" });
  } catch (e) {
    log(`kļūda: ${e instanceof Error ? e.message : "?"}`);
    return sendJson(res, 500, { error: e?.code || "internal" });
  }
});

server.listen(PORT, HOST, () => {
  log(`klausās ${HOST}:${PORT}; pieteikšanās dati ${credentialsSet() ? "iestatīti" : "NAV iestatīti"}`);
});
