import "server-only";

/**
 * Adify.lv/history: Hetzner Chrome (18 s) un Fixie bez captcha paliek
 * Cloudflare managed „Just a moment”. CapSolver AntiCloudflareTask + Fixie
 * ir tas pats ceļš, kas car.info / mnt.ee / VIN SCAN.
 *
 * api.adify.lv/api/v1/history/... atgriež application/problem+json 403
 * (nginx, nav CF) - to nemēģinām.
 */

import {
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

export type AdifyBypassDeps = {
  hasKey?: () => boolean;
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

/** Adify vēstures HTML caur Fixie + CapSolver AntiCloudflareTask (`cf_clearance`). */
export async function fetchAdifyHistoryHtmlViaCapsolver(
  pageUrl: string,
  deps: AdifyBypassDeps = {},
): Promise<AdifyBypassFetch> {
  const hasKey = deps.hasKey ?? hasCaptchaSolverKey;
  const getProxy = deps.getProxy ?? getCaptchaSolverProxy;
  const stickyProxyUrl = deps.stickyProxyUrl ?? vinStickyHttpProxyUrl;
  const solve = deps.solve ?? solveCaptcha;
  const fetchPage = deps.fetchPage ?? vinHttpFetch;
  const timeoutMs = deps.timeoutMs ?? ADIFY_CAPSOLVER_TIMEOUT_MS;

  if (!hasKey()) {
    return { html: null, error: "Adify CapSolver: nav CAPSOLVER_API_KEY" };
  }
  const proxy = getProxy();
  if (!proxy) {
    return { html: null, error: "Adify Cloudflare Challenge vajag CAPSOLVER_PROXY vai FIXIE_URL" };
  }

  let session: Session = {
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
    return { html: null, error: `Adify Fixie: ${msg.slice(0, 160)}` };
  }
  session.cookie = mergeCookieHeader(session.cookie, page.cookie);

  if (pageLooksUseful(page.text, page.status)) {
    return { html: page.text, error: null };
  }
  if (!isCloudflareChallengeHtml(page.text, page.status)) {
    return {
      html: null,
      error: `Adify Fixie: HTTP ${page.status}${page.text.trim() ? "" : ", tukša atbilde"}`,
    };
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
