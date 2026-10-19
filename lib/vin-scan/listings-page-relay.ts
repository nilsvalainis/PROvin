import "server-only";
/**
 * VIN SCAN izsoļu lapas caur Hetzner IRISS Chrome releju (`POST /listings/page`).
 * stat.vin WAF (plaintext Access blocked) CapSolver nespēj; īsts Chrome var.
 * Env: IRISS_LISTINGS_RELAY_URL + IRISS_LISTINGS_RELAY_TOKEN (tie paši, kas LIST).
 * Vienā skenēšanā tas pats URL iet uz releju vienu reizi (`withVinScanRelayDedupe`).
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import { readIrissRelayConfig } from "@/lib/iriss-listings-relay";
import { isCloudflareChallengeHtml, looksLikeCloudflareWafBlock } from "@/lib/vin-sources/html-extract";

export type VinScanHttpLike = {
  status: number;
  text: string;
  cookie?: string;
  ua?: string;
  proxyUrl?: string;
  finalUrl?: string;
  challengeReason?: string;
};

export type VinScanRelayPageOk = { ok: true; status: number; html: string; finalUrl: string };
export type VinScanRelayPageErr = { ok: false; reason: string };
export type VinScanRelayPage = VinScanRelayPageOk | VinScanRelayPageErr;

const DEFAULT_TIMEOUT_MS = 90_000;

/** Tāds pats allowlist kā relay/provin-listings/lib/vinscan-page.mjs */
export const VIN_SCAN_RELAY_HOSTS = [
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
] as const;

export function isVinScanRelayUrl(raw: string): boolean {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return VIN_SCAN_RELAY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const relayDedupe = new AsyncLocalStorage<Map<string, Promise<VinScanRelayPage>>>();

/** Viena VIN SCAN palaišana dala releja atbildes: paralēli un atkārtoti pieprasījumi nesūta otru POST. */
export function withVinScanRelayDedupe<T>(fn: () => Promise<T>): Promise<T> {
  return relayDedupe.run(new Map(), fn);
}

function relayDedupeKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function vinScanPageNeedsRelay(page: VinScanHttpLike): boolean {
  if (page.challengeReason) return true;
  if (page.status === 0) return true;
  if (isCloudflareChallengeHtml(page.text, page.status)) return true;
  if (looksLikeCloudflareWafBlock(page.text, page.status)) return true;
  return page.status === 403 || page.status === 429 || page.status === 503;
}

export async function fetchVinScanPageViaRelay(
  url: string,
  deps: { fetchImpl?: FetchLike; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<VinScanRelayPage> {
  const store = relayDedupe.getStore();
  if (!store) return fetchVinScanPageViaRelayOnce(url, deps);
  const key = relayDedupeKey(url);
  const pending = store.get(key);
  if (pending) return pending;
  const job = fetchVinScanPageViaRelayOnce(url, deps);
  store.set(key, job);
  return job;
}

async function fetchVinScanPageViaRelayOnce(
  url: string,
  deps: { fetchImpl?: FetchLike; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<VinScanRelayPage> {
  const cfg = readIrissRelayConfig(deps.env ?? process.env);
  if (!cfg) return { ok: false, reason: "Relejs nav konfigurēts (IRISS_LISTINGS_RELAY_URL)" };
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/page`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ url }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
    const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (!res.ok) {
      const err = String(rec.error ?? rec.note ?? "").trim();
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: "Relejs noraidīja tokenu (IRISS_LISTINGS_RELAY_TOKEN)" };
      }
      if (res.status === 429) return { ok: false, reason: err || "Releja dienas limits VIN SCAN" };
      if (res.status === 503) return { ok: false, reason: err || "Relejs aizņemts (rinda pilna)" };
      return { ok: false, reason: err || `Relejs atbildēja HTTP ${res.status}` };
    }
    const html = String(rec.html ?? "");
    if (!html.trim()) return { ok: false, reason: "Relejs atgrieza tukšu HTML" };
    return {
      ok: true,
      status: typeof rec.status === "number" ? rec.status : 200,
      html,
      finalUrl: String(rec.finalUrl ?? url),
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    if (aborted) return { ok: false, reason: `Relejs neatbildēja ${Math.round(timeoutMs / 1000)} s laikā` };
    return { ok: false, reason: `Releja savienojums neizdevās: ${formatFetchError(e)}` };
  } finally {
    clearTimeout(timer);
  }
}

/** car.info super-search ir XHR JSON, ne HTML lapa. Chrome page.goto to nesaņem. */
export function validCarinfoSuperSearchUrl(raw: string): string {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    if (host !== "www.car.info" && host !== "car.info") return "";
    if (!/^\/[a-z]{2}-[a-z]{2}\/search\/super\/[A-Z0-9]{11,17}$/i.test(u.pathname)) return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function isCarinfoSuperSearchUrl(raw: string): boolean {
  return validCarinfoSuperSearchUrl(raw) !== "";
}

/**
 * Plain HTTP uz releja `POST /listings/http`. Nekad Chrome `/listings/page`.
 * Vecs relejs šo ceļu nezina un atbild ātri ar 400, tāpēc skenēšana nekaras 52 s.
 */
export async function fetchCarinfoSuperSearchViaRelay(
  url: string,
  deps: { fetchImpl?: FetchLike; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<VinScanRelayPage> {
  const target = validCarinfoSuperSearchUrl(url);
  if (!target) return { ok: false, reason: "url nav car.info super-search" };
  const cfg = readIrissRelayConfig(deps.env ?? process.env);
  if (!cfg) return { ok: false, reason: "Relejs nav konfigurēts (IRISS_LISTINGS_RELAY_URL)" };
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/http`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ url: target }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
    const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (!res.ok || rec.ok === false) {
      const err = String(rec.error ?? rec.note ?? "").trim();
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: "Relejs noraidīja tokenu (IRISS_LISTINGS_RELAY_TOKEN)" };
      }
      return { ok: false, reason: err || `Relejs atbildēja HTTP ${res.status}` };
    }
    const html = String(rec.html ?? "");
    if (!html.trim()) return { ok: false, reason: "Relejs atgrieza tukšu atbildi" };
    return {
      ok: true,
      status: typeof rec.status === "number" ? rec.status : 200,
      html,
      finalUrl: String(rec.finalUrl ?? target),
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    if (aborted) return { ok: false, reason: `Relejs neatbildēja ${Math.max(1, Math.round(timeoutMs / 1000))} s laikā` };
    return { ok: false, reason: `Releja savienojums neizdevās: ${formatFetchError(e)}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Super-search rezerve. Ja relejā vēl nav `/http`, atstāj tiešo atbildi un neiet uz Chrome. */
export async function applyCarinfoSuperSearchHttp(
  url: string,
  page: VinScanHttpLike,
  deps: { fetchImpl?: FetchLike; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<VinScanHttpLike> {
  if (!isCarinfoSuperSearchUrl(url)) return page;
  const relayed = await fetchCarinfoSuperSearchViaRelay(url, deps);
  if (!relayed.ok) return page;
  return {
    status: relayed.status || 200,
    text: relayed.html,
    cookie: page.cookie ?? "",
    ua: page.ua,
    proxyUrl: page.proxyUrl,
    finalUrl: relayed.finalUrl,
  };
}

export async function applyVinScanRelayIfBlocked(
  url: string,
  page: VinScanHttpLike,
  deps: { fetchImpl?: FetchLike; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<VinScanHttpLike> {
  if (!isVinScanRelayUrl(url)) return page;
  if (!vinScanPageNeedsRelay(page)) return page;
  const relayed = await fetchVinScanPageViaRelay(url, deps);
  if (!relayed.ok) {
    if (/nav konfigurēts/i.test(relayed.reason)) return page;
    return { ...page, challengeReason: page.challengeReason || relayed.reason };
  }
  return {
    status: relayed.status || 200,
    text: relayed.html,
    cookie: page.cookie ?? "",
    ua: page.ua,
    proxyUrl: page.proxyUrl,
    finalUrl: relayed.finalUrl,
  };
}

/**
 * Ja relejs ir konfigurēts, izsoļu hosts iet uz Hetzner Chrome (`page.goto`), nevis uz Vercel raw fetch.
 * Raw fetch no datu centra saņem stat.vin 403, pirms pārlūks paspēj atrisināt Cloudflare.
 * Bez releja paliek tiešais fetch. Ja relejs neceļas, tiešais fetch ir rezerve.
 */
export async function fetchVinScanAuctionPage(
  url: string,
  directFetch: () => Promise<VinScanHttpLike>,
  deps: { fetchImpl?: FetchLike; env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<VinScanHttpLike> {
  const env = deps.env ?? process.env;
  if (isVinScanRelayUrl(url) && readIrissRelayConfig(env)) {
    const relayed = await fetchVinScanPageViaRelay(url, deps);
    if (relayed.ok && relayed.html.trim()) {
      return {
        status: relayed.status || 200,
        text: relayed.html,
        cookie: "",
        finalUrl: relayed.finalUrl,
      };
    }
    // Relejs jau mēģināts (kļūda vai noildze). Otrs POST tikai pagarina rindu.
    try {
      return await directFetch();
    } catch (e) {
      const reason = !relayed.ok ? relayed.reason : e instanceof Error ? e.message : "Relejs neatbildēja";
      return { status: 0, text: "", cookie: "", challengeReason: reason };
    }
  }
  try {
    const direct = await directFetch();
    return await applyVinScanRelayIfBlocked(url, direct, deps);
  } catch (e) {
    if (!isVinScanRelayUrl(url)) throw e;
    const relayed = await fetchVinScanPageViaRelay(url, deps);
    if (relayed.ok && relayed.html.trim()) {
      return {
        status: relayed.status || 200,
        text: relayed.html,
        cookie: "",
        finalUrl: relayed.finalUrl,
      };
    }
    throw e;
  }
}
