#!/usr/bin/env node
/**
 * PROVIN AutoDNA relejs (Hetzner): atskaites pirkums ar KREDĪTU fonā pēc Nila pogas adminā, kredītu atlikums,
 * jau nopirktu atskaišu PDF. Atsevišķs serviss: CSDD API 8787, mnt 8788, listings 8789, e.csdd 8790, LTAB 8791,
 * CarVertical 8792, šis 8793. AutoDNA partnera API šeit NETIEK lietots (tas ir pauzē) - tikai www.autodna.lv konts.
 *
 * PROVIN (Vercel) -> Caddy /autodna/* -> 127.0.0.1:8793 -> īsts Chrome (Xvfb :94), profils /var/lib/provin-autodna/profile.
 * Notikumus relejs sūta uz PROVIN_AUTODNA_CALLBACK_URL (Bearer tas pats AUTODNA_RELAY_TOKEN).
 *
 * Vide (/etc/provin-autodna.env, root 600):
 *   AUTODNA_RELAY_TOKEN              obligāts (>= 16); tas pats, kas Vercel AUTODNA_RELAY_TOKEN
 *   AUTODNA_WEB_EMAIL / _PASSWORD    www.autodna.lv konta pieteikšanās (1Password "Cowork Claude" / "www.autodna.lv").
 *                                    Nekad netiek logoti. (AUTODNA_EMAIL / AUTODNA_API_KEY ir partnera API - šeit nelieto.)
 *   AUTODNA_PURCHASE_LIVE            "1" = pirkuma poga tiek spiesta; citādi sausais režīms (viss pārbaudīts, bez klikšķa)
 *   PROVIN_AUTODNA_CALLBACK_URL      noklusējums https://www.provin.lv/api/autodna/relay-callback
 *   AUTODNA_RELAY_HOST/PORT          noklusējums 127.0.0.1 / 8793
 *   AUTODNA_DATA_DIR                 noklusējums /var/lib/provin-autodna
 *   AUTODNA_CHROME_CHANNEL           noklusējums chrome (ja nav, Playwright Chromium)
 *   AUTODNA_BALANCE_MIN              noklusējums 30 (atlikuma atjaunošana aktīvā sesijā)
 *   AUTODNA_IDLE_CLOSE_MIN           noklusējums 10 (bez darba Chrome tiek aizvērts - serverim 3,7 GB RAM)
 *   DISPLAY                          Xvfb (systemd): :94
 *
 * API (zem /autodna, prefiksu Caddy nenoņem):
 *   GET  /autodna/health          bez auth: dzīvs, vai pieteikšanās dati iestatīti (bez vērtībām), vai tiešais pirkums ieslēgts
 *   GET  /autodna/session         sesija + atlikuma kešs
 *   POST /autodna/login           Nila poga "Pieslēgt AutoDNA"
 *   GET  /autodna/balance         {credits, checkedAt} no keša; ja vecāks par 30 min - atjauno fonā
 *   POST /autodna/reports         "Manas atskaites" saraksts (tikai lasīšana)
 *   POST /autodna/precheck        {vin}: AutoDNA bezmaksas priekšpārbaude (arhīva foto / vēsture), bez pirkuma
 *   POST /autodna/probe           {vin}: pirkuma lapas pārbaude BEZ klikšķiem (galvenajam pirms AUTODNA_PURCHASE_LIVE=1)
 *   POST /autodna/purchase        {vin, ref, requestId, confirm:true} -> {jobId}; TIKAI ar confirm:true (Nila poga)
 *   POST /autodna/report          {vin, ref} -> {jobId}; jau nopirktas atskaites PDF, nekad nepērk
 *   POST /autodna/report-photos   {vin} -> arhīva foto jau nopirktai atskaitei (tikai lasīšana, nekad nepērk)
 *   GET  /autodna/jobs/:id        uzdevuma stāvoklis
 *   GET  /autodna/jobs/:id/pdf    saņemtais PDF (glabājas 48 h; PROVIN to paņem pēc "result" notikuma)
 *   POST /autodna/logout          kill switch: aizver pārlūku + izdzēš profilu
 */
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import { createAutodnaBrowser } from "./lib/dna-flow.mjs";
import { isAllowedHost, isForbiddenPath, isPaymentPath, isValidVin, normalizeVin, redact } from "./lib/dna-page.mjs";
import { createRelayCore, filePdfStore } from "./lib/relay-core.mjs";

const HOST = process.env.AUTODNA_RELAY_HOST || "127.0.0.1";
const PORT = Number(process.env.AUTODNA_RELAY_PORT || 8793);
const TOKEN = (process.env.AUTODNA_RELAY_TOKEN ?? "").trim();
const EMAIL = (process.env.AUTODNA_WEB_EMAIL ?? "").trim();
const PASSWORD = process.env.AUTODNA_WEB_PASSWORD ?? "";
const PURCHASE_LIVE = (process.env.AUTODNA_PURCHASE_LIVE ?? "").trim() === "1";
const CALLBACK_URL = (process.env.PROVIN_AUTODNA_CALLBACK_URL || "https://www.provin.lv/api/autodna/relay-callback").trim();
const DATA_DIR = process.env.AUTODNA_DATA_DIR || "/var/lib/provin-autodna";
const PROFILE_DIR = path.join(DATA_DIR, "profile");
const DEBUG_DIR = path.join(DATA_DIR, "debug");
const CHROME_CHANNEL = (process.env.AUTODNA_CHROME_CHANNEL ?? "chrome").trim();
const BALANCE_MIN = Math.max(5, Number(process.env.AUTODNA_BALANCE_MIN || 30));
const IDLE_CLOSE_MS = Math.max(2, Number(process.env.AUTODNA_IDLE_CLOSE_MIN || 10)) * 60_000;
const SECRETS = [TOKEN, EMAIL, PASSWORD];
const credentialsSet = () => EMAIL.includes("@") && PASSWORD.length >= 6;

if (TOKEN.length < 16) {
  console.error("AUTODNA_RELAY_TOKEN nav iestatīts vai par īsu (>= 16). Relejs nestartē.");
  process.exit(1);
}
if (!CALLBACK_URL.startsWith("https://")) {
  console.error("PROVIN_AUTODNA_CALLBACK_URL jābūt https. Relejs nestartē.");
  process.exit(1);
}

function log(msg) {
  console.log(`[autodna-relay] ${new Date().toISOString()} ${redact(msg, SECRETS)}`);
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
let browser = null;

/** Pieteikšanās sīkdatnes paliek pēc restarta / aizvēršanas, cilnes netiek atjaunotas. */
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
    // Atskaites PDF AutoDNA atdod kā lejupielādi (#report-link); fails tiek nolasīts un uzreiz dzēsts.
    acceptDownloads: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check", "--disable-dev-shm-usage"],
  };
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, { ...opts, ...(CHROME_CHANNEL ? { channel: CHROME_CHANNEL } : {}) });
  } catch {
    context = await chromium.launchPersistentContext(PROFILE_DIR, opts);
  }
  // Galvenā loga navigācija tikai uz autodna.lv; nekad uz pakām / bankām; /payment/* tikai kredītu apmaksas brīdī.
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
      const paymentBlocked = u && isPaymentPath(u.pathname) && !browser?.paymentArmed();
      if (!u || !isAllowedHost(u.hostname) || isForbiddenPath(u.pathname) || paymentBlocked) {
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

browser = createAutodnaBrowser({ getContext, email: EMAIL, password: PASSWORD, log, debugDir: DEBUG_DIR, secrets: [TOKEN], purchaseLive: PURCHASE_LIVE });
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
// Atlikums ik 30 min (tikai aktīvā sesijā; jaunu pieteikšanos nesāk). Ja Chrome aizvērts - netiek atvērts tikai atlikuma dēļ.
setInterval(() => {
  if (context) void core.refreshBalance();
}, BALANCE_MIN * 60_000).unref();
// Bez darba Chrome tiek aizvērts (sīkdatnes paliek profilā).
setInterval(() => {
  if (context && !pumping && core.idleMs() > IDLE_CLOSE_MS) {
    log("Chrome aizvērts (dīkstāve)");
    void closeContext();
  }
}, 60_000).unref();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const p = url.pathname.replace(/^\/autodna(?=\/|$)/, "") || "/";
  try {
    if (req.method === "GET" && p === "/health") {
      return sendJson(res, 200, { ok: true, credentialsSet: credentialsSet(), purchaseLive: PURCHASE_LIVE, session: core.session().state, browserOpen: Boolean(context), ...core.stats() });
    }
    if (!bearerOk(req)) return sendJson(res, 401, { error: "unauthorized" });
    if (!credentialsSet()) return sendJson(res, 503, { error: "not_configured" });

    if (req.method === "GET" && p === "/session") {
      return sendJson(res, 200, { session: core.session(), balance: core.balance(), purchaseLive: PURCHASE_LIVE, ...core.stats() });
    }
    if (req.method === "POST" && p === "/login") {
      const out = await core.login();
      if (out.ok) setTimeout(() => void pump(), 50);
      return sendJson(res, out.error === "busy" ? 409 : 200, out);
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
    if (req.method === "POST" && p === "/precheck") {
      const body = await readJson(req);
      return sendJson(res, 200, await core.precheck(body.vin));
    }
    if (req.method === "POST" && p === "/probe") {
      const body = await readJson(req);
      return sendJson(res, 200, await core.probe(body.vin));
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
  log(`klausās ${HOST}:${PORT}; pieteikšanās dati ${credentialsSet() ? "iestatīti" : "NAV iestatīti"}; tiešais pirkums ${PURCHASE_LIVE ? "IESLĒGTS" : "izslēgts (sausais režīms)"}`);
});
