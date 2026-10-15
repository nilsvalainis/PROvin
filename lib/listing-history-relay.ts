/**
 * Adify un tirgusdati.lv priekšā ir Cloudflare, kas noraida datacentra IP:
 * no Vercel funkcijas abi avoti atbild HTTP 403, no operatora tīkla 200.
 * Jina Reader (`r.jina.ai`) Adify arī neredz (atgriež to pašu Just a moment).
 * Tāpēc pēc HTTP relejiem lapu ielasa caur Hetzner Chrome (`POST /listings/page`),
 * kas jau strādā VIN SCAN (stat.vin, eCarsTrade). Parsē to pašu SSR HTML.
 */

import { looksLikeListingHistoryCloudflareChallenge } from "@/lib/listing-history-cloudflare";
import { fetchVinScanPageViaRelay } from "@/lib/vin-scan/listings-page-relay";

/** Jina Reader: bez atslēgas ~20 pieprasījumi minūtē no viena IP. */
const JINA_RELAY_TEMPLATE = "https://r.jina.ai/{url}";

export const LISTING_HISTORY_RELAY_TIMEOUT_MS = 22_000;
export const LISTING_HISTORY_CHROME_RELAY_TIMEOUT_MS = 40_000;

/**
 * Publiskās vēstures / sludinājuma lapas, ko Chrome relejs drīkst atvērt.
 * Jāsakrīt ar `VINSCAN_PAGE_HOSTS` papildinājumiem `relay/provin-listings/lib/vinscan-page.mjs`.
 */
export const LISTING_HISTORY_CHROME_RELAY_HOSTS = [
  "adify.lv",
  "tirgusdati.lv",
  "ss.lv",
  "ss.com",
  "city24.lv",
] as const;

export type ListingHistoryRelayFetch = {
  html: string | null;
  error: string | null;
};

/** `LISTING_HISTORY_RELAY_URLS`, `LISTING_HISTORY_RELAY_TOKEN`, `JINA_API_KEY`. */
type RelayEnv = Record<string, string | undefined>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function isJinaRelay(template: string): boolean {
  return /(^|\/\/|\.)r\.jina\.ai(\/|$)/i.test(template);
}

export function isListingHistoryChromeRelayUrl(raw: string): boolean {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return LISTING_HISTORY_CHROME_RELAY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Releju secība: vispirms pašu uzstādītie (`LISTING_HISTORY_RELAY_URLS`,
 * piem. paša Cloudflare Worker), tad iebūvētais Jina, tad Hetzner Chrome.
 */
export function listingHistoryRelayTemplates(env: RelayEnv = process.env): string[] {
  const custom = (env.LISTING_HISTORY_RELAY_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...custom, JINA_RELAY_TEMPLATE])];
}

/** `{url}` = neapstrādāta adrese, `{encoded}` = encodeURIComponent; bez vietturiem pielipina beigās. */
export function buildListingHistoryRelayUrl(template: string, targetUrl: string): string {
  const target = targetUrl.trim();
  if (template.includes("{encoded}")) {
    return template.split("{encoded}").join(encodeURIComponent(target));
  }
  if (template.includes("{url}")) {
    return template.split("{url}").join(target);
  }
  return `${template}${encodeURIComponent(target)}`;
}

export function listingHistoryRelayHeaders(
  template: string,
  env: RelayEnv = process.env,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "lv-LV,lv;q=0.9,en;q=0.8",
  };
  if (isJinaRelay(template)) {
    // Bez šī Jina atgriež Markdown, kurā nav ne vēstures tabulas, ne __NEXT_DATA__.
    headers["x-respond-with"] = "html";
    const key = env.JINA_API_KEY?.trim();
    if (key) headers.Authorization = `Bearer ${key}`;
  } else {
    const token = env.LISTING_HISTORY_RELAY_TOKEN?.trim();
    if (token) headers["x-relay-token"] = token;
  }
  return headers;
}

/** Rate-limit un releja īslaicīga kļūda ir vērta vienu atkārtojumu, 403 nav. */
function relayStatusIsWorthRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relayLabel(template: string): string {
  if (isJinaRelay(template)) return "Jina";
  try {
    return new URL(template.includes("{") ? template.split("{")[0] || template : template).host || "HTTP relejs";
  } catch {
    return "HTTP relejs";
  }
}

async function relayAttempt(
  relayUrl: string,
  headers: Record<string, string>,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<{ html: string | null; retry: boolean; cloudflare?: boolean; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(relayUrl, {
      method: "GET",
      headers,
      signal: ctrl.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[listing-history relay] HTTP", res.status, relayUrl);
      return {
        html: null,
        retry: relayStatusIsWorthRetry(res.status),
        cloudflare: false,
        error: `HTTP ${res.status}`,
      };
    }
    const html = await res.text();
    if (html.trim() && looksLikeListingHistoryCloudflareChallenge(html)) {
      return { html: null, retry: false, cloudflare: true, error: "Cloudflare" };
    }
    return { html: html.trim() ? html : null, retry: false, cloudflare: false, error: html.trim() ? undefined : "tukša atbilde" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[listing-history relay] neizdevās:", msg);
    return { html: null, retry: false, cloudflare: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchListingHtmlViaChromeRelay(
  targetUrl: string,
  opts: { env?: RelayEnv; fetchImpl?: FetchLike } = {},
): Promise<ListingHistoryRelayFetch> {
  return fetchViaChromeRelay(targetUrl, opts.env ?? process.env, opts.fetchImpl);
}

async function fetchViaChromeRelay(
  targetUrl: string,
  env: RelayEnv,
  fetchImpl?: FetchLike,
): Promise<ListingHistoryRelayFetch> {
  if (!isListingHistoryChromeRelayUrl(targetUrl)) {
    return { html: null, error: null };
  }
  const chrome = await fetchVinScanPageViaRelay(targetUrl, {
    env,
    fetchImpl,
    timeoutMs: LISTING_HISTORY_CHROME_RELAY_TIMEOUT_MS,
  });
  if (!chrome.ok) {
    console.warn("[listing-history relay] Chrome:", chrome.reason);
    return { html: null, error: `Chrome relejs: ${chrome.reason}` };
  }
  if (looksLikeListingHistoryCloudflareChallenge(chrome.html)) {
    return { html: null, error: "Chrome relejs: joprojām Cloudflare izaicinājums" };
  }
  return { html: chrome.html, error: null };
}

/** Atgriež vēstures lapas HTML un kļūdas iemeslu, ja neizdevās. */
export async function loadListingHistoryHtmlViaRelays(
  targetUrl: string,
  opts: { timeoutMs?: number; env?: RelayEnv; retryDelayMs?: number; fetchImpl?: FetchLike } = {},
): Promise<ListingHistoryRelayFetch> {
  const env = opts.env ?? process.env;
  const timeoutMs = opts.timeoutMs ?? LISTING_HISTORY_RELAY_TIMEOUT_MS;
  const retryDelayMs = opts.retryDelayMs ?? 1_500;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const errors: string[] = [];

  for (const template of listingHistoryRelayTemplates(env)) {
    const relayUrl = buildListingHistoryRelayUrl(template, targetUrl);
    const headers = listingHistoryRelayHeaders(template, env);
    const label = relayLabel(template);

    const first = await relayAttempt(relayUrl, headers, timeoutMs, fetchImpl);
    if (first.html) return { html: first.html, error: null };
    if (first.error) errors.push(`${label}: ${first.error}`);
    if (first.cloudflare || !first.retry) continue;

    await sleep(retryDelayMs);
    const second = await relayAttempt(relayUrl, headers, timeoutMs, fetchImpl);
    if (second.html) return { html: second.html, error: null };
    if (second.error) errors.push(`${label}: ${second.error}`);
  }

  const chrome = await fetchViaChromeRelay(targetUrl, env, opts.fetchImpl);
  if (chrome.html) return chrome;
  if (chrome.error) errors.push(chrome.error);

  return { html: null, error: errors.filter(Boolean).join(" · ") || null };
}

/** Atgriež vēstures lapas HTML caur pirmo releju, kas atbild, vai `null`. */
export async function fetchListingHistoryHtmlViaRelay(
  targetUrl: string,
  opts: { timeoutMs?: number; env?: RelayEnv; retryDelayMs?: number; fetchImpl?: FetchLike } = {},
): Promise<string | null> {
  return (await loadListingHistoryHtmlViaRelays(targetUrl, opts)).html;
}
