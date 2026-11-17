#!/usr/bin/env node
/**
 * PROVIN e.csdd relejs (Hetzner): e.csdd.lv `tadati` uzziņa (apskašu vēsture, nobraukums, reģistrācijas notikumi)
 * ar Nila Vienoto pieteikšanos (Smart-ID). Sesija tiek uzturēta serverī; Nils tikai apstiprina Smart-ID telefonā.
 * Atsevišķs serviss no CSDD API (8787), mnt.ee (8788), listings (8789), LTAB (8791). VPN (iriss-vpn) NEizmanto.
 *
 * PROVIN (Vercel) -> Caddy /ecsdd/* -> 127.0.0.1:8790 -> īsts Chrome (Xvfb :96), profils /var/lib/provin-ecsdd/profile.
 * Notikumus relejs sūta uz PROVIN_ECSDD_CALLBACK_URL (Bearer tas pats ECSDD_RELAY_TOKEN).
 *
 * Vide (/etc/provin-ecsdd.env, root 600):
 *   ECSDD_RELAY_TOKEN            obligāts (>= 16); tas pats, kas Vercel ECSDD_RELAY_TOKEN
 *   SMARTID_PERSONAL_CODE        Nila personas kods (ieraksta Nils no 1Password). Nekad netiek logots.
 *   PROVIN_ECSDD_CALLBACK_URL    noklusējums https://www.provin.lv/api/ecsdd/relay-callback
 *   ECSDD_RELAY_HOST/PORT        noklusējums 127.0.0.1 / 8790
 *   ECSDD_DATA_DIR               noklusējums /var/lib/provin-ecsdd
 *   ECSDD_MAX_PER_HOUR           noklusējums 20
 *   ECSDD_WORK_FROM/TO           noklusējums 8 / 20 (Rīga): ārpus tā automātika Smart-ID neprasa, keep-alive nav
 *   ECSDD_KEEPALIVE_MIN          noklusējums 4 (keep-alive intervāls)
 *   ECSDD_KEEPALIVE_IDLE_MIN     noklusējums 240 (bez uzziņām ilgāk - sesiju vairs neuztur)
 *   ECSDD_YIELD_MIN              noklusējums 60 (pēc izmešanas / "Atbrīvot" automātika pati nepiesakās)
 *   ECSDD_AUTO_LOGIN             noklusējums 1 (0 = Smart-ID tikai ar Nila pogu)
 *   ECSDD_SMARTID_TIMEOUT_SEC    noklusējums 120
 *   ECSDD_CHROME_CHANNEL         noklusējums chrome (ja nav, Playwright Chromium)
 *   DISPLAY                      Xvfb (systemd): :96
 *
 * API (zem /ecsdd, prefiksu Caddy nenoņem):
 *   GET  /ecsdd/health           bez auth: dzīvs, rinda, vai personas kods iestatīts (bez vērtības)
 *   GET  /ecsdd/session          sesijas stāvoklis (+ Smart-ID kods, ja gaida)
 *   POST /ecsdd/login            Nila poga: sākt Smart-ID pieteikšanos
 *   POST /ecsdd/release          {minutes}: iziet un nepieteikties (Nils strādā savā pārlūkā)
 *   POST /ecsdd/lookup           {query, ref, trigger} -> {jobId, session}
 *   GET  /ecsdd/jobs/:id         uzdevuma stāvoklis
 *   POST /ecsdd/logout           kill switch: iziet + izdzēš pārlūka profilu
 */
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import { createEcsddBrowser } from "./lib/ecsdd-flow.mjs";
import { isAllowedHost, isValidPersonalCode, isWorkHoursRiga, normalizeQuery, queryKind, redact } from "./lib/ecsdd-page.mjs";
import { createJobQueue } from "./lib/jobs.mjs";
import { createRelayCore } from "./lib/relay-core.mjs";
import { defaultSessionConfig } from "./lib/session.mjs";

const HOST = process.env.ECSDD_RELAY_HOST || "127.0.0.1";
const PORT = Number(process.env.ECSDD_RELAY_PORT || 8790);
const TOKEN = (process.env.ECSDD_RELAY_TOKEN ?? "").trim();
const PERSONAL_CODE = (process.env.SMARTID_PERSONAL_CODE ?? "").trim();
const CALLBACK_URL = (process.env.PROVIN_ECSDD_CALLBACK_URL || "https://www.provin.lv/api/ecsdd/relay-callback").trim();
const DATA_DIR = process.env.ECSDD_DATA_DIR || "/var/lib/provin-ecsdd";
const PROFILE_DIR = path.join(DATA_DIR, "profile");
const DEBUG_DIR = path.join(DATA_DIR, "debug");
const MAX_PER_HOUR = Math.max(1, Number(process.env.ECSDD_MAX_PER_HOUR || 20));
const SMARTID_TIMEOUT_MS = Math.max(30, Number(process.env.ECSDD_SMARTID_TIMEOUT_SEC || 120)) * 1000;
const CHROME_CHANNEL = (process.env.ECSDD_CHROME_CHANNEL ?? "chrome").trim();
const CFG = defaultSessionConfig(process.env);
const SECRETS = [PERSONAL_CODE, TOKEN];
const isWorkHours = (d) => isWorkHoursRiga(d, CFG.workFrom, CFG.workTo);

if (TOKEN.length < 16) {
  console.error("ECSDD_RELAY_TOKEN nav iestatīts vai par īsu (>= 16). Relejs nestartē.");
  process.exit(1);
}
if (!CALLBACK_URL.startsWith("https://")) {
  console.error("PROVIN_ECSDD_CALLBACK_URL jābūt https. Relejs nestartē.");
  process.exit(1);
}

function log(msg) {
  console.log(`[ecsdd-relay] ${new Date().toISOString()} ${redact(msg, SECRETS)}`);
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
    signal: AbortSignal.timeout(30_000),
  });
  // 409 = PROVIN jau gaida citu uzdevumu šim pasūtījumam; atkārtot nav jēgas.
  if (!res.ok && res.status !== 409) throw new Error(`PROVIN ${res.status}`);
}

let context = null;

async function getContext() {
  if (context) return context;
  if (!isValidPersonalCode(PERSONAL_CODE)) {
    const err = new Error("not_configured");
    err.code = "not_configured";
    throw err;
  }
  await fs.mkdir(PROFILE_DIR, { recursive: true, mode: 0o700 });
  const opts = {
    headless: false,
    locale: "lv-LV",
    timezoneId: "Europe/Riga",
    viewport: { width: 1366, height: 900 },
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check", "--disable-dev-shm-usage"],
  };
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, { ...opts, ...(CHROME_CHANNEL ? { channel: CHROME_CHANNEL } : {}) });
  } catch {
    context = await chromium.launchPersistentContext(PROFILE_DIR, opts);
  }
  // Galvenā loga navigācija tikai uz e.csdd / Vienoto pieteikšanos (resursus no CDN neaiztiek).
  await context.route("**/*", (route) => {
    const req = route.request();
    let mainNav = false;
    try {
      mainNav = req.isNavigationRequest() && req.frame() === req.frame().page().mainFrame();
    } catch {
      /* service worker pieprasījumam nav rāmja */
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

const browser = createEcsddBrowser({
  getContext,
  personalCode: PERSONAL_CODE,
  log,
  debugDir: DEBUG_DIR,
  smartIdTimeoutMs: SMARTID_TIMEOUT_MS,
});
const core = createRelayCore({
  queue: createJobQueue({ maxPerHour: MAX_PER_HOUR, stateFile: path.join(DATA_DIR, "jobs.json"), log }),
  browser,
  notify,
  cfg: CFG,
  isWorkHours,
  sessionFile: path.join(DATA_DIR, "session.json"),
  log,
});
await core.load();

let pumping = false;
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    for (let i = 0; i < 50 && (await core.tick()); i++) {
      /* nākamais */
    }
    await core.keepAliveTick();
  } catch (e) {
    log(`pump kļūda: ${e instanceof Error ? e.message : "?"}`);
  } finally {
    pumping = false;
  }
}
setInterval(() => void pump(), 20_000).unref();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const p = url.pathname.replace(/^\/ecsdd(?=\/|$)/, "") || "/";
  try {
    if (req.method === "GET" && p === "/health") {
      return sendJson(res, 200, { ok: true, personalCodeSet: isValidPersonalCode(PERSONAL_CODE), session: core.session().state, ...core.stats() });
    }
    if (!bearerOk(req)) return sendJson(res, 401, { error: "unauthorized" });

    if (req.method === "GET" && p === "/session") {
      return sendJson(res, 200, { session: core.session(), personalCodeSet: isValidPersonalCode(PERSONAL_CODE), ...core.stats() });
    }

    if (req.method === "POST" && p === "/login") {
      if (!isValidPersonalCode(PERSONAL_CODE)) return sendJson(res, 503, { error: "not_configured" });
      const session = core.requestLogin();
      setTimeout(() => void pump(), 50);
      return sendJson(res, 202, { session });
    }

    if (req.method === "POST" && p === "/release") {
      const body = await readJson(req);
      const minutes = Math.min(600, Math.max(5, Number(body.minutes) || CFG.yieldMin));
      return sendJson(res, 200, { session: await core.release(minutes) });
    }

    if (req.method === "POST" && p === "/lookup") {
      const body = await readJson(req);
      const query = normalizeQuery(body.query);
      const kind = queryKind(query);
      const ref = String(body.ref ?? "").trim();
      if (!kind) return sendJson(res, 400, { error: "invalid_query" });
      if (!/^[A-Za-z0-9_-]{6,120}$/.test(ref)) return sendJson(res, 400, { error: "invalid_ref" });
      try {
        const trigger = body.trigger === "manual" ? "manual" : "auto";
        const out = core.enqueue({ ref, query, kind, trigger });
        log(`rindā ${out.jobId.slice(0, 8)} ${kind} (${trigger === "manual" ? "Nila poga" : "auto"}${out.duplicate ? ", jau bija" : ""})`);
        setTimeout(() => void pump(), 50);
        return sendJson(res, 202, out);
      } catch (e) {
        return sendJson(res, 503, { error: e?.code || "queue_error" });
      }
    }

    const jobMatch = p.match(/^\/jobs\/([a-f0-9-]{36})$/);
    if (req.method === "GET" && jobMatch) {
      const job = core.getJob(jobMatch[1]);
      if (!job) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { jobId: job.jobId, state: job.state, kind: job.kind });
    }

    if (req.method === "POST" && p === "/logout") {
      await core.release(CFG.yieldMin);
      await closeContext();
      await fs.rm(PROFILE_DIR, { recursive: true, force: true });
      log("profils izdzēsts (logout)");
      return sendJson(res, 200, { ok: true, session: core.session() });
    }
    return sendJson(res, 404, { error: "not_found" });
  } catch (e) {
    log(`kļūda: ${e instanceof Error ? e.message : "?"}`);
    return sendJson(res, 500, { error: "internal" });
  }
});

server.listen(PORT, HOST, () => {
  log(`klausās ${HOST}:${PORT}; personas kods ${isValidPersonalCode(PERSONAL_CODE) ? "iestatīts" : "NAV iestatīts"}`);
  void pump();
});
