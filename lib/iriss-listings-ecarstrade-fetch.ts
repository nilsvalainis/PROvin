import "server-only";

import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import {
  ECARSTRADE_AUTH_PATH,
  ECARSTRADE_DEFAULT_PER_PAGE,
  ECARSTRADE_ORIGIN,
  ecarstradeApiUrl,
  ecarstradePageStart,
  parseEcarstradeApiPage,
  readEcarstradeAuth,
  type EcarstradeVehicle,
} from "@/lib/iriss-listings-ecarstrade";
import type { IrissListingSourceStatus } from "@/lib/iriss-listings-types";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

type AuthSession = { cookie: string } | { skipped: true; note: string } | { failed: true; note: string; status: IrissListingSourceStatus };

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function ecarstradeAuthCookieHeader(accessToken: string, refreshToken = ""): string {
  const parts = [`eCT/user=${accessToken}`];
  if (refreshToken) parts.push(`eCT/refresh-token=${refreshToken}`);
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

async function loginEcarstrade(
  fetchImpl: typeof fetch,
  timeoutMs: number,
  env: Record<string, string | undefined>,
): Promise<AuthSession> {
  const creds = readEcarstradeAuth(env);
  if (!creds) return { skipped: true, note: "eCarsTrade lasīts publiski (nav ECARSTRADE_USER / ECARSTRADE_PASS)." };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(new URL(ECARSTRADE_AUTH_PATH, ECARSTRADE_ORIGIN).toString(), {
      method: "POST",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      body: JSON.stringify({ username: creds.username, password: creds.password }),
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const text = await res.text();
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
    return { cookie: ecarstradeAuthCookieHeader(tokens.accessToken, tokens.refreshToken) };
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
): Promise<{ ok: true; statusCode: number; text: string } | { ok: false; note: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      "User-Agent": BROWSER_UA,
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "en-GB,en;q=0.9,de;q=0.8,lv;q=0.7",
      Referer: `${ECARSTRADE_ORIGIN}/search`,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };
    if (cookie) headers.Cookie = cookie;
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

  const auth = await loginEcarstrade(fetchImpl, opts.timeoutMs, env);
  const cookie = "cookie" in auth ? auth.cookie : "";
  loggedIn = Boolean(cookie);
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
    const got = await fetchApiText(url, opts.timeoutMs, fetchImpl, cookie);
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

  const notes: string[] = [];
  if (authNote) notes.push(authNote);
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
