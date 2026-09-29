/**
 * Adify un tirgusdati.lv priekšā ir Cloudflare, kas noraida datacentra IP:
 * no Vercel funkcijas abi avoti atbild HTTP 403, no operatora tīkla — 200.
 * Tāpēc publisko vēstures lapu ielasa caur releju, kura izejas IP nav bloķēts,
 * un parsē to pašu SSR HTML (`<table class="history">`, `__NEXT_DATA__`).
 */

/** Jina Reader: bez atslēgas ~20 pieprasījumi minūtē no viena IP. */
const JINA_RELAY_TEMPLATE = "https://r.jina.ai/{url}";

export const LISTING_HISTORY_RELAY_TIMEOUT_MS = 22_000;

/** `LISTING_HISTORY_RELAY_URLS`, `LISTING_HISTORY_RELAY_TOKEN`, `JINA_API_KEY`. */
type RelayEnv = Record<string, string | undefined>;

function isJinaRelay(template: string): boolean {
  return /(^|\/\/|\.)r\.jina\.ai(\/|$)/i.test(template);
}

/**
 * Releju secība: vispirms pašu uzstādītie (`LISTING_HISTORY_RELAY_URLS`,
 * piem. paša Cloudflare Worker), tad iebūvētais Jina.
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

async function relayAttempt(
  relayUrl: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ html: string | null; retry: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(relayUrl, {
      method: "GET",
      headers,
      signal: ctrl.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[listing-history relay] HTTP", res.status, relayUrl);
      return { html: null, retry: relayStatusIsWorthRetry(res.status) };
    }
    const html = await res.text();
    return { html: html.trim() ? html : null, retry: false };
  } catch (e) {
    console.warn("[listing-history relay] neizdevās:", e instanceof Error ? e.message : e);
    return { html: null, retry: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Atgriež vēstures lapas HTML caur pirmo releju, kas atbild, vai `null`. */
export async function fetchListingHistoryHtmlViaRelay(
  targetUrl: string,
  opts: { timeoutMs?: number; env?: RelayEnv; retryDelayMs?: number } = {},
): Promise<string | null> {
  const env = opts.env ?? process.env;
  const timeoutMs = opts.timeoutMs ?? LISTING_HISTORY_RELAY_TIMEOUT_MS;
  const retryDelayMs = opts.retryDelayMs ?? 1_500;

  for (const template of listingHistoryRelayTemplates(env)) {
    const relayUrl = buildListingHistoryRelayUrl(template, targetUrl);
    const headers = listingHistoryRelayHeaders(template, env);

    const first = await relayAttempt(relayUrl, headers, timeoutMs);
    if (first.html) return first.html;
    if (!first.retry) continue;

    await sleep(retryDelayMs);
    const second = await relayAttempt(relayUrl, headers, timeoutMs);
    if (second.html) return second.html;
  }
  return null;
}
