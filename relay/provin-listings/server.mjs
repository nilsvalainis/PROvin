#!/usr/bin/env node
/**
 * PROVIN IRISS LIST pārlūka relejs (Hetzner). Atsevišķs serviss no CSDD (8787) un mnt.ee (8788).
 *
 * PROVIN (Vercel) -> Caddy /listings/* -> šis serviss 127.0.0.1:8789 -> īsts Chrome (Xvfb) ar
 * pastāvīgiem profiliem /var/lib/provin-listings/profiles/{openlane,auto1,autobid}.
 *
 * Vide (/etc/provin-listings.env, root 600):
 *   LISTINGS_RELAY_TOKEN        obligāts; tas pats, kas Vercel IRISS_LISTINGS_RELAY_TOKEN
 *   LISTINGS_RELAY_HOST/PORT    noklusējums 127.0.0.1 / 8789
 *   LISTINGS_PROFILES_DIR       noklusējums /var/lib/provin-listings/profiles
 *   LISTINGS_STATE_FILE         noklusējums /var/lib/provin-listings/state.json
 *   LISTINGS_MAX_PAGES          noklusējums 5 (lapas vienam avotam)
 *   LISTINGS_MAX_FETCHES_PER_DAY noklusējums 150 uz platformu (1 pilna diena + Nolasīt tagad)
 *   LISTINGS_MAX_QUEUE          noklusējums 40 (garāka rinda -> 503)
 *   LISTINGS_MANUAL_LOGIN_MINUTES noklusējums 15
 *   OPENLANE_USER / OPENLANE_PASS, AUTOBID_USER / AUTOBID_PASS   auto-login; Auto1 tikai manuāli
 *   OPENLANE_ALLOW_PUBLIC_FALLBACK=1  lasīt Openlane arī bez login (daļējas cenas)
 *   DISPLAY                     Xvfb displejs (systemd): :98, jo :99 jau lieto provin-mnt
 *
 * API (viss zem /listings, prefiksu Caddy nenoņem):
 *   GET  /listings/health                 bez auth: sesiju stāvoklis, rinda, dienas skaitītāji
 *   POST /listings/fetch                  {platform, sourceUrl, orderId, maxPages?}
 *   POST /listings/session/check          {platform}
 *   POST /listings/login/:platform        atver redzamu Chrome + īslaicīgs noVNC tokens adminam
 *   POST /listings/login/:platform/close  aizver manuālo login un pārbauda sesiju
 *   GET  /listings/vnc/:token/...         noVNC (tokens ceļā, bez Bearer; tikai kamēr login atvērts)
 */
import { createServer } from "node:http";

import { browserQueue, hasCaptchaOrChallenge, openProfile, profileExists, randomPause } from "./lib/browser.mjs";
import {
  createVncToken,
  ensureNovnc,
  parseVncRequestPath,
  proxyVncHttp,
  proxyVncUpgrade,
  stopNovncIfStarted,
  tokensEqual,
  vncViewerPath,
} from "./lib/novnc.mjs";
import { shouldReadPublic } from "./lib/policy.mjs";
import { auto1 } from "./lib/platforms/auto1.mjs";
import { autobid } from "./lib/platforms/autobid.mjs";
import { openlane } from "./lib/platforms/openlane.mjs";
import { sanitizeAutobidRelayRaw } from "./lib/sanitize-autobid.mjs";
import { PLATFORMS, RelayState } from "./lib/state.mjs";

const HOST = process.env.LISTINGS_RELAY_HOST || "127.0.0.1";
const PORT = Number(process.env.LISTINGS_RELAY_PORT || 8789);
const TOKEN = (process.env.LISTINGS_RELAY_TOKEN ?? "").trim();
const STATE_FILE = process.env.LISTINGS_STATE_FILE || "/var/lib/provin-listings/state.json";
const MAX_PAGES = Math.max(1, Number(process.env.LISTINGS_MAX_PAGES || 5));
const MAX_FETCHES_PER_DAY = Math.max(1, Number(process.env.LISTINGS_MAX_FETCHES_PER_DAY || 150));
const MAX_QUEUE = Math.max(1, Number(process.env.LISTINGS_MAX_QUEUE || 40));
const MANUAL_LOGIN_MINUTES = Math.max(1, Number(process.env.LISTINGS_MANUAL_LOGIN_MINUTES || 15));
const OPENLANE_PUBLIC_FALLBACK = /^(1|true|yes)$/i.test(process.env.OPENLANE_ALLOW_PUBLIC_FALLBACK ?? "");

if (!TOKEN || TOKEN.length < 16) {
  console.error("LISTINGS_RELAY_TOKEN nav iestatīts vai par īsu (>= 16). Relejs nestartē.");
  process.exit(1);
}

const platforms = { openlane, auto1, autobid };
const state = new RelayState(STATE_FILE);
await state.load();

const manual = { platform: "", startedAt: "", vncToken: "", vncReady: false, close: null, finished: null };

function log(msg) {
  console.log(`[listings-relay] ${new Date().toISOString()} ${msg}`);
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

async function readJson(req, limitBytes = 256_000) {
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

function stripPrefix(pathname) {
  return pathname.replace(/^\/listings(?=\/|$)/, "") || "/";
}

function validSourceUrl(raw, platform) {
  try {
    const u = new URL(String(raw));
    if (u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    const allowed = { openlane: /(^|\.)openlane\.(eu|com)$/, auto1: /(^|\.)auto1\.(com|eu)$/, autobid: /(^|\.)autobid\.(de|eu)$/ }[platform];
    return allowed && allowed.test(host) ? u.toString() : "";
  } catch {
    return "";
  }
}

/** Sesijas pārbaude + auto-login (ja ir paroles). Atgriež {status: ok|login_required|blocked|error, note}. */
async function ensureSession(platform, page) {
  const p = platforms[platform];
  try {
    await page.goto(p.probeUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await randomPause(1_000, 2_000);
    const challenge = await hasCaptchaOrChallenge(page);
    if (challenge === "cloudflare_challenge") {
      await randomPause(6_000, 9_000);
      if ((await hasCaptchaOrChallenge(page)) === "cloudflare_challenge") {
        state.setSession(platform, "unknown", "Cloudflare challenge nepāriet.");
        return { status: "blocked", note: `${p.label}: Cloudflare challenge nepāriet arī īstā pārlūkā.` };
      }
    }
    if (await p.isLoggedIn(page)) {
      state.setSession(platform, "ok");
      return { status: "ok", note: "session_ok" };
    }
    if (!p.hasCredentials()) {
      state.setSession(platform, "login_required", `${p.label}: sesija beigusies, nav auto-login.`);
      return { status: "login_required", note: `${p.label}: sesija beigusies, jāielogojas no jauna (noVNC).` };
    }
    log(`${platform}: sesija beigusies, mēģinu auto-login`);
    const r = await p.login(page);
    state.setLogin(platform, r.note);
    if (r.ok) {
      state.setSession(platform, "ok");
      return { status: "ok", note: r.note };
    }
    state.setSession(platform, "login_required", r.note);
    return { status: r.status, note: r.note };
  } catch (e) {
    const note = e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "nezināma kļūda";
    state.setSession(platform, "unknown", note);
    return { status: "error", note };
  }
}

async function runFetch({ platform, sourceUrl, orderId, maxPages }) {
  const started = Date.now();
  const p = platforms[platform];
  const { page, close } = await openProfile(platform);
  try {
    const session = await ensureSession(platform, page);
    /** Autobid publiskie dati ir bāze (tos lasa arī Vercel), Openlane pēc izvēles; Auto1 bez login nav nekā. */
    const publicFallback = shouldReadPublic(platform, session.status, OPENLANE_PUBLIC_FALLBACK);
    if (session.status !== "ok" && !publicFallback) {
      state.setFetch(platform, session.status, session.note);
      return { ok: false, status: session.status, note: session.note, items: [], raw: null, pagesFetched: 0, pageCount: 0, orderId, elapsedMs: Date.now() - started };
    }
    await randomPause(800, 1_800);
    const r = await p.fetchSource(page, sourceUrl, { maxPages, log, state });
    if (publicFallback && r.status === "ok") {
      r.note = `${session.note} ${r.note}`.trim();
      state.setFetch(platform, "ok", session.note);
    } else {
      state.setFetch(platform, r.status, r.status === "ok" ? "" : r.note);
    }
    return { ok: r.status === "ok", ...r, orderId, elapsedMs: Date.now() - started };
  } finally {
    await close();
  }
}

function resetManual() {
  manual.platform = "";
  manual.startedAt = "";
  manual.vncToken = "";
  manual.vncReady = false;
  manual.close = null;
  manual.finished = null;
}

function loginView(extra = {}) {
  return {
    ok: true,
    platform: manual.platform,
    display: process.env.DISPLAY ?? "",
    minutes: MANUAL_LOGIN_MINUTES,
    startedAt: manual.startedAt,
    vncToken: manual.vncToken,
    vncPath: manual.vncToken ? vncViewerPath(manual.vncToken) : "",
    vncReady: manual.vncReady,
    ...extra,
  };
}

async function startManualLogin(platform) {
  if (manual.close) {
    if (manual.platform === platform && manual.vncToken) return loginView({ reused: true });
    return { ok: false, error: `manuālais login jau atvērts (${manual.platform})` };
  }
  const p = platforms[platform];
  const vnc = await ensureNovnc();
  const vncToken = createVncToken();
  manual.platform = platform;
  manual.startedAt = new Date().toISOString();
  manual.vncToken = vncToken;
  manual.vncReady = vnc.ok;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  let resolveFinished;
  const finished = new Promise((resolve) => {
    resolveFinished = resolve;
  });
  manual.close = () => resolveDone("closed");
  manual.finished = finished;
  void browserQueue.run(`manual-login:${platform}`, async () => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolveFinished(result);
    };
    let page = null;
    let close = async () => undefined;
    try {
      ({ page, close } = await openProfile(platform, { headless: false }));
      await page.goto(p.loginUrl, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
      log(`${platform}: manuālais login atvērts uz DISPLAY=${process.env.DISPLAY ?? "?"}, ${MANUAL_LOGIN_MINUTES} min, vnc=${vnc.ok}`);
      const timer = setTimeout(() => resolveDone("timeout"), MANUAL_LOGIN_MINUTES * 60_000);
      const why = await done;
      clearTimeout(timer);
      const loggedIn = await p.isLoggedIn(page).catch(() => false);
      state.setSession(platform, loggedIn ? "ok" : "login_required", loggedIn ? "" : `manuālais login beidzās (${why}) bez aktīvas sesijas`);
      state.setLogin(platform, `manual:${why}:${loggedIn ? "ok" : "not_logged_in"}`);
      log(`${platform}: manuālais login aizvērts (${why}), loggedIn=${loggedIn}`);
      finish({ loggedIn, why });
    } catch (e) {
      const note = e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "nezināma";
      state.setSession(platform, "unknown", note);
      finish({ loggedIn: false, why: "error", note });
    } finally {
      await close();
      resetManual();
      stopNovncIfStarted();
      finish({ loggedIn: false, why: "closed" });
    }
  });
  return loginView({
    vncReady: vnc.ok,
    ...(vnc.ok ? {} : { vncError: vnc.error || "noVNC nav pieejams" }),
  });
}

async function closeManualLogin(platform) {
  if (!manual.close || manual.platform !== platform) return { ok: false, error: "nav atvērta manuālā login" };
  const finished = manual.finished;
  manual.close();
  const result = await Promise.race([
    finished,
    new Promise((resolve) => {
      setTimeout(() => resolve({ loggedIn: false, why: "wait_timeout" }), 90_000);
    }),
  ]);
  return {
    ok: true,
    platform,
    loggedIn: Boolean(result?.loggedIn),
    why: result?.why ?? "closed",
    session: result?.loggedIn ? "ok" : "login_required",
    note: result?.note ?? "",
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const path = stripPrefix(url.pathname);

  const vncReq = parseVncRequestPath(path) || parseVncRequestPath(url.pathname);
  if (vncReq && (req.method === "GET" || req.method === "HEAD")) {
    if (!manual.vncToken || !tokensEqual(vncReq.token, manual.vncToken)) {
      return sendJson(res, 401, { ok: false, error: "nederīgs vai beidzies noVNC tokens" });
    }
    return proxyVncHttp(req, res, vncReq.rest, url.search);
  }

  if (path === "/health" && req.method === "GET") {
    const profiles = Object.fromEntries(await Promise.all(PLATFORMS.map(async (p) => [p, await profileExists(p)])));
    return sendJson(
      res,
      200,
      state.healthView({
        profiles,
        credentials: Object.fromEntries(PLATFORMS.map((p) => [p, platforms[p].hasCredentials()])),
        queue: { length: browserQueue.queueLength, current: browserQueue.current },
        manualLogin: manual.close
          ? { platform: manual.platform, startedAt: manual.startedAt, vncReady: manual.vncReady }
          : null,
        display: process.env.DISPLAY ?? "",
      }),
    );
  }

  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "tikai POST" });
  if (!bearerOk(req)) return sendJson(res, 401, { ok: false, error: "nederīgs tokens" });

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : "nederīgs JSON" });
  }

  const loginMatch = path.match(/^\/login\/(openlane|auto1|autobid)(\/close)?$/);
  if (loginMatch) {
    const platform = loginMatch[1];
    if (loginMatch[2]) {
      const closed = await closeManualLogin(platform);
      return sendJson(res, closed.ok ? 200 : 404, closed);
    }
    if (browserQueue.queueLength > 0 && !manual.close) return sendJson(res, 503, { ok: false, error: "pārlūks aizņemts, mēģini pēc brīža" });
    return sendJson(res, 200, await startManualLogin(platform));
  }

  const platform = String(body.platform ?? "").trim();
  if (!PLATFORMS.includes(platform)) return sendJson(res, 400, { ok: false, error: "platform: openlane | auto1 | autobid" });

  if (path === "/session/check") {
    if (browserQueue.queueLength >= MAX_QUEUE) return sendJson(res, 503, { ok: false, error: "rinda pilna" });
    const out = await browserQueue.run(`session:${platform}`, async () => {
      const { page, close } = await openProfile(platform);
      try {
        return await ensureSession(platform, page);
      } finally {
        await close();
      }
    });
    return sendJson(res, 200, { ok: out.status === "ok", ...out });
  }

  if (path === "/fetch") {
    const sourceUrl = validSourceUrl(body.sourceUrl, platform);
    if (!sourceUrl) return sendJson(res, 400, { ok: false, error: "sourceUrl neatbilst platformas hostam" });
    const orderId = String(body.orderId ?? "").slice(0, 80);
    const maxPages = Math.min(MAX_PAGES, Math.max(1, Number(body.maxPages) || MAX_PAGES));
    if (browserQueue.queueLength >= MAX_QUEUE) return sendJson(res, 503, { ok: false, error: "rinda pilna" });
    if (state.countFetch(platform, MAX_FETCHES_PER_DAY)) {
      return sendJson(res, 429, { ok: false, status: "error", error: `dienas limits ${MAX_FETCHES_PER_DAY} nolasīšanas šai platformai` });
    }
    log(`${platform} fetch ${orderId} ${sourceUrl.slice(0, 100)} (rinda ${browserQueue.queueLength})`);
    try {
      const out = await browserQueue.run(`fetch:${platform}`, () => runFetch({ platform, sourceUrl, orderId, maxPages }));
      if (out.raw) out.raw = sanitizeAutobidRelayRaw(out.raw);
      log(`${platform} ${out.status} ${out.items.length} auto ${out.elapsedMs} ms ${out.note ?? ""}`);
      return sendJson(res, 200, out);
    } catch (e) {
      const note = e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "nezināma kļūda";
      state.setFetch(platform, "error", note);
      log(`${platform} kļūda: ${note}`);
      return sendJson(res, 500, { ok: false, status: "error", note, items: [], orderId });
    }
  }

  return sendJson(res, 404, { ok: false, error: "nezināms ceļš" });
});

server.requestTimeout = 0;
server.headersTimeout = 65_000;
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const path = stripPrefix(url.pathname);
  const vncReq = parseVncRequestPath(path) || parseVncRequestPath(url.pathname);
  if (!vncReq || !manual.vncToken || !tokensEqual(vncReq.token, manual.vncToken)) {
    try {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    } catch {
      /* ignore */
    }
    socket.destroy();
    return;
  }
  proxyVncUpgrade(req, socket, head, vncReq.rest, url.search);
});
server.listen(PORT, HOST, () => {
  log(`klausās http://${HOST}:${PORT}, profili ${process.env.LISTINGS_PROFILES_DIR || "/var/lib/provin-listings/profiles"}, DISPLAY=${process.env.DISPLAY ?? "nav"}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    log(`${sig}, saglabāju stāvokli`);
    await state.save();
    process.exit(0);
  });
}
