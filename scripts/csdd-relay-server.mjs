#!/usr/bin/env node
/**
 * CSDD releja serviss. Darbojas uz hosta, kuram ir VPN vai IPSec savienojums ar CSDD,
 * jo `ows.csdd.gov.lv:9999` publiskajā internetā nav sasniedzams un Vercel funkcija
 * nevar turēt tuneli.
 *
 * PROVIN -> šis relejs (Bearer tokens) -> CSDD web serviss (Basic auth).
 *
 * Vide:
 *   CSDD_RELAY_TOKEN      obligāts; tas pats, kas Vercel `CSDD_RELAY_TOKEN`
 *   CSDD_WS_USER          CSDD web servisa lietotājs
 *   CSDD_WS_PASSWORD      CSDD web servisa parole
 *   CSDD_RELAY_PORT       noklusējums 8787
 *   CSDD_RELAY_HOST       noklusējums 127.0.0.1 (ārpasaulei caur cloudflared vai Caddy)
 *   CSDD_BASE_URL         noklusējums https://ows.csdd.gov.lv:9999
 *   CSDD_CACHE_TTL_MS     noklusējums 86400000 (24 h); taupa līguma ierakstu kvotu
 *   CSDD_MAX_PER_MINUTE   noklusējums 60
 *   NODE_EXTRA_CA_CERTS   ja CSDD sertifikātu izdevusi privāta CA (sertifikātu pārbaudi neizslēdzam)
 *
 * Palaišana: node scripts/csdd-relay-server.mjs
 */

import { createServer } from "node:http";

const PORT = Number(process.env.CSDD_RELAY_PORT ?? 8787);
const HOST = process.env.CSDD_RELAY_HOST ?? "127.0.0.1";
const BASE_URL = (process.env.CSDD_BASE_URL ?? "https://ows.csdd.gov.lv:9999").replace(/\/$/, "");
const TOKEN = (process.env.CSDD_RELAY_TOKEN ?? "").trim();
const WS_USER = (process.env.CSDD_WS_USER ?? "").trim();
const WS_PASSWORD = process.env.CSDD_WS_PASSWORD ?? "";
const CACHE_TTL_MS = Number(process.env.CSDD_CACHE_TTL_MS ?? 24 * 60 * 60 * 1000);
const MAX_PER_MINUTE = Number(process.env.CSDD_MAX_PER_MINUTE ?? 60);

if (!TOKEN) {
  console.error("CSDD_RELAY_TOKEN nav iestatīts. Relejs bez tokena nestartē.");
  process.exit(1);
}
if (!WS_USER || !WS_PASSWORD) {
  console.error("CSDD_WS_USER vai CSDD_WS_PASSWORD nav iestatīts.");
  process.exit(1);
}

/** Vienīgais atļautais CSDD ceļš. Relejs nav vispārējs proxy. */
const ALLOWED_PATH = "/zvt/plsql/epak.tl_tehn_dati";
const VALID_NR1 = /^[A-Z0-9]{3,17}$/;

const cache = new Map(); // nr1 -> { at, status, contentType, body }
const minuteHits = [];

function rateLimited() {
  const now = Date.now();
  while (minuteHits.length > 0 && now - minuteHits[0] > 60_000) minuteHits.shift();
  if (minuteHits.length >= MAX_PER_MINUTE) return true;
  minuteHits.push(now);
  return false;
}

function bearerOk(req) {
  const header = req.headers.authorization ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (given.length !== TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < TOKEN.length; i++) diff |= given.charCodeAt(i) ^ TOKEN.charCodeAt(i);
  return diff === 0;
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  res.end(body);
}

async function fetchFromCsdd(nr1) {
  const url = `${BASE_URL}${ALLOWED_PATH}?nr1=${encodeURIComponent(nr1)}`;
  const auth = Buffer.from(`${WS_USER}:${WS_PASSWORD}`, "utf8").toString("base64");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/xml,text/xml,*/*;q=0.8", Authorization: `Basic ${auth}` },
      signal: ctrl.signal,
    });
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, contentType: res.headers.get("content-type") ?? "text/xml", body };
  } finally {
    clearTimeout(timer);
  }
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);

  if (requestUrl.pathname === "/health") return send(res, 200, "ok");
  if (req.method !== "GET") return send(res, 405, "tikai GET");
  if (!bearerOk(req)) return send(res, 401, "nederīgs tokens");
  if (requestUrl.pathname !== ALLOWED_PATH) return send(res, 404, "nezināms ceļš");

  const nr1 = (requestUrl.searchParams.get("nr1") ?? "").trim().toUpperCase();
  if (!VALID_NR1.test(nr1)) return send(res, 400, "nederīgs nr1");

  const hit = cache.get(nr1);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    console.log(`[csdd-relay] ${nr1} no keša`);
    return send(res, hit.status, hit.body, hit.contentType);
  }

  if (rateLimited()) return send(res, 429, "pārāk daudz pieprasījumu");

  try {
    const out = await fetchFromCsdd(nr1);
    if (out.status === 200) cache.set(nr1, { ...out, at: Date.now() });
    console.log(`[csdd-relay] ${nr1} HTTP ${out.status} ${out.body.length} B`);
    return send(res, out.status, out.body, out.contentType);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`[csdd-relay] ${nr1} kļūda: ${reason}`);
    return send(res, 502, "CSDD nav sasniedzams");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[csdd-relay] klausās http://${HOST}:${PORT}, mērķis ${BASE_URL}`);
});
