/**
 * VIN SCAN izsoļu lapas caur īstu Chrome (stat.vin WAF, bid.cars, BidFax, u.c.).
 * Nav IRISS platforma: atsevišķs profils `vinscan`, bez Openlane/Auto1 sīkdatnēm.
 *
 * stat.vin Cloudflare "Just a moment" / "Performing security verification" bieži atbild
 * ar HTTP 403, pirms izaicinājuma HTML ir DOM. Agrāk pirmā tukšā 403 aina izskatījās
 * "tīra", pārlūks aizvērās ~3 s un cf_clearance netika saglabāts. Te gaidām, kamēr
 * izaicinājums nokrīt, atkārtoti lietojam sīkdatnes un ejam ar page.goto, nevis ar fetch.
 */

export const VINSCAN_PAGE_HOSTS = [
  "stat.vin",
  "bid.cars",
  "checkcar.vin",
  "bidfax.info",
  "poctra.com",
  "plc.auction",
  "adify.lv",
  "tirgusdati.lv",
  "ss.lv",
  "ss.com",
  "city24.lv",
  "car.info",
];

const HTML_LIMIT = 900_000;
const POLL_MS = 750;
const ATTEMPTS = 3;

/** JS izaicinājums, kas vēl var nokrist. To gaidām. */
const CHALLENGE_WAIT_RE =
  /just a moment|performing security verification|security verification|checking your browser|verify you are human|cf-browser-verification|cf-chl|challenge-platform|cf-turnstile|turnstile|cdn-cgi\/challenge|_cf_chl/i;

/**
 * Galīgs Cloudflare/WAF bloks. IP paliek 403 arī īstā Chrome.
 * Pēc īsas apstiprināšanas (lapa nemainās) beidzam, nevis gaidām visu 52 s budžetu.
 */
const HARD_BLOCK_RE =
  /sorry, you have been blocked|you have been blocked|access denied|attention required|access blocked|error code:\s*1020|cf-error-details|enable javascript and cookies/i;

const HARD_BLOCK_CONFIRM_MS = 2_500;

export function validVinScanPageUrl(raw) {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    const ok = VINSCAN_PAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    return ok ? u.toString() : "";
  } catch {
    return "";
  }
}

function looksLikeVehicle(html) {
  const raw = String(html ?? "");
  const sale = /sale history/i.test(raw) && /\b(copart|iaai)\b/i.test(raw);
  const lot = /\b(copart|iaai)\b/i.test(raw) && /\blot[:\s#№]*[0-9]{5,10}\b/i.test(raw);
  const json = /__NEXT_DATA__/i.test(raw) && /saleHistory|"lot"|copart|iaai/i.test(raw);
  return sale || lot || json;
}

/** vehicle = izsoles lapa. challenge/pending = vēl jāgaida. blocked = galīgs 403. clear = parasta lapa. */
export function classifyVinScanSnapshot(html, title, status) {
  if (looksLikeVehicle(html)) return "vehicle";
  const blob = `${title}\n${html}`.slice(0, 80_000);
  if (CHALLENGE_WAIT_RE.test(blob)) return "challenge";
  if (HARD_BLOCK_RE.test(blob)) return "blocked";
  if (status === 403 || status === 429 || status === 503 || status === 0) return "pending";
  if (String(html ?? "").trim().length < 400) return "pending";
  return "clear";
}

function readStatus(resp) {
  try {
    if (resp && typeof resp.status === "function") return Number(resp.status()) || 0;
    if (resp && typeof resp.status === "number") return resp.status;
  } catch {
    /* ignore */
  }
  return 0;
}

async function readNet(resp) {
  if (!resp || typeof resp.text !== "function") return "";
  try {
    return String(await resp.text());
  } catch {
    return "";
  }
}

function preferHtml(dom, net) {
  const d = String(dom ?? "");
  if (looksLikeVehicle(d)) return d;
  if (d.trim().length > 80) return d;
  const n = String(net ?? "");
  return n.trim() ? n : d;
}

async function readSnap(page, net) {
  let dom = "";
  let title = "";
  try {
    dom = await page.content();
  } catch {
    dom = "";
  }
  try {
    title = await page.title();
  } catch {
    title = "";
  }
  let finalUrl = "";
  try {
    finalUrl = typeof page.url === "function" ? page.url() : "";
  } catch {
    finalUrl = "";
  }
  return { html: preferHtml(dom, net), title, finalUrl };
}

async function navigate(page, target, timeoutMs) {
  const timeout = Math.max(3_000, timeoutMs || 15_000);
  try {
    return await page.goto(target, { waitUntil: "commit", timeout });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/waitUntil|commit/i.test(msg)) return null;
  }
  try {
    return await page.goto(target, { waitUntil: "domcontentloaded", timeout });
  } catch {
    return null;
  }
}

async function hasClearance(context, url) {
  if (!context || typeof context.cookies !== "function") return false;
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  try {
    const list = await context.cookies([origin]);
    return Array.isArray(list) && list.some((c) => c && c.name === "cf_clearance" && String(c.value ?? "").length > 8);
  } catch {
    try {
      const list = await context.cookies();
      return Array.isArray(list) && list.some((c) => c && c.name === "cf_clearance" && String(c.value ?? "").length > 8);
    } catch {
      return false;
    }
  }
}

async function nudge(page) {
  try {
    if (typeof page.mouse?.move === "function") {
      await page.mouse.move(460, 340);
      await page.mouse.move(540, 420);
    }
  } catch {
    /* ignore */
  }
  try {
    const frames = typeof page.frames === "function" ? page.frames() : [];
    for (const frame of frames) {
      const frameUrl = typeof frame.url === "function" ? frame.url() : "";
      if (!/challenges\.cloudflare\.com|turnstile|cdn-cgi\/challenge/i.test(frameUrl)) continue;
      if (typeof frame.click === "function") await frame.click("body", { timeout: 800 }).catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
}

function originOf(url) {
  try {
    const u = new URL(url);
    return `${u.origin}/`;
  } catch {
    return "";
  }
}

/**
 * @returns {Promise<{done: boolean, status: number, html: string, finalUrl: string}>}
 */
async function settle(page, url, context, navStatus, net, now, end, sleep) {
  let status = navStatus;
  let body = net;
  let lastHtml = body;
  let lastUrl = url;
  let polls = 0;
  let cookieNav = false;
  let blockedAt = 0;
  while (now() < end && polls < 40) {
    polls += 1;
    const snap = await readSnap(page, body);
    lastHtml = snap.html || lastHtml;
    lastUrl = snap.finalUrl || lastUrl;
    const kind = classifyVinScanSnapshot(snap.html, snap.title, status);
    if (kind === "vehicle") return { done: true, status: 200, html: snap.html, finalUrl: lastUrl };
    if (kind === "clear") return { done: true, status: status >= 400 || status === 0 ? 200 : status, html: snap.html, finalUrl: lastUrl };
    if (kind === "blocked") {
      if (!blockedAt) blockedAt = now();
      if (now() - blockedAt >= HARD_BLOCK_CONFIRM_MS) {
        return { done: false, status: 403, html: snap.html || lastHtml, finalUrl: lastUrl, blocked: true };
      }
    } else {
      blockedAt = 0;
    }
    if (!cookieNav && polls >= 3 && (await hasClearance(context, url))) {
      cookieNav = true;
      const again = await navigate(page, url, Math.min(12_000, Math.max(3_000, end - now())));
      const next = readStatus(again);
      if (next) status = next;
      const nextBody = await readNet(again);
      if (nextBody) body = nextBody;
      continue;
    }
    if (polls % 4 === 0) await nudge(page);
    const left = end - now();
    if (left <= 0) break;
    await sleep(Math.min(POLL_MS, left));
  }
  const failStatus = status >= 400 ? status : 403;
  return { done: false, status: failStatus, html: lastHtml, finalUrl: lastUrl };
}

export async function fetchVinScanPageHtml(page, url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 52_000;
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const deadline = now() + timeoutMs;
  const context = opts.context ?? (typeof page.context === "function" ? page.context() : null);
  let last = { status: 403, html: "", finalUrl: url };

  for (let attempt = 1; attempt <= ATTEMPTS && now() < deadline; attempt += 1) {
    if (attempt === 2) {
      const origin = originOf(url);
      if (origin && origin !== url) {
        await navigate(page, origin, Math.min(12_000, Math.max(3_000, deadline - now())));
        const warmEnd = Math.min(deadline, now() + 6_000);
        const warmed = await settle(page, origin, context, 0, "", now, warmEnd, sleep);
        if (warmed.done && looksLikeVehicle(warmed.html) && warmed.finalUrl === url) return clip(warmed);
      }
    }
    const resp = await navigate(page, url, Math.min(15_000, Math.max(3_000, deadline - now())));
    const navStatus = readStatus(resp);
    const net = await readNet(resp);
    const attemptMs = attempt === 1 ? 24_000 : 14_000;
    const end = Math.min(deadline, now() + attemptMs);
    const settled = await settle(page, url, context, navStatus, net, now, end, sleep);
    last = settled;
    if (settled.done || settled.blocked) return clip(settled);
  }
  return clip(last);
}

function clip(row) {
  return {
    status: row.status || 403,
    finalUrl: row.finalUrl || "",
    html: String(row.html ?? "").slice(0, HTML_LIMIT),
  };
}
