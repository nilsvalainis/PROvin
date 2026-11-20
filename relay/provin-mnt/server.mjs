// PROVIN mnt.ee browser relay.
// GET|POST /mnt/lookup?vin=...[&regMark=...]  (Authorization: Bearer $MNT_RELAY_TOKEN)
// GET /mnt/health
// Real Chrome (persistent profile) under Xvfb opens eteenindus.mnt.ee, types the VIN, lets the
// page's own reCAPTCHA v3 run, captures the JSF partial response and returns the result form HTML.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium as pwChromium } from "playwright";

const env = process.env;
const PORT = Number(env.MNT_PORT || 8788);
const HOST = env.MNT_HOST || "127.0.0.1";
const TOKEN = env.MNT_RELAY_TOKEN || "";
const MNT_URL = "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf";
const SITEKEY = "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa";
const ACTION = "soiduk_otsing";
const LOOKUP_TIMEOUT_MS = Number(env.MNT_TIMEOUT_MS || 90_000);
const CONCURRENCY = Math.max(1, Math.min(2, Number(env.MNT_CONCURRENCY || 1)));
const MAX_QUEUE = Number(env.MNT_MAX_QUEUE || 6);
const CACHE_TTL_MS = Number(env.MNT_CACHE_TTL_MS || 24 * 3600_000);
const CACHE_DIR = env.MNT_CACHE_DIR || "/var/lib/provin-mnt/cache";
const PROFILE_DIR = env.MNT_PROFILE_DIR || "/var/lib/provin-mnt/profile";
const NATIVE_ATTEMPTS = Math.max(1, Number(env.MNT_NATIVE_ATTEMPTS || 5));
const TWOCAPTCHA_KEY = env.TWOCAPTCHA_API_KEY || "";
const TWOCAPTCHA_FALLBACK = /^(1|true|yes)$/i.test(env.MNT_TWOCAPTCHA_FALLBACK || "") && !!TWOCAPTCHA_KEY;
const BROWSER_PROXY = env.MNT_BROWSER_PROXY || ""; // e.g. http://user:pass@residential-host:port
const CHANNEL = env.MNT_CHANNEL || "chrome";
const HEADLESS = /^(1|true|yes)$/i.test(env.MNT_HEADLESS || "");
const RECYCLE_AFTER = Number(env.MNT_RECYCLE_AFTER || 40);

const DETAIL_EXTRACT = fs.readFileSync(new URL("./detail-extract.js", import.meta.url), "utf8");
const DETAIL_RE = /soidukDetailvaadeAvalik\.jsf/;
if (!TOKEN || TOKEN.length < 32) { console.error("MNT_RELAY_TOKEN missing/short"); process.exit(1); }
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(PROFILE_DIR, { recursive: true });

const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- browser ----------
// One shared browser process; every lookup gets a fresh context (one page) that loads and saves a
// shared storageState (cookies + localStorage) so Google/Cloudflare cookies accumulate over time.
const STATE_FILE = path.join(PROFILE_DIR, "storage-state.json");
let browserPromise = null;
let useCount = 0;
function proxyOption() {
  if (!BROWSER_PROXY) return {};
  const u = new URL(BROWSER_PROXY);
  return { proxy: { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username) || undefined, password: decodeURIComponent(u.password) || undefined } };
}
async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.isConnected() && useCount < RECYCLE_AFTER) return b;
    await closeBrowser();
  }
  useCount = 0;
  browserPromise = pwChromium.launch({
    headless: HEADLESS,
    channel: CHANNEL === "bundled" ? undefined : CHANNEL,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--lang=et-EE", "--disable-dev-shm-usage"],
    ...proxyOption(),
  });
  const b = await browserPromise;
  b.on("disconnected", () => { log("browser disconnected"); browserPromise = null; });
  log("browser launched", { channel: CHANNEL, version: b.version(), headless: HEADLESS, proxy: !!BROWSER_PROXY });
  return b;
}
async function closeBrowser() {
  const p = browserPromise; browserPromise = null;
  if (p) { const b = await p.catch(() => null); await b?.close().catch(() => {}); }
}
async function newContext() {
  const b = await getBrowser();
  useCount++;
  let storageState;
  try { storageState = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch {}
  return b.newContext({
    locale: "et-EE",
    timezoneId: "Europe/Tallinn",
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { "Accept-Language": "et-EE,et;q=0.9,en-US;q=0.8,en;q=0.7" },
    ...(storageState ? { storageState } : {}),
  });
}
async function saveState(ctx) {
  try { const st = await ctx.storageState(); fs.writeFileSync(STATE_FILE + ".tmp", JSON.stringify(st)); fs.renameSync(STATE_FILE + ".tmp", STATE_FILE); } catch {}
}

// ---------- 2Captcha (fallback only) ----------
async function twoCaptchaToken(deadline) {
  const q = new URLSearchParams({ key: TWOCAPTCHA_KEY, method: "userrecaptcha", version: "v3", action: ACTION, min_score: "0.9", googlekey: SITEKEY, pageurl: MNT_URL, json: "1" });
  const c = await (await fetch("https://2captcha.com/in.php?" + q)).json();
  if (c.status !== 1) throw new Error("2captcha: " + c.request);
  while (Date.now() < deadline - 15_000) {
    await sleep(5000);
    const r = await (await fetch(`https://2captcha.com/res.php?key=${TWOCAPTCHA_KEY}&action=get&id=${c.request}&json=1`)).json();
    if (r.status === 1) return r.request;
    if (r.request !== "CAPCHA_NOT_READY") throw new Error("2captcha: " + r.request);
  }
  throw new Error("2captcha: timeout");
}

// ---------- one attempt ----------
function extractFormFromPartial(xml) {
  const m = /<update id="soidukOtsingForm"><!\[CDATA\[([\s\S]*?)\]\]><\/update>/.exec(xml);
  return m ? m[1] : "";
}
// Fallback: jqPlot data array in the original detail HTML, e.g. data:[[[1636934400000,15],[...]]]
function mileageFromHtml(html) {
  const out = [];
  const i = html.search(/labisoitPanel[_:]linear/);
  if (i < 0) return out;
  const seg = html.slice(i, i + 20000);
  for (const m of seg.matchAll(/\[\s*"?(\d{13}|\d{4}-\d{2}-\d{2})"?\s*,\s*(\d{1,7})(?:\s*,[^\]]*)?\]/g)) {
    const d = /^\d{13}$/.test(m[1]) ? new Date(Number(m[1])).toISOString().slice(0, 10) : m[1];
    out.push({ date: d, odometerKm: Number(m[2]) });
  }
  return out;
}
function classify(formHtml, httpStatus) {
  if (httpStatus === 403 || httpStatus === 429 || httpStatus === 503) return "blocked";
  if (!formHtml) return "error";
  const text = formHtml.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/valideerimise viga/i.test(text)) return "captcha_rejected";
  // The intro paragraph quotes the not-found sentence once; the real message makes it appear twice.
  const nf = text.match(/Sisestatud andmetega sõidukit registris ei ole/gi) || [];
  if (nf.length >= 2 || /ui-messages-(error|warn|info)[\s\S]{0,400}registris ei ole/i.test(formHtml)) return "not_found";
  // A real hit always redirects to soidukDetailvaadeAvalik.jsf, so anything else here is unexpected.
  return "unknown";
}

async function attempt(vin, regMark, { injectToken = null, deadline }) {
  let page, ctx;
  try {
    ctx = await newContext();
    page = await ctx.newPage();
  } catch (e) {
    await closeBrowser();
    return { status: "error", error: "browser: " + String(e?.message || e).slice(0, 200) };
  }
  const timings = {};
  let ajax = null; // { status, body, navigated }
  let detailDocBody = "";
  page.on("response", async (r) => {
    try {
      if (r.request().method() === "GET" && DETAIL_RE.test(r.url()) && r.request().resourceType() === "document") { detailDocBody = await r.text().catch(() => ""); return; }
      if (r.request().method() !== "POST" || !r.url().startsWith(MNT_URL)) return;
      let body = "";
      let navigated = false;
      try { body = await r.text(); } catch (e) { navigated = true; if (!/navigat|No resource with given identifier/i.test(String(e.message))) log("body read failed", String(e.message).slice(0, 160)); }
      // Ignore the button's ViewState-only round trip; keep the search result (form update / redirect / navigation / HTTP error).
      if (!navigated && r.status() < 400 && !/<update id="soidukOtsingForm"|<redirect\b/.test(body)) return;
      ajax = { status: r.status(), body, navigated };
    } catch {}
  });
  try {
    const T0 = Date.now(); const mark = (k) => { timings[k] = Date.now() - T0; };
    const nav = await page.goto(MNT_URL, { waitUntil: "domcontentloaded", timeout: Math.max(10_000, deadline - Date.now() - 5000) });
    if (nav && nav.status() >= 400) return { status: "blocked", httpStatus: nav.status(), error: `GET HTTP ${nav.status()}`, raw: (await nav.text().catch(() => "")).slice(0, 2000) };
    mark("goto");
    await page.waitForSelector("#soidukOtsingForm\\:vinKood", { timeout: 30_000 });
    await page.waitForFunction(() => window.grecaptcha && window.grecaptcha.execute, null, { timeout: 30_000 });
    mark("ready");
    const tEnd = Date.now() + rnd(3000, 5000);
    while (Date.now() < tEnd) { await page.mouse.move(rnd(100, 1300), rnd(100, 800), { steps: 12 }); await sleep(rnd(200, 600)); }
    if (regMark) { await page.click("#soidukOtsingForm\\:regMark"); await page.keyboard.type(regMark, { delay: rnd(80, 140) }); }
    await page.click("#soidukOtsingForm\\:vinKood");
    await page.keyboard.type(vin, { delay: rnd(80, 140) });
    await sleep(rnd(600, 1200));
    if (injectToken) await page.evaluate((t) => { window.grecaptcha.execute = () => Promise.resolve(t); }, injectToken);
    const btn = page.locator("#soidukOtsingForm button:has-text('Otsin')").first();
    const box = await btn.boundingBox().catch(() => null);
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    await btn.click();
    mark("click");
    // Success = PrimeFaces partial-response <redirect> -> browser navigates to soidukDetailvaadeAvalik.jsf.
    // Failure = partial update of soidukOtsingForm (captcha error / not found) or HTTP 4xx from Cloudflare.
    while (!ajax && !DETAIL_RE.test(page.url()) && Date.now() < deadline - 2000) await sleep(250);
    mark("response");
    log("attempt timings", timings, { ajax: ajax ? { status: ajax.status, len: ajax.body.length, nav: ajax.navigated, head: ajax.body.slice(0, 160) } : null, url: page.url().replace(/\?.*/, "") });
    if (ajax && ajax.status >= 400) return { status: "blocked", httpStatus: ajax.status, error: `AJAX HTTP ${ajax.status}`, raw: ajax.body.slice(0, 2000) };
    // An empty / unreadable body means the browser is already navigating (redirect to the detail page).
    if (ajax && !/<update id="soidukOtsingForm"/.test(ajax.body)) {
      const until = Math.min(deadline - 3000, Date.now() + 15_000);
      while (!DETAIL_RE.test(page.url()) && Date.now() < until) await sleep(250);
    }
    if (ajax?.navigated || /<redirect\b/.test(ajax?.body || "") || DETAIL_RE.test(page.url())) {
      await page.waitForURL(DETAIL_RE, { timeout: Math.max(5000, deadline - Date.now() - 3000) }).catch(() => {});
      await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
      await page.waitForSelector("#soidukDetailid", { timeout: 15_000 }).catch(() => {});
      await sleep(1500);
      if (!DETAIL_RE.test(page.url())) return { status: "error", error: "redirect to detail page did not complete" };
      const detail = await page.evaluate(`(${DETAIL_EXTRACT})()`);
      if (!detail.mileage?.length && detailDocBody) detail.mileage = mileageFromHtml(detailDocBody);
      return { status: "found", httpStatus: 200, detail };
    }
    if (!ajax) return { status: "error", error: "no AJAX response from mnt.ee (timeout)" };
    await sleep(500);
    const formHtml = extractFormFromPartial(ajax.body) || (await page.$eval("#soidukOtsingForm", (f) => f.outerHTML).catch(() => ""));
    const status = classify(formHtml, ajax.status);
    if (status === "unknown") { try { fs.writeFileSync("/tmp/provin-mnt-last-unknown.html", formHtml); } catch {} }
    if (status === "error" || status === "unknown") log("attempt debug", { status, http: ajax.status, len: ajax.body.length, head: ajax.body.slice(0, 300).replace(/\s+/g, " ") });
    return { status, httpStatus: ajax.status, formHtml, error: status === "error" ? `unparseable mnt.ee response (HTTP ${ajax.status}, ${ajax.body.length} bytes)` : undefined };
  } catch (e) {
    return { status: "error", error: String(e?.message || e).slice(0, 300) };
  } finally {
    await saveState(ctx);
    await ctx.close().catch(() => {});
  }
}

// ---------- lookup with retries ----------
// reCAPTCHA v3 on mnt.ee (observed 2026-10-07 from the Hetzner IP): a brand-new browser identity is
// rejected on its very first execute, the same identity (with the _GRECAPTCHA cookie it got) then
// passes, and after a burst of lookups that identity starts failing again. So: keep the identity in
// storage-state.json, and after ROTATE_AFTER consecutive rejections throw it away and start fresh.
const ROTATE_AFTER = Math.max(1, Number(env.MNT_ROTATE_AFTER || 2));
let consecutiveRejects = 0;
function rotateIdentity(reason) {
  try { if (fs.existsSync(STATE_FILE)) fs.renameSync(STATE_FILE, STATE_FILE.replace(/\.json$/, `.rotated-${Date.now()}.json`)); } catch {}
  try { // keep only the 3 newest rotated files
    const old = fs.readdirSync(PROFILE_DIR).filter((f) => f.includes(".rotated-")).sort().reverse().slice(3);
    for (const f of old) fs.unlinkSync(path.join(PROFILE_DIR, f));
  } catch {}
  consecutiveRejects = 0;
  log("identity rotated", reason);
}

async function lookup(vin, regMark) {
  const t0 = Date.now();
  const deadline = t0 + LOOKUP_TIMEOUT_MS;
  const tried = [];
  let last = null;
  for (let i = 0; i < NATIVE_ATTEMPTS && Date.now() < deadline - 15_000; i++) {
    last = await attempt(vin, regMark, { deadline });
    tried.push(`native:${last.status}`);
    if (last.status === "captcha_rejected") {
      consecutiveRejects++;
      if (consecutiveRejects >= ROTATE_AFTER) { rotateIdentity(`${consecutiveRejects} consecutive rejections`); tried.push("rotate"); }
      continue;
    }
    if (last.status === "error") { await closeBrowser(); continue; }
    consecutiveRejects = 0;
    break;
  }
  if (last?.status === "captcha_rejected" && TWOCAPTCHA_FALLBACK && Date.now() < deadline - 30_000) {
    try {
      const token = await twoCaptchaToken(deadline);
      last = await attempt(vin, regMark, { injectToken: token, deadline });
      tried.push(`2captcha:${last.status}`);
    } catch (e) { tried.push(`2captcha:error`); last = { ...last, error: String(e.message).slice(0, 200) }; }
  }
  if (last?.detail?.mileage) last.detail.mileage = last.detail.mileage.map(({ extra, ...m }) => (extra && extra.some((x) => x != null) ? { ...m, extra } : m));
  return { ...last, tried, elapsedMs: Date.now() - t0 };
}

// ---------- summary ----------
function summarize(d) {
  const get = (...labels) => { for (const l of labels) { const p = d.pairs.find((x) => x.label.toLowerCase() === l.toLowerCase()); if (p && p.value !== "-") return p.value; } return undefined; };
  const iso = (v) => { const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(v || ""); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : undefined; };
  const num = (v) => { const m = /([\d.]+)/.exec((v || "").replace(/\s/g, "")); return m ? Number(m[1]) : undefined; };
  const mm = d.header.makeModel || "";
  const lastInsp = d.inspections?.[0];
  const dereg = d.operations?.find((o) => /kustutamine|registrist kustutatud/i.test(o.action));
  return {
    regMark: d.header.regMark || undefined,
    make: mm.split(/\s+/)[0] || undefined,
    model: mm.split(/\s+/).slice(1).join(" ") || undefined,
    makeModel: mm || undefined,
    vin: d.header.vin || undefined,
    firstRegistration: iso(get("Esmane registreerimine")),
    registeredInEstonia: iso(get("Eestis registreerimine")),
    category: get("Kategooria"),
    categoryCode: get("Kategooria tähis"),
    bodyType: get("Kere nimetus"),
    color: get("Kere värvus"),
    engineCc: num(get("Mootori töömaht", "Mootor")),
    engineCode: get("Mootori mudel"),
    powerKw: num(get("Mootori võimsus")),
    fuel: get("Kütus"),
    gearbox: get("Käigukast"),
    drive: get("Veoskeem"),
    emissionStandard: get("Heitmenorm"),
    co2Wltp: num(get("CO2 (WLTP)")),
    massKg: num(get("Täismass")),
    typeApproval: get("Tüübikinnituse nr."),
    lastInspection: lastInsp ? { date: iso(lastInsp["Tegemise kuupäev"]), validUntil: lastInsp["Kehtib Kuni"], station: lastInsp["Ülevaatuspunkt"], result: lastInsp["Ülevaatuse otsus"] } : undefined,
    deregistered: dereg ? { date: iso(dereg.date), action: dereg.action } : undefined,
    mileageRecords: d.mileage?.length || 0,
  };
}

// ---------- cache ----------
const mem = new Map();
const cacheKey = (vin, reg) => crypto.createHash("sha1").update(`${vin}|${reg}`).digest("hex");
function cacheGet(k) {
  const now = Date.now();
  let e = mem.get(k);
  if (!e) { try { e = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, k + ".json"), "utf8")); mem.set(k, e); } catch {} }
  if (e && now - e.at < CACHE_TTL_MS) return e;
  return null;
}
function cachePut(k, value) {
  const e = { at: Date.now(), value };
  mem.set(k, e);
  try { fs.writeFileSync(path.join(CACHE_DIR, k + ".json"), JSON.stringify(e)); } catch {}
}

// ---------- concurrency ----------
let active = 0; const queue = [];
function withSlot(fn) {
  return new Promise((resolve, reject) => {
    const run = async () => { active++; try { resolve(await fn()); } catch (e) { reject(e); } finally { active--; queue.shift()?.(); } };
    if (active < CONCURRENCY) run(); else if (queue.length >= MAX_QUEUE) reject(Object.assign(new Error("busy"), { code: 503 })); else queue.push(run);
  });
}
const inflight = new Map();

// ---------- HTTP ----------
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}
function authOk(req) {
  const h = req.headers.authorization || "";
  const got = Buffer.from(h.startsWith("Bearer ") ? h.slice(7) : "");
  const want = Buffer.from(TOKEN);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
async function readBody(req) {
  let b = ""; for await (const c of req) { b += c; if (b.length > 10_000) break; }
  try { return JSON.parse(b || "{}"); } catch { return Object.fromEntries(new URLSearchParams(b)); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/mnt/health") return send(res, 200, { ok: true, active, queued: queue.length, uptimeS: Math.round(process.uptime()) });
  if (url.pathname !== "/mnt/lookup") return send(res, 404, { ok: false, error: "not found" });
  if (!authOk(req)) return send(res, 401, { ok: false, error: "unauthorized" });
  if (req.method !== "GET" && req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  const body = req.method === "POST" ? await readBody(req) : {};
  const vin = String(url.searchParams.get("vin") || body.vin || "").trim().toUpperCase();
  const regMark = String(url.searchParams.get("regMark") || body.regMark || "").trim().toUpperCase().replace(/\s+/g, "");
  const noCache = url.searchParams.get("nocache") === "1" || body.nocache === true;
  if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) return send(res, 400, { ok: false, vin, error: "invalid vin" });
  if (regMark && !/^[A-Z0-9]{2,9}$/.test(regMark)) return send(res, 400, { ok: false, vin, error: "invalid regMark" });
  const k = cacheKey(vin, regMark);
  if (!noCache) { const c = cacheGet(k); if (c) return send(res, 200, { ...c.value, cached: true, cachedAt: new Date(c.at).toISOString() }); }
  try {
    let p = inflight.get(k);
    if (!p) { p = withSlot(() => lookup(vin, regMark)); inflight.set(k, p); p.finally(() => inflight.delete(k)).catch(() => {}); }
    const r = await p;
    const ok = r.status === "found" || r.status === "not_found";
    let data = null;
    if (r.status === "found") {
      const d = r.detail;
      data = {
        found: true,
        summary: summarize(d),
        header: d.header,
        pairs: d.pairs,
        inspections: d.inspections,
        operations: d.operations,
        mileage: d.mileage,
        tables: d.tables,
        // ExtractedPage shape (lib/vin-sources/html-extract.ts) -> parseMntExtract(vin, data.page) works as-is
        page: { text: d.text, tables: d.tables, pairs: d.pairs },
        html: d.html,
        sourceUrl: d.url,
      };
    } else if (r.status === "not_found") {
      data = { found: false, message: "Sisestatud andmetega sõidukit registris ei ole", page: null, html: r.formHtml };
    }
    const out = {
      ok, vin, regMark: regMark || undefined, status: r.status,
      data,
      rawHtmlSnippet: ((r.detail?.html || r.formHtml || r.raw || "").slice(0, 4000)) || undefined,
      error: ok ? undefined : (r.error || { captcha_rejected: "mnt.ee rejected the reCAPTCHA v3 token (reCAPTCHA valideerimise viga)", blocked: "mnt.ee / Cloudflare blocked the request", unknown: "unrecognised mnt.ee response" }[r.status] || "lookup failed"),
      tried: r.tried, elapsedMs: r.elapsedMs, fetchedAt: new Date().toISOString(), cached: false,
    };
    log("lookup", vin.slice(0, 3) + "…" + vin.slice(-4), r.status, r.tried.join(","), r.elapsedMs + "ms");
    if (ok) cachePut(k, out);
    return send(res, ok ? 200 : 502, out);
  } catch (e) {
    if (e.code === 503) return send(res, 503, { ok: false, vin, error: "relay busy, retry later" });
    return send(res, 500, { ok: false, vin, error: String(e.message || e).slice(0, 200) });
  }
});
server.requestTimeout = LOOKUP_TIMEOUT_MS * 4;
server.listen(PORT, HOST, () => log(`provin-mnt relay on ${HOST}:${PORT}`, { concurrency: CONCURRENCY, twoCaptchaFallback: TWOCAPTCHA_FALLBACK, proxy: !!BROWSER_PROXY }));
for (const s of ["SIGTERM", "SIGINT"]) process.on(s, async () => { await closeBrowser(); process.exit(0); });
