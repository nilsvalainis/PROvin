#!/usr/bin/env node
/**
 * PROVIN Traficom relejs (Hetzner): Somijas publiskie transportlīdzekļa dati pēc VIN (asiointi.traficom.fi)
 * ar Suomi.fi eIDAS -> Latvijas VISS -> eParaksts Mobile (Nils apstiprina telefonā). Tikai bezmaksas dati.
 * Atsevišķs serviss no CSDD (8787), mnt.ee (8788), listings (8789), LTAB (8791).
 *
 * PROVIN (Vercel) -> Caddy /traficom/* -> 127.0.0.1:8794 -> īsts Chrome (Xvfb :93), profils /var/lib/provin-traficom/profile.
 * Rezultātus relejs sūta atpakaļ uz PROVIN_TRAFICOM_CALLBACK_URL (Bearer tas pats TRAFICOM_RELAY_TOKEN).
 *
 * Vide (/etc/provin-traficom.env, root 600):
 *   TRAFICOM_RELAY_TOKEN              obligāts (>= 16); tas pats, kas Vercel TRAFICOM_RELAY_TOKEN
 *   TRAFICOM_EPARAKSTS_USER_NUMBER    Nila eParaksts Mobile lietotāja numurs (iestata Nils). Nekad netiek logots.
 *   PROVIN_TRAFICOM_CALLBACK_URL      noklusējums https://www.provin.lv/api/traficom/relay-callback
 *   TRAFICOM_RELAY_HOST/PORT          noklusējums 127.0.0.1 / 8794
 *   TRAFICOM_DATA_DIR                 noklusējums /var/lib/provin-traficom
 *   TRAFICOM_MAX_PER_HOUR             noklusējums 30
 *   TRAFICOM_MIN_INTERVAL_SEC         noklusējums 30 (ne vairāk kā 1 vaicājums ik 30 s)
 *   TRAFICOM_CACHE_DAYS               noklusējums 7 (rezultāts pēc VIN)
 *   TRAFICOM_EPARAKSTS_TIMEOUT_SEC    noklusējums 300 (5 min apstiprinājumam telefonā)
 *   TRAFICOM_SESSION_TTL_MIN          noklusējums 20
 *   TRAFICOM_CHROME_CHANNEL           noklusējums chrome (ja nav, Playwright Chromium)
 *   DISPLAY                           Xvfb (systemd): :93
 * Nakts ierobežojuma nav (Nila likums 26.11 - strādā arī vakaros).
 *
 * API (zem /traficom, prefiksu Caddy nenoņem):
 *   GET  /traficom/health        bez auth: dzīvs, rinda, vai lietotāja numurs iestatīts (bez vērtības)
 *   POST /traficom/lookup        {vin, ref, trigger, force?, vehicleType?} -> {jobId, state: queued|running|cached}
 *   GET  /traficom/jobs/:id      uzdevuma stāvoklis
 *   GET  /traficom/session       sesijas stāvoklis (tikai nolasa, bez pieteikšanās)
 *   POST /traficom/session/browser-code  {code} - eParaksts pārlūka apstiprināšanas kods no lietotnes (4-8 burti/cipari),
 *                                kad sesija ir `awaiting_browser_code`; {renew:true} - pārlādēt lapu (jauns kods lietotnē).
 *                                "Send code via SMS" relejs nekad nespiež. Kods netiek logots.
 *   POST /traficom/logout        "Atbrīvot sesiju": aizver pārlūku, izdzēš Traficom / Suomi.fi / VISS sīkdatnes, bet
 *                                patur eParaksts pārlūka apstiprinājumu ({full:true} - izdzēš visu profilu, kill switch)
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import { createBrowserCodeBroker } from "./lib/browser-code.mjs";
import { createResultCache } from "./lib/cache.mjs";
import { createJobQueue } from "./lib/jobs.mjs";
import { createTraficomSessionState } from "./lib/session-state.mjs";
import { runTraficomLookup, TraficomFlowError } from "./lib/traficom-flow.mjs";
import { isAllowedHost, isEparakstsHost, isValidUserNumber, isValidVin, normalizeVin, redact } from "./lib/traficom-page.mjs";

const HOST = process.env.TRAFICOM_RELAY_HOST || "127.0.0.1";
const PORT = Number(process.env.TRAFICOM_RELAY_PORT || 8794);
const TOKEN = (process.env.TRAFICOM_RELAY_TOKEN ?? "").trim();
const USER_NUMBER = (process.env.TRAFICOM_EPARAKSTS_USER_NUMBER ?? "").trim();
const CALLBACK_URL = (process.env.PROVIN_TRAFICOM_CALLBACK_URL || "https://www.provin.lv/api/traficom/relay-callback").trim();
const DATA_DIR = process.env.TRAFICOM_DATA_DIR || "/var/lib/provin-traficom";
const PROFILE_DIR = path.join(DATA_DIR, "profile");
const DEBUG_DIR = path.join(DATA_DIR, "debug");
const MAX_PER_HOUR = Math.max(1, Number(process.env.TRAFICOM_MAX_PER_HOUR || 30));
const MIN_INTERVAL_MS = Math.max(30, Number(process.env.TRAFICOM_MIN_INTERVAL_SEC || 30)) * 1000;
const CACHE_TTL_MS = Math.max(1, Number(process.env.TRAFICOM_CACHE_DAYS || 7)) * 24 * 3_600_000;
const EPARAKSTS_TIMEOUT_MS = Math.max(60, Number(process.env.TRAFICOM_EPARAKSTS_TIMEOUT_SEC || 300)) * 1000;
const SESSION_TTL_MS = Math.max(1, Number(process.env.TRAFICOM_SESSION_TTL_MIN || 20)) * 60_000;
const CHROME_CHANNEL = (process.env.TRAFICOM_CHROME_CHANNEL ?? "chrome").trim();
const MAX_PDF_BYTES = 3 * 1024 * 1024;
const VEHICLE_TYPES = new Set(["car", "van", "motorcycle", "truck", "bus", "trailer"]);
const SECRETS = [USER_NUMBER, TOKEN];

if (TOKEN.length < 16) {
  console.error("TRAFICOM_RELAY_TOKEN nav iestatīts vai par īsu (>= 16). Relejs nestartē.");
  process.exit(1);
}
if (!CALLBACK_URL.startsWith("https://")) {
  console.error("PROVIN_TRAFICOM_CALLBACK_URL jābūt https. Relejs nestartē.");
  process.exit(1);
}

const session = createTraficomSessionState({ ttlMs: SESSION_TTL_MS });
const browserCode = createBrowserCodeBroker();
/** Ievadītie pārlūka kodi (tikai atmiņā, lai žurnālā tie nekad neparādītos). */
const transientSecrets = [];
const cache = createResultCache({ dir: path.join(DATA_DIR, "cache"), ttlMs: CACHE_TTL_MS });

function log(msg) {
  console.log(`[traficom-relay] ${new Date().toISOString()} ${redact(msg, [...SECRETS, ...transientSecrets])}`);
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
  // redirect: "error": pāradresācijā (provin.lv -> www) fetch atmestu Authorization un PROVIN atbildētu 401.
  const res = await fetch(CALLBACK_URL, {
    method: "POST",
    redirect: "error",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  // 409 = PROVIN jau gaida citu uzdevumu šim pasūtījumam; atkārtot nav jēgas.
  if (!res.ok && res.status !== 409) throw new Error(`PROVIN ${res.status}`);
}

let context = null;

/** Sesijas sīkdatnes paliek pēc restarta ("turpināt, kur beidzu"), cilnes neatjaunojam (kā LTAB relejam). */
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

async function openContext() {
  if (context) return context;
  await fs.mkdir(PROFILE_DIR, { recursive: true, mode: 0o700 });
  await keepSessionCookies(PROFILE_DIR);
  const opts = {
    headless: false,
    acceptDownloads: true,
    locale: "en-GB",
    timezoneId: "Europe/Riga",
    viewport: { width: 1366, height: 900 },
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check", "--disable-dev-shm-usage"],
  };
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, { ...opts, ...(CHROME_CHANNEL ? { channel: CHROME_CHANNEL } : {}) });
  } catch {
    context = await chromium.launchPersistentContext(PROFILE_DIR, opts);
  }
  // Galvenā loga navigācija tikai uz Traficom / Suomi.fi / VISS / eParaksts.
  await context.route("**/*", (route) => {
    const req = route.request();
    let mainNav = false;
    try {
      mainNav = req.isNavigationRequest() && req.frame() === req.frame().page().mainFrame();
    } catch {
      /* service worker */
    }
    if (mainNav) {
      let host = "";
      try {
        host = new URL(req.url()).hostname;
      } catch {
        /* nederīgs URL */
      }
      if (!isAllowedHost(host)) {
        log(`BLOĶĒTS: navigācija uz ${host || "?"}`);
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

/** Vai sīkdatne pieder eParaksts (tur glabājas "confirm this browser" apstiprinājums). */
function isEparakstsCookieDomain(domain) {
  return isEparakstsHost(String(domain ?? "").replace(/^\./, ""));
}

/**
 * "Atbrīvot sesiju" bez profila dzēšanas: izdzēš visas sīkdatnes, izņemot eParaksts (citādi nākamreiz atkal jāievada
 * pārlūka kods no lietotnes), un aizver pārlūku. Ja pārlūks nav atvērts, atver to uz brīdi.
 */
async function logoutKeepBrowserTrust() {
  const ctx = await openContext();
  const cookies = await ctx.cookies().catch(() => []);
  const keep = cookies.filter((c) => isEparakstsCookieDomain(c.domain));
  await ctx.clearCookies();
  if (keep.length) await ctx.addCookies(keep).catch((e) => log(`eParaksts sīkdatnes netika atjaunotas: ${e instanceof Error ? e.message : "?"}`));
  await closeContext();
  return { removed: cookies.length - keep.length, kept: keep.length };
}

async function runJob(job, onProgress) {
  // Kešs (7 d): tas pats VIN bez jauna eParaksts pieprasījuma, ja nav `force`.
  if (!job.force) {
    const hit = await cache.get(job.vin);
    if (hit) return { ...hit, cached: true };
  }
  if (!isValidUserNumber(USER_NUMBER)) throw new TraficomFlowError("not_configured");
  const ctx = await openContext();
  const page = await ctx.newPage();
  try {
    const result = await runTraficomLookup({
      page,
      vin: job.vin,
      userNumber: USER_NUMBER,
      vehicleType: job.vehicleType || "car",
      onProgress: (state, extra) => {
        session.onProgress(state, extra);
        return onProgress(state, extra);
      },
      log: (m) => log(`${job.jobId.slice(0, 8)} ${m}`),
      debugDir: DEBUG_DIR,
      eparakstsTimeoutMs: EPARAKSTS_TIMEOUT_MS,
      maxPdfBytes: MAX_PDF_BYTES,
      browserCode,
      onSecret: (v) => {
        transientSecrets.push(String(v));
        if (transientSecrets.length > 10) transientSecrets.shift();
      },
    });
    session.onSuccess();
    await cache.set(job.vin, result).catch((e) => log(`kešs netika saglabāts: ${e instanceof Error ? e.message : "?"}`));
    return result;
  } catch (e) {
    session.onError(e instanceof TraficomFlowError ? e.code : "error");
    if (e instanceof TraficomFlowError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new TraficomFlowError(/timeout|net::|ERR_/i.test(msg) ? "unavailable" : "error", redact(msg, SECRETS).slice(0, 200));
  } finally {
    await page.close().catch(() => undefined);
  }
}

const queue = createJobQueue({
  run: runJob,
  notify,
  log,
  maxPerHour: MAX_PER_HOUR,
  minIntervalMs: MIN_INTERVAL_MS,
  stateFile: path.join(DATA_DIR, "jobs.json"),
});
await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o750 }).catch(() => undefined);
await queue.load();

let ticking = false;
async function pump() {
  if (ticking) return;
  ticking = true;
  try {
    while (await queue.tick()) {
      /* nākamais */
    }
  } finally {
    ticking = false;
  }
  const wait = queue.waitMs();
  if (wait > 0 && queue.stats().queued > 0) setTimeout(() => void pump(), wait + 100).unref();
}
setInterval(() => void pump(), 15_000).unref();
setInterval(() => void cache.prune().catch(() => 0), 3_600_000).unref();

/** Kešots rezultāts: atbild uzreiz un sūta rezultātu PROVIN bez pārlūka un bez rindas intervāla. */
async function sendCached(ref, vin, hit) {
  const jobId = randomUUID();
  const body = {
    jobId,
    ref,
    vin,
    state: "result",
    at: new Date().toISOString(),
    found: Boolean(hit.found),
    cached: true,
    cachedAt: hit.cachedAt,
    ...(hit.rawText ? { rawText: hit.rawText } : {}),
    ...(hit.data ? { data: hit.data } : {}),
    ...(hit.pdf ? { pdfBase64: Buffer.from(hit.pdf).toString("base64") } : {}),
  };
  setTimeout(() => {
    notify(body).catch((e) => log(`PROVIN atzvans (kešs) neizdevās: ${e instanceof Error ? e.message : "?"}`));
  }, 1500);
  return jobId;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const p = url.pathname.replace(/^\/traficom(?=\/|$)/, "") || "/";
  try {
    if (req.method === "GET" && p === "/health") {
      return sendJson(res, 200, { ok: true, userNumberSet: isValidUserNumber(USER_NUMBER), ...queue.stats() });
    }
    if (!bearerOk(req)) return sendJson(res, 401, { error: "unauthorized" });

    if (req.method === "POST" && p === "/lookup") {
      const body = await readJson(req);
      const vin = normalizeVin(body.vin);
      const ref = String(body.ref ?? "").trim();
      if (!isValidVin(vin)) return sendJson(res, 400, { error: "invalid_vin" });
      if (!/^[A-Za-z0-9_-]{6,120}$/.test(ref)) return sendJson(res, 400, { error: "invalid_ref" });
      const force = body.force === true;
      const trigger = body.trigger === "manual" ? "manual" : "auto";
      if (!force) {
        const hit = await cache.get(vin);
        if (hit) {
          const jobId = await sendCached(ref, vin, hit);
          log(`kešs ${jobId.slice(0, 8)} ${vin.slice(-6)} (${trigger})`);
          return sendJson(res, 202, { jobId, state: "cached", cachedAt: hit.cachedAt });
        }
      }
      try {
        const vehicleType = VEHICLE_TYPES.has(body.vehicleType) ? body.vehicleType : "car";
        const out = queue.enqueue({ ref, vin, trigger, force, vehicleType });
        log(`rindā ${out.jobId.slice(0, 8)} ${vin.slice(-6)} (${trigger === "manual" ? "manuāli" : "auto"}, ${out.state})`);
        setTimeout(() => void pump(), 50);
        return sendJson(res, 202, out);
      } catch (e) {
        return sendJson(res, 503, { error: e?.code || "queue_error" });
      }
    }

    if (req.method === "GET" && p === "/session") {
      return sendJson(res, 200, { session: session.view(), userNumberSet: isValidUserNumber(USER_NUMBER), ...queue.stats() });
    }

    const jobMatch = p.match(/^\/jobs\/([a-f0-9-]{36})$/);
    if (req.method === "GET" && jobMatch) {
      const job = queue.get(jobMatch[1]);
      if (!job) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { jobId: job.jobId, state: job.state, code: job.code ?? null });
    }

    if (req.method === "POST" && p === "/session/browser-code") {
      const body = await readJson(req, 2_000).catch(() => null);
      if (!body || typeof body !== "object") return sendJson(res, 400, { error: "invalid_json" });
      if (!browserCode.isWaiting()) return sendJson(res, 409, { error: "not_waiting", session: session.view() });
      const out = body.renew === true ? browserCode.renew() : browserCode.submit(body.code);
      if (!out.ok) return sendJson(res, out.error === "invalid_code" ? 400 : 409, { error: out.error });
      log(body.renew === true ? "pārlūka kods: admins lūdz jaunu kodu" : "pārlūka kods saņemts no admina");
      return sendJson(res, 202, { ok: true, session: session.view() });
    }

    if (req.method === "POST" && p === "/logout") {
      const body = await readJson(req, 2_000).catch(() => ({}));
      if (body?.full === true) {
        await closeContext();
        await fs.rm(PROFILE_DIR, { recursive: true, force: true });
        log("profils izdzēsts (logout full)");
      } else {
        const out = await logoutKeepBrowserTrust();
        log(`logout: izdzēstas ${out.removed} sīkdatnes, eParaksts pārlūka apstiprinājums paturēts (${out.kept})`);
      }
      session.onLogout();
      return sendJson(res, 200, { ok: true, session: session.view() });
    }
    return sendJson(res, 404, { error: "not_found" });
  } catch (e) {
    log(`kļūda: ${e instanceof Error ? e.message : "?"}`);
    return sendJson(res, 500, { error: "internal" });
  }
});

/** Pareiza apstāšanās: Chrome paspēj ierakstīt sīkdatnes (arī eParaksts pārlūka apstiprinājumu) profilā. */
let stopping = false;
async function shutdown(sig) {
  if (stopping) return;
  stopping = true;
  log(`${sig}: aizver pārlūku`);
  server.close();
  await Promise.race([closeContext(), sleepMs(20_000)]);
  process.exit(0);
}
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

server.listen(PORT, HOST, () => {
  log(`klausās ${HOST}:${PORT}; lietotāja numurs ${isValidUserNumber(USER_NUMBER) ? "iestatīts" : "NAV iestatīts"}`);
  void pump();
});
