import "server-only";

import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import {
  ECARSTRADE_AUTH_PATH,
  ECARSTRADE_DEFAULT_PER_PAGE,
  ECARSTRADE_ORIGIN,
  ecarstradeApiUrl,
  ecarstradeCarJsonUrl,
  ecarstradeDetailUrl,
  ecarstradePageStart,
  isEcarstradeSearchUrl,
  mergeEcarstradeHtmlPrices,
  mergeEcarstradeJsonPrices,
  parseEcarstradeApiPage,
  parseEcarstradeSearchHtml,
  readEcarstradeAuth,
  type EcarstradeVehicle,
} from "@/lib/iriss-listings-ecarstrade";
import type { IrissListingSourceStatus } from "@/lib/iriss-listings-types";
import {
  cookieHeaderFromSetCookieLines,
  isCloudflareChallengeHtml,
  mergeCookieHeader,
  splitCombinedSetCookieHeader,
} from "@/lib/vin-sources/html-extract";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** PHP sesija pirms login (ne `/search`: tas viesiem dzēš `eCT/user`). */
export const ECARSTRADE_SESSION_WARMUP_PATH = "/setsession.php";
/** Pēc JWT: tas pats `location.reload()`, ko dara vietnes login.js. */
export const ECARSTRADE_SESSION_ACTIVATE_PATH = "/search";

export type EcarstradeSourceFetchResult = {
  status: IrissListingSourceStatus;
  note: string;
  vehicles: EcarstradeVehicle[];
  rawPages: string[];
  pagesFetched: number;
  pageCount: number;
  loggedIn: boolean;
};

export type EcarstradeFetchOptions = {
  maxPages: number;
  timeoutMs: number;
  pauseMinMs: number;
  pauseMaxMs: number;
  perPage?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  env?: Record<string, string | undefined>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function randomPauseMs(min: number, max: number): number {
  const lo = Math.max(0, Math.min(min, max));
  const hi = Math.max(lo, max);
  return Math.round(lo + Math.random() * (hi - lo));
}

type AuthSession =
  | { cookie: string; accessToken: string; searchHtml: string }
  | { skipped: true; note: string }
  | { failed: true; note: string; status: IrissListingSourceStatus };

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function encodeCookieValue(raw: string): string {
  return encodeURIComponent(raw).replace(/%2E/gi, ".");
}

export function ecarstradeAuthCookieHeader(accessToken: string, refreshToken = ""): string {
  const parts = [`eCT/user=${encodeCookieValue(accessToken)}`];
  if (refreshToken) parts.push(`eCT/refresh-token=${encodeCookieValue(refreshToken)}`);
  return parts.join("; ");
}

export function parseEcarstradeLoginBody(body: unknown): { accessToken: string; refreshToken: string } | null {
  const root = isRec(body) ? body : null;
  const data = root && isRec(root.data) ? root.data : root;
  if (!data) return null;
  const accessToken = str(data.accessToken) || str(data.access_token);
  const refreshToken = str(data.refreshToken) || str(data.refresh_token);
  return accessToken ? { accessToken, refreshToken } : null;
}

export function cookiesFromFetchResponse(res: Response): string {
  const rows = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const raw = rows.length > 0 ? cookieHeaderFromSetCookieLines(rows) : cookieHeaderFromSetCookieLines(splitCombinedSetCookieHeader(res.headers.get("set-cookie") ?? ""));
  return dropDeletedCookies(raw);
}

export function dropDeletedCookies(header: string): string {
  if (!header.trim()) return "";
  const keep: string[] = [];
  for (const part of header.split(";")) {
    const piece = part.trim();
    if (!piece || !piece.includes("=")) continue;
    const eq = piece.indexOf("=");
    const k = piece.slice(0, eq).trim();
    const v = piece.slice(eq + 1).trim();
    if (!k || !v || /^deleted$/i.test(v)) continue;
    keep.push(`${k}=${v}`);
  }
  return keep.join("; ");
}

function mergeJar(previous: string, incoming: string): string {
  return dropDeletedCookies(mergeCookieHeader(previous, incoming));
}

const browserHeaders = (): Record<string, string> => ({
  "User-Agent": BROWSER_UA,
  "Accept-Language": "lv,en-GB;q=0.9,en;q=0.8",
  Origin: ECARSTRADE_ORIGIN,
  Referer: `${ECARSTRADE_ORIGIN}/search`,
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
});

async function fetchHtmlPage(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  cookie: string,
): Promise<{ cookie: string; text: string; statusCode: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      ...browserHeaders(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    if (cookie) headers.Cookie = cookie;
    const res = await fetchImpl(url, {
      method: "GET",
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => "");
    return { cookie: mergeJar(cookie, cookiesFromFetchResponse(res)), text, statusCode: res.status };
  } catch {
    return { cookie, text: "", statusCode: 0 };
  } finally {
    clearTimeout(t);
  }
}

async function fetchForCookies(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  cookie: string,
): Promise<string> {
  const page = await fetchHtmlPage(url, timeoutMs, fetchImpl, cookie);
  return page.cookie;
}

async function loginEcarstrade(
  fetchImpl: typeof fetch,
  timeoutMs: number,
  env: Record<string, string | undefined>,
  activateUrl = "",
): Promise<AuthSession> {
  const creds = readEcarstradeAuth(env);
  if (!creds) return { skipped: true, note: "eCarsTrade lasīts publiski (nav ECARSTRADE_USER / ECARSTRADE_PASS)." };
  let cookie = "";
  try {
    cookie = await fetchForCookies(new URL(ECARSTRADE_SESSION_WARMUP_PATH, ECARSTRADE_ORIGIN).toString(), timeoutMs, fetchImpl, "");
  } catch {
    cookie = "";
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(new URL(ECARSTRADE_AUTH_PATH, ECARSTRADE_ORIGIN).toString(), {
      method: "POST",
      headers: {
        ...browserHeaders(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: creds.username, password: creds.password }),
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const text = await res.text();
    cookie = mergeJar(cookie, cookiesFromFetchResponse(res));
    if (res.status === 401 || res.status === 403) {
      return { failed: true, status: "login_required", note: `eCarsTrade login HTTP ${res.status}.` };
    }
    if (res.status >= 400) {
      return { failed: true, status: "fetch_failed", note: `eCarsTrade login HTTP ${res.status}.` };
    }
    let json: unknown = null;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return { failed: true, status: "login_required", note: "eCarsTrade login atbilde nav JSON." };
    }
    const tokens = parseEcarstradeLoginBody(json);
    if (!tokens) return { failed: true, status: "login_required", note: "eCarsTrade login nedeva accessToken." };
    cookie = mergeJar(cookie, ecarstradeAuthCookieHeader(tokens.accessToken, tokens.refreshToken));
    const bindUrl =
      activateUrl && isEcarstradeSearchUrl(activateUrl)
        ? activateUrl
        : new URL(ECARSTRADE_SESSION_ACTIVATE_PATH, ECARSTRADE_ORIGIN).toString();
    const bound = await fetchHtmlPage(bindUrl, timeoutMs, fetchImpl, cookie);
    cookie = mergeJar(bound.cookie, ecarstradeAuthCookieHeader(tokens.accessToken, tokens.refreshToken));
    return { cookie, accessToken: tokens.accessToken, searchHtml: bound.text };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      failed: true,
      status: "fetch_failed",
      note: aborted ? `eCarsTrade login noildze ${Math.round(timeoutMs / 1000)} s` : formatFetchError(e, "eCarsTrade login failed"),
    };
  } finally {
    clearTimeout(t);
  }
}

async function fetchApiText(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  cookie: string,
  accessToken = "",
): Promise<{ ok: true; statusCode: number; text: string } | { ok: false; note: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      ...browserHeaders(),
      Accept: "application/json,text/plain,*/*",
      "X-Requested-With": "XMLHttpRequest",
    };
    if (cookie) headers.Cookie = cookie;
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetchImpl(url, {
      method: "GET",
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const text = await res.text();
    return { ok: true, statusCode: res.status, text };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, note: aborted ? `Noildze ${Math.round(timeoutMs / 1000)} s` : formatFetchError(e, "fetch_failed") };
  } finally {
    clearTimeout(t);
  }
}

function httpStatusToSource(statusCode: number): { status: IrissListingSourceStatus; note: string } | null {
  if (statusCode === 401) return { status: "login_required", note: "HTTP 401: eCarsTrade pieprasa autorizāciju." };
  if (statusCode === 403) return { status: "blocked_by_waf", note: "HTTP 403: eCarsTrade bloķē pieprasījumu (WAF)." };
  if (statusCode === 429) return { status: "blocked_by_waf", note: "HTTP 429: par daudz pieprasījumu, eCarsTrade ierobežo." };
  if (statusCode >= 400) return { status: "fetch_failed", note: `HTTP ${statusCode}` };
  return null;
}

function isAuthJsonBlock(statusCode: number, text: string): boolean {
  if (statusCode !== 401 && statusCode !== 403) return false;
  if (isCloudflareChallengeHtml(text, statusCode)) return false;
  return true;
}

function vehicleNeedsPrice(v: EcarstradeVehicle): boolean {
  return v.priceBuyNow == null && v.priceCurrent == null;
}

async function enrichMissingPrices(
  vehicles: Map<string, EcarstradeVehicle>,
  fetchImpl: typeof fetch,
  cookie: string,
  accessToken: string,
  timeoutMs: number,
): Promise<string> {
  const missing = [...vehicles.values()].filter(vehicleNeedsPrice).slice(0, 30);
  if (missing.length === 0) return "";
  let enrichedJson = 0;
  let enrichedHtml = 0;
  let jsonCf = false;
  let htmlCf = false;
  const perTry = Math.min(timeoutMs, 8000);
  for (const v of missing) {
    if (!jsonCf) {
      const jsonUrl = ecarstradeCarJsonUrl(v.externalId);
      if (jsonUrl) {
        const got = await fetchApiText(jsonUrl, perTry, fetchImpl, cookie, accessToken);
        if (got.ok) {
          if (isCloudflareChallengeHtml(got.text, got.statusCode)) jsonCf = true;
          else if (isAuthJsonBlock(got.statusCode, got.text)) jsonCf = true;
          else if (got.statusCode < 400) {
            try {
              const body = JSON.parse(got.text) as Record<string, unknown>;
              const next = mergeEcarstradeJsonPrices(v, body);
              vehicles.set(v.externalId, next);
              if (!vehicleNeedsPrice(next)) enrichedJson += 1;
            } catch {
              /* nederīgs JSON */
            }
          }
        }
      }
    }
    const now = vehicles.get(v.externalId) ?? v;
    if (!vehicleNeedsPrice(now) || htmlCf) continue;
    const htmlUrl = ecarstradeDetailUrl(now.externalId);
    if (!htmlUrl) continue;
    const got = await fetchApiText(htmlUrl, perTry, fetchImpl, cookie, accessToken);
    if (!got.ok) continue;
    if (isCloudflareChallengeHtml(got.text, got.statusCode)) {
      htmlCf = true;
      continue;
    }
    if (got.statusCode >= 400) continue;
    const next = mergeEcarstradeHtmlPrices(now, got.text);
    vehicles.set(v.externalId, next);
    if (!vehicleNeedsPrice(next)) enrichedHtml += 1;
    if (jsonCf && htmlCf) break;
  }
  const stillMissing = [...vehicles.values()].filter(vehicleNeedsPrice).length;
  const bits: string[] = [];
  if (enrichedJson > 0) bits.push(`Cenas no /api/v1/cars: ${enrichedJson}.`);
  if (enrichedHtml > 0) bits.push(`Cenas no /cars HTML: ${enrichedHtml}.`);
  if (jsonCf) bits.push("/api/v1/cars bloķē Cloudflare (challenge).");
  if (htmlCf) bits.push("/cars/{id} bloķē Cloudflare.");
  if (stillMissing > 0 && (jsonCf || htmlCf)) {
    bits.push(`${stillMissing} auto bez cenas pēc enrich.`);
  }
  return bits.join(" ");
}

function mergePricesFromSearchHtml(vehicles: Map<string, EcarstradeVehicle>, html: string): number {
  if (!html.trim()) return 0;
  let n = 0;
  for (const card of parseEcarstradeSearchHtml(html)) {
    const now = vehicles.get(card.externalId);
    if (!now || !vehicleNeedsPrice(now)) continue;
    const merged: EcarstradeVehicle = {
      ...now,
      priceBuyNow: card.priceBuyNow ?? now.priceBuyNow,
      priceCurrent: card.priceCurrent ?? now.priceCurrent,
      priceStart: card.priceStart ?? now.priceStart,
    };
    vehicles.set(now.externalId, merged);
    if (!vehicleNeedsPrice(merged)) n += 1;
  }
  return n;
}

/** Nolasa meklēšanas lapas caur future_api.php. Bez parolēm strādā publiski. */
export async function fetchEcarstradeSource(sourceUrl: string, opts: EcarstradeFetchOptions): Promise<EcarstradeSourceFetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const env = opts.env ?? process.env;
  const perPage = opts.perPage ?? ECARSTRADE_DEFAULT_PER_PAGE;
  const vehicles = new Map<string, EcarstradeVehicle>();
  const rawPages: string[] = [];
  let pageCount = 0;
  let pagesFetched = 0;
  let partialNote = "";
  let loggedIn = false;

  const auth = await loginEcarstrade(fetchImpl, opts.timeoutMs, env, sourceUrl);
  const cookie = "cookie" in auth ? auth.cookie : "";
  const accessToken = "accessToken" in auth ? auth.accessToken : "";
  const searchHtml = "searchHtml" in auth ? auth.searchHtml : "";
  loggedIn = Boolean(accessToken);
  const authNote = "note" in auth ? auth.note : loggedIn ? "eCarsTrade sesija ar dīlera kontu." : "";
  if ("failed" in auth && auth.failed && auth.status === "login_required") {
    /** Login neizdevās: tomēr mēģinām publisko sarakstu. */
  }

  for (let page = 1; page <= Math.max(1, opts.maxPages); page += 1) {
    if (page > 1) {
      if (page > pageCount) break;
      await sleep(randomPauseMs(opts.pauseMinMs, opts.pauseMaxMs));
    }
    let url: string;
    try {
      url = ecarstradeApiUrl(sourceUrl, ecarstradePageStart(page, perPage), perPage);
    } catch {
      return { status: "fetch_failed", note: "Nederīgs eCarsTrade URL.", vehicles: [], rawPages, pagesFetched, pageCount, loggedIn };
    }
    const got = await fetchApiText(url, opts.timeoutMs, fetchImpl, cookie, accessToken);
    if (!got.ok) {
      if (page === 1) return { status: "fetch_failed", note: got.note, vehicles: [], rawPages, pagesFetched, pageCount, loggedIn };
      partialNote = `${page}. lapa neizdevās: ${got.note}`;
      break;
    }
    const http = httpStatusToSource(got.statusCode);
    if (http) {
      if (page === 1) return { ...http, vehicles: [], rawPages, pagesFetched, pageCount, loggedIn };
      partialNote = `${page}. lapa: ${http.note}`;
      break;
    }
    const parsed = parseEcarstradeApiPage(got.text, page, perPage);
    if (!parsed) {
      if (page === 1) {
        rawPages.push(got.text.slice(0, 400_000));
        return {
          status: "parse_failed",
          note: "eCarsTrade future_api.php neatgrieza auto kartītes. Iespējams, mainīta struktūra; skat. raw.",
          vehicles: [],
          rawPages,
          pagesFetched: 1,
          pageCount,
          loggedIn,
        };
      }
      partialNote = `${page}. lapu neizdevās parsēt.`;
      break;
    }
    pagesFetched += 1;
    pageCount = Math.max(pageCount, parsed.pageCount);
    rawPages.push(got.text.slice(0, 1_500_000));
    for (const v of parsed.vehicles) if (!vehicles.has(v.externalId)) vehicles.set(v.externalId, v);
    if (parsed.vehicles.length === 0 || parsed.vehicles.length < perPage) {
      pageCount = pagesFetched;
      break;
    }
  }

  let enrichNote = "";
  if (loggedIn && accessToken) {
    const fromSearch = mergePricesFromSearchHtml(vehicles, searchHtml);
    const missingAfterList = [...vehicles.values()].filter(vehicleNeedsPrice).length;
    if (missingAfterList === 0) {
      enrichNote = fromSearch
        ? `Cenas no /search HTML: ${fromSearch}.`
        : "Cenas no future_api kartītēm (sesija).";
    } else {
      enrichNote = await enrichMissingPrices(vehicles, fetchImpl, cookie, accessToken, opts.timeoutMs);
      if (fromSearch) enrichNote = [`Cenas no /search HTML: ${fromSearch}.`, enrichNote].filter(Boolean).join(" ");
      const still = [...vehicles.values()].filter(vehicleNeedsPrice).length;
      if (still > 0 && still === missingAfterList && !enrichNote) {
        enrichNote = `Sesija ir, bet ${still} auto kartītes joprojām bez cenas (Sign in to buy).`;
      } else if (still > 0 && missingAfterList > 0 && /Cloudflare/i.test(enrichNote) && still === missingAfterList) {
        enrichNote = `${enrichNote} future_api palika publisks (Sign in to buy).`;
      }
    }
  }

  const notes: string[] = [];
  if (authNote) notes.push(authNote);
  if (enrichNote) notes.push(enrichNote);
  if (vehicles.size === 0) notes.push("Meklējums šobrīd nedod rezultātus (0 auto) BE/NL/LU/DE.");
  if (pageCount > opts.maxPages) notes.push(`Nolasītas ${pagesFetched}/${pageCount} lapas (limits ${opts.maxPages}).`);
  if (partialNote) notes.push(partialNote);
  return {
    status: "ok",
    note: notes.join(" "),
    vehicles: [...vehicles.values()],
    rawPages,
    pagesFetched,
    pageCount,
    loggedIn,
  };
}
