import "server-only";

/**
 * Adify.lv/history: Hetzner Chrome (18 s) un Fixie bez captcha paliek
 * Cloudflare managed „Just a moment”. CapSolver AntiCloudflareTask + Fixie
 * ir tas pats ceļš, kas car.info / mnt.ee / VIN SCAN.
 *
 * api.adify.lv/api/v1/history/... atgriež application/problem+json 403
 * (nginx, nav CF) - to nemēģinām.
 *
 * Fixie ir datacentra proxy ar 2 izejas IP, ko tas maina nejauši; `cf_clearance`
 * ir piesaistīts IP, un CapSolver ar Fixie (22.10.2026) atbild
 * "custom proxy connect failed" visiem formātiem. No LV rezidentu IP Adify
 * atdod vēsturi bez izaicinājuma, tāpēc `ADIFY_PROXY_URL` (sticky rezidentu proxy,
 * tikai Adify) ir pirmais ceļš; CapSolver vajag tikai, ja arī tur ir izaicinājums.
 */

import {
  capsolverProxyFromUrl,
  getCaptchaSolverProxy,
  hasCaptchaSolverKey,
  httpProxyUrlFromCapsolver,
  solveCaptcha,
  vinStickyHttpProxyUrl,
} from "@/lib/captcha-solver";
import {
  cookiesRecordToHeader,
  htmlForCloudflareSolver,
  isCloudflareChallengeHtml,
  mergeCookieHeader,
} from "@/lib/vin-sources/html-extract";
import { VIN_HTTP_UA, vinHttpFetch } from "@/lib/vin-sources/http";

export const ADIFY_CAPSOLVER_TIMEOUT_MS = 50_000;
export const ADIFY_FIXIE_FETCH_TIMEOUT_MS = 20_000;

export type AdifyBypassFetch = {
  html: string | null;
  error: string | null;
};

type Session = {
  cookie: string;
  ua: string;
  proxyUrl?: string;
};

const ADIFY_HEADERS: Record<string, string> = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "lv-LV,lv;q=0.9,en-US;q=0.8,en;q=0.7",
  referer: "https://adify.lv/",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "upgrade-insecure-requests": "1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "sec-fetch-user": "?1",
};

/** Tikai Adify vēsturei: sticky rezidentu proxy (`http://user:pass@host:port`). Neietekmē mnt.ee / car.info. */
export function adifyHistoryProxyUrl(env: Record<string, string | undefined> = process.env): string {
  return capsolverProxyFromUrl(env.ADIFY_PROXY_URL ?? "") ?? "";
}

export type AdifyBypassDeps = {
  hasKey?: () => boolean;
  /** `ADIFY_PROXY_URL`; ja ir, to lieto gan lapas ielasei, gan CapSolver. */
  adifyProxy?: () => string;
  getProxy?: () => string;
  stickyProxyUrl?: () => string | undefined;
  solve?: typeof solveCaptcha;
  fetchPage?: typeof vinHttpFetch;
  timeoutMs?: number;
};

function pageLooksUseful(html: string, status: number): boolean {
  if (!html.trim()) return false;
  if (isCloudflareChallengeHtml(html, status)) return false;
  return /<script id="__NEXT_DATA__"/i.test(html) || /<html[\s>]/i.test(html);
}

async function bypassCloudflare(
  websiteURL: string,
  challengedHtml: string,
  challengedStatus: number,
  session: Session,
  deps: Required<Pick<AdifyBypassDeps, "solve" | "getProxy" | "timeoutMs">>,
): Promise<Session | { reason: string }> {
  const proxy = deps.getProxy();
  if (!proxy) {
    return { reason: "Adify Cloudflare Challenge vajag CAPSOLVER_PROXY vai FIXIE_URL" };
  }
  const html = htmlForCloudflareSolver(challengedHtml, challengedStatus);
  const solved = await deps.solve(
    {
      kind: "cloudflare_challenge",
      websiteURL,
      proxy,
      ...(html ? { html } : {}),
      userAgent: session.ua,
    },
    { timeoutMs: deps.timeoutMs, sourceLabel: "Adify" },
  );
  if (!solved.ok) return { reason: solved.reason };
  const fromCookies = cookiesRecordToHeader(solved.cookies);
  const clearance = fromCookies || (solved.token ? `cf_clearance=${solved.token}` : "");
  if (!clearance) return { reason: "CapSolver: cf_clearance tukšs" };
  const solvedProxy = solved.proxy?.trim() || proxy;
  return {
    cookie: mergeCookieHeader(session.cookie, clearance),
    ua: solved.userAgent || session.ua,
    proxyUrl: httpProxyUrlFromCapsolver(solvedProxy) ?? session.proxyUrl,
  };
}

/** Adify vēstures HTML caur `ADIFY_PROXY_URL` vai Fixie + CapSolver AntiCloudflareTask (`cf_clearance`). */
export async function fetchAdifyHistoryHtmlViaCapsolver(
  pageUrl: string,
  deps: AdifyBypassDeps = {},
): Promise<AdifyBypassFetch> {
  const hasKey = deps.hasKey ?? hasCaptchaSolverKey;
  const adifyProxy = (deps.adifyProxy ?? adifyHistoryProxyUrl)();
  const getProxy = adifyProxy ? () => adifyProxy : (deps.getProxy ?? getCaptchaSolverProxy);
  const stickyProxyUrl = adifyProxy
    ? () => httpProxyUrlFromCapsolver(adifyProxy) ?? undefined
    : (deps.stickyProxyUrl ?? vinStickyHttpProxyUrl);
  const solve = deps.solve ?? solveCaptcha;
  const fetchPage = deps.fetchPage ?? vinHttpFetch;
  const timeoutMs = deps.timeoutMs ?? ADIFY_CAPSOLVER_TIMEOUT_MS;

  const keyed = hasKey();
  if (!keyed && !adifyProxy) {
    return { html: null, error: "Adify CapSolver: nav CAPSOLVER_API_KEY" };
  }
  const proxy = getProxy();
  if (!proxy) {
    return { html: null, error: "Adify Cloudflare Challenge vajag ADIFY_PROXY_URL, CAPSOLVER_PROXY vai FIXIE_URL" };
  }
  const via = adifyProxy ? "Adify proxy" : "Adify Fixie";

  const session: Session = {
    cookie: "",
    ua: VIN_HTTP_UA,
    proxyUrl: stickyProxyUrl() ?? httpProxyUrlFromCapsolver(proxy) ?? undefined,
  };

  let page;
  try {
    page = await fetchPage(pageUrl, {
      headers: { ...ADIFY_HEADERS, "user-agent": session.ua },
      cookie: session.cookie,
      timeoutMs: ADIFY_FIXIE_FETCH_TIMEOUT_MS,
      proxyUrl: session.proxyUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { html: null, error: `${via}: ${msg.slice(0, 160)}` };
  }
  session.cookie = mergeCookieHeader(session.cookie, page.cookie);

  if (pageLooksUseful(page.text, page.status)) {
    return { html: page.text, error: null };
  }
  if (!isCloudflareChallengeHtml(page.text, page.status)) {
    return {
      html: null,
      error: `${via}: HTTP ${page.status}${page.text.trim() ? "" : ", tukša atbilde"}`,
    };
  }
  if (!keyed) {
    return { html: null, error: `${via}: Cloudflare izaicinājums, nav CAPSOLVER_API_KEY` };
  }

  const next = await bypassCloudflare(pageUrl, page.text, page.status, session, {
    solve,
    getProxy,
    timeoutMs,
  });
  if ("reason" in next) return { html: null, error: next.reason };

  let retry;
  try {
    retry = await fetchPage(pageUrl, {
      headers: { ...ADIFY_HEADERS, "user-agent": next.ua },
      cookie: next.cookie,
      timeoutMs: ADIFY_FIXIE_FETCH_TIMEOUT_MS,
      proxyUrl: next.proxyUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { html: null, error: `Adify pēc CapSolver: ${msg.slice(0, 160)}` };
  }

  if (isCloudflareChallengeHtml(retry.text, retry.status)) {
    return { html: null, error: "Adify Cloudflare palika lapā pēc CapSolver" };
  }
  if (!pageLooksUseful(retry.text, retry.status)) {
    return { html: null, error: `Adify pēc CapSolver: HTTP ${retry.status}` };
  }
  return { html: retry.text, error: null };
}
