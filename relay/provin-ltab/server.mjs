#!/usr/bin/env node
/**
 * PROVIN LTAB relejs (Hetzner): services.ltab.lv/VehicleInsAndAcc ar latvija.lv Smart-ID.
 * Atsevišķs serviss no CSDD (8787), mnt.ee (8788), listings (8789).
 *
 * PROVIN (Vercel) -> Caddy /ltab/* -> 127.0.0.1:8791 -> īsts Chrome (Xvfb :97), profils /var/lib/provin-ltab/profile.
 * Rezultātus relejs sūta atpakaļ uz PROVIN_LTAB_CALLBACK_URL (Bearer tas pats LTAB_RELAY_TOKEN).
 *
 * Vide (/etc/provin-ltab.env, root 600):
 *   LTAB_RELAY_TOKEN             obligāts (>= 16); tas pats, kas Vercel LTAB_RELAY_TOKEN
 *   SMARTID_PERSONAL_CODE        Nila personas kods (ieraksta Nils no 1Password). Nekad netiek logots.
 *   PROVIN_LTAB_CALLBACK_URL     noklusējums https://www.provin.lv/api/ltab/relay-callback
 *   LTAB_RELAY_HOST/PORT         noklusējums 127.0.0.1 / 8791
 *   LTAB_DATA_DIR                noklusējums /var/lib/provin-ltab
 *   LTAB_MAX_PER_HOUR            noklusējums 20
 *   LTAB_NIGHT_FROM / LTAB_NIGHT_TO  noklusējums 22 / 7 (Rīgas laiks; automātika naktī gaida)
 *   LTAB_SMARTID_TIMEOUT_SEC     noklusējums 120
 *   LTAB_CHROME_CHANNEL          noklusējums chrome (ja nav, Playwright Chromium)
 *   DISPLAY                      Xvfb (systemd): :97
 *
 * API (zem /ltab, prefiksu Caddy nenoņem):
 *   GET  /ltab/health        bez auth: dzīvs, rinda, vai personas kods iestatīts (bez vērtības)
 *   POST /ltab/lookup        {plate, ref, trigger}  -> {jobId, state: queued|deferred_night|running}
 *   GET  /ltab/jobs/:id      uzdevuma stāvoklis
 *   POST /ltab/logout        izdzēš pārlūka profilu (kill switch)
 */
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import { createJobQueue } from "./lib/jobs.mjs";
import { LtabFlowError, runLtabLookup } from "./lib/ltab-flow.mjs";
import { isAllowedHost, isNightInRiga, isValidPersonalCode, isValidPlate, normalizePlate, redact } from "./lib/ltab-page.mjs";

const HOST = process.env.LTAB_RELAY_HOST || "127.0.0.1";
const PORT = Number(process.env.LTAB_RELAY_PORT || 8791);
const TOKEN = (process.env.LTAB_RELAY_TOKEN ?? "").trim();
const PERSONAL_CODE = (process.env.SMARTID_PERSONAL_CODE ?? "").trim();
const CALLBACK_URL = (process.env.PROVIN_LTAB_CALLBACK_URL || "https://www.provin.lv/api/ltab/relay-callback").trim();
const DATA_DIR = process.env.LTAB_DATA_DIR || "/var/lib/provin-ltab";
const PROFILE_DIR = path.join(DATA_DIR, "profile");
const DEBUG_DIR = path.join(DATA_DIR, "debug");
const MAX_PER_HOUR = Math.max(1, Number(process.env.LTAB_MAX_PER_HOUR || 20));
const NIGHT_FROM = Number(process.env.LTAB_NIGHT_FROM || 22);
const NIGHT_TO = Number(process.env.LTAB_NIGHT_TO || 7);
const SMARTID_TIMEOUT_MS = Math.max(30, Number(process.env.LTAB_SMARTID_TIMEOUT_SEC || 120)) * 1000;
const CHROME_CHANNEL = (process.env.LTAB_CHROME_CHANNEL ?? "chrome").trim();
const MAX_PDF_BYTES = 3 * 1024 * 1024;
const SECRETS = [PERSONAL_CODE, TOKEN];

if (TOKEN.length < 16) {
  console.error("LTAB_RELAY_TOKEN nav iestatīts vai par īsu (>= 16). Relejs nestartē.");
  process.exit(1);
}
if (!CALLBACK_URL.startsWith("https://")) {
  console.error("PROVIN_LTAB_CALLBACK_URL jābūt https. Relejs nestartē.");
  process.exit(1);
}

function log(msg) {
  console.log(`[ltab-relay] ${new Date().toISOString()} ${redact(msg, SECRETS)}`);
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

async function openContext() {
  if (context) return context;
  await fs.mkdir(PROFILE_DIR, { recursive: true, mode: 0o700 });
  const opts = {
    headless: false,
    acceptDownloads: true,
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
  // Galvenā loga navigācija tikai uz LTAB / latvija.lv (resursus no CDN neaiztiek).
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

async function runJob(job, onProgress) {
  if (!isValidPersonalCode(PERSONAL_CODE)) throw new LtabFlowError("not_configured");
  const ctx = await openContext();
  const page = await ctx.newPage();
  try {
    return await runLtabLookup({
      page,
      plate: job.plate,
      personalCode: PERSONAL_CODE,
      onProgress,
      log: (m) => log(`${job.jobId.slice(0, 8)} ${m}`),
      debugDir: DEBUG_DIR,
      smartIdTimeoutMs: SMARTID_TIMEOUT_MS,
      maxPdfBytes: MAX_PDF_BYTES,
    });
  } catch (e) {
    if (e instanceof LtabFlowError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new LtabFlowError(/timeout|net::|ERR_/i.test(msg) ? "unavailable" : "error", redact(msg, SECRETS).slice(0, 200));
  } finally {
    await page.close().catch(() => undefined);
  }
}

const queue = createJobQueue({
  run: runJob,
  notify,
  log,
  isNight: (d) => isNightInRiga(d, NIGHT_FROM, NIGHT_TO),
  maxPerHour: MAX_PER_HOUR,
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
}
setInterval(() => void pump(), 30_000).unref();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const p = url.pathname.replace(/^\/ltab(?=\/|$)/, "") || "/";
  try {
    if (req.method === "GET" && p === "/health") {
      return sendJson(res, 200, { ok: true, personalCodeSet: isValidPersonalCode(PERSONAL_CODE), ...queue.stats(), night: isNightInRiga(new Date(), NIGHT_FROM, NIGHT_TO) });
    }
    if (!bearerOk(req)) return sendJson(res, 401, { error: "unauthorized" });

    if (req.method === "POST" && p === "/lookup") {
      const body = await readJson(req);
      const plate = normalizePlate(body.plate);
      const ref = String(body.ref ?? "").trim();
      if (!isValidPlate(plate)) return sendJson(res, 400, { error: "invalid_plate" });
      if (!/^[A-Za-z0-9_-]{6,120}$/.test(ref)) return sendJson(res, 400, { error: "invalid_ref" });
      try {
        const out = queue.enqueue({ ref, plate, trigger: body.trigger === "manual" ? "manual" : "auto" });
        log(`rindā ${out.jobId.slice(0, 8)} ${plate} (${body.trigger === "manual" ? "manuāli" : "auto"}, ${out.state})`);
        setTimeout(() => void pump(), 50);
        return sendJson(res, 202, out);
      } catch (e) {
        return sendJson(res, 503, { error: e?.code || "queue_error" });
      }
    }

    const jobMatch = p.match(/^\/jobs\/([a-f0-9-]{36})$/);
    if (req.method === "GET" && jobMatch) {
      const job = queue.get(jobMatch[1]);
      if (!job) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { jobId: job.jobId, state: job.state, plate: job.plate, code: job.code ?? null });
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
    return sendJson(res, 500, { error: "internal" });
  }
});

server.listen(PORT, HOST, () => {
  log(`klausās ${HOST}:${PORT}; personas kods ${isValidPersonalCode(PERSONAL_CODE) ? "iestatīts" : "NAV iestatīts"}`);
  void pump();
});
