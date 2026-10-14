import "server-only";

import {
  getCaptchaSolverProxy,
  hasCaptchaSolverKey,
  httpProxyUrlFromCapsolver,
  solveCaptcha,
  vinStickyHttpProxyUrl,
} from "@/lib/captcha-solver";
import {
  cookiesRecordToHeader,
  extractInputValue,
  htmlForCloudflareSolver,
  isCloudflareChallengeHtml,
  looksLikeCloudflareWafBlock,
  mergeCookieHeader,
} from "@/lib/vin-sources/html-extract";
import { VIN_HTTP_UA, vinHttpFetch, type VinHttpResult } from "@/lib/vin-sources/http";

export type ScanHttpResult = {
  status: number;
  text: string;
  cookie: string;
  ua?: string;
  proxyUrl?: string;
  finalUrl?: string;
  /** CapSolver neapgāja Cloudflare; zonde drīkst to pateikt, nevis parsēt challenge HTML. */
  challengeReason?: string;
};

const DEFAULT_TIMEOUT_MS = 12_000;

function recaptchaSiteKey(html: string): string {
  return (
    extractInputValue(html, "recaptcha") ||
    html.match(/data-sitekey="([^"]+)"/i)?.[1]?.trim() ||
    html.match(/grecaptcha\.execute\(\s*['"]([^'"]+)['"]/i)?.[1]?.trim() ||
    html.match(/sitekey['"]?\s*[:=]\s*['"]([^'"]+)['"]/i)?.[1]?.trim() ||
    ""
  );
}

function turnstileSiteKey(html: string): string {
  return html.match(/data-sitekey="([^"]+)"[^>]*turnstile|turnstile[^>]*data-sitekey="([^"]+)"/i)?.[1]?.trim()
    || html.match(/challenges\.cloudflare\.com\/turnstile[^"]*["']\s*,\s*\{[^}]*sitekey:\s*['"]([^'"]+)/i)?.[1]?.trim()
    || "";
}

export async function scanFetch(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    cookie?: string;
    timeoutMs?: number;
    proxyUrl?: string;
  } = {},
): Promise<ScanHttpResult> {
  const res = await vinHttpFetch(url, {
    method: init.method,
    headers: {
      "accept-language": "en,da;q=0.8,lv;q=0.7,nl;q=0.6",
      ...init.headers,
    },
    body: init.body,
    cookie: init.cookie,
    timeoutMs: init.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    proxyUrl: init.proxyUrl,
  });
  const ua = init.headers?.["user-agent"] || VIN_HTTP_UA;
  return {
    status: res.status,
    text: res.text,
    cookie: res.cookie,
    ua,
    proxyUrl: init.proxyUrl,
    finalUrl: res.finalUrl,
  };
}

async function bypassCloudflare(websiteURL: string, challenged: VinHttpResult, ua: string): Promise<
  { cookie: string; ua: string; proxyUrl?: string } | { reason: string }
> {
  if (!hasCaptchaSolverKey()) return { reason: "Cloudflare: nav CAPSOLVER_API_KEY" };
  const proxy = getCaptchaSolverProxy();
  if (!proxy) return { reason: "Cloudflare Challenge vajag CAPSOLVER_PROXY vai FIXIE_URL" };
  const html = htmlForCloudflareSolver(challenged.text, challenged.status);
  const solved = await solveCaptcha(
    {
      kind: "cloudflare_challenge",
      websiteURL,
      proxy,
      ...(html ? { html } : {}),
      userAgent: ua,
    },
    { timeoutMs: 90_000, sourceLabel: "vin-scan" },
  );
  if (!solved.ok) return { reason: solved.reason };
  const fromCookies = cookiesRecordToHeader(solved.cookies);
  const clearance = fromCookies || (solved.token ? `cf_clearance=${solved.token}` : "");
  if (!clearance) return { reason: "CapSolver: cf_clearance tukšs" };
  const solvedProxy = solved.proxy?.trim() || proxy;
  return {
    cookie: mergeCookieHeader(challenged.cookie, clearance),
    ua: solved.userAgent || ua,
    proxyUrl: httpProxyUrlFromCapsolver(solvedProxy) ?? vinStickyHttpProxyUrl(),
  };
}

/**
 * HTTP ielase ar CapSolver: Cloudflare Challenge, reCAPTCHA v2 un Turnstile.
 * Operators neapstiprina captcha. Ja risinātāja nav, atgriež lapu kā ir (zonde interpretē).
 */
export async function scanFetchSmart(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    cookie?: string;
    timeoutMs?: number;
    solveUrl?: string;
    sourceLabel?: string;
    userAgent?: string;
    /**
     * stat.vin: also treat short/plaintext WAF 403 as Cloudflare (CapSolver without HTML).
     * Other sources (LT policija): only real JS challenge pages, same as pre-#149.
     */
    wafBypass?: boolean;
  } = {},
): Promise<ScanHttpResult> {
  const timeoutMs = init.timeoutMs ?? 20_000;
  const headers = init.headers ?? {};
  let cookie = init.cookie ?? "";
  let ua = init.userAgent || VIN_HTTP_UA;
  let proxyUrl = vinStickyHttpProxyUrl();
  const isCfBlock = (text: string, status: number) =>
    init.wafBypass ? looksLikeCloudflareWafBlock(text, status) : isCloudflareChallengeHtml(text, status);
  const first = await vinHttpFetch(url, {
    method: init.method,
    headers: { "user-agent": ua, ...headers },
    body: init.body,
    cookie,
    timeoutMs,
    proxyUrl,
  });
  cookie = mergeCookieHeader(cookie, first.cookie);

  if (isCfBlock(first.text, first.status)) {
    const bypassed = await bypassCloudflare(init.solveUrl || url, { ...first, cookie }, ua);
    if ("reason" in bypassed) {
      return {
        status: first.status,
        text: first.text,
        cookie,
        ua,
        proxyUrl,
        finalUrl: first.finalUrl,
        challengeReason: bypassed.reason,
      };
    }
    cookie = bypassed.cookie;
    ua = bypassed.ua;
    proxyUrl = bypassed.proxyUrl ?? proxyUrl;
    const retry = await vinHttpFetch(url, {
      method: init.method,
      headers: { "user-agent": ua, ...headers },
      body: init.body,
      cookie,
      timeoutMs,
      proxyUrl,
    });
    const merged = {
      status: retry.status,
      text: retry.text,
      cookie: mergeCookieHeader(cookie, retry.cookie),
      ua,
      proxyUrl,
      finalUrl: retry.finalUrl,
    };
    if (isCfBlock(retry.text, retry.status)) {
      return { ...merged, challengeReason: "Cloudflare palika lapā pēc CapSolver" };
    }
    return merged;
  }

  const recaptchaKey = recaptchaSiteKey(first.text);
  const looksCaptcha = /recaptcha|hcaptcha|i['’]m not a robot|\bcaptcha\b/i.test(first.text);
  if (looksCaptcha && recaptchaKey && hasCaptchaSolverKey()) {
    const capProxy = getCaptchaSolverProxy();
    const solved = await solveCaptcha(
      {
        kind: "recaptcha_v2",
        websiteURL: init.solveUrl || url,
        websiteKey: recaptchaKey,
        proxy: capProxy || undefined,
      },
      { timeoutMs: 90_000, sourceLabel: init.sourceLabel || "vin-scan" },
    );
    if (solved.ok) {
      return {
        status: first.status,
        text: first.text,
        cookie: mergeCookieHeader(cookie, cookiesRecordToHeader(solved.cookies)),
        ua: solved.userAgent || ua,
        finalUrl: first.finalUrl,
      };
    }
  }

  const tsKey = turnstileSiteKey(first.text);
  if (/turnstile/i.test(first.text) && tsKey && hasCaptchaSolverKey()) {
    const solved = await solveCaptcha(
      { kind: "turnstile", websiteURL: init.solveUrl || url, websiteKey: tsKey },
      { timeoutMs: 90_000, sourceLabel: init.sourceLabel || "vin-scan" },
    );
    if (solved.ok) {
      return {
        status: first.status,
        text: first.text,
        cookie: mergeCookieHeader(cookie, cookiesRecordToHeader(solved.cookies)),
        ua: solved.userAgent || ua,
        finalUrl: first.finalUrl,
      };
    }
  }

  return { status: first.status, text: first.text, cookie, ua, proxyUrl, finalUrl: first.finalUrl };
}

export function scanChallengeReason(res: ScanHttpResult): string | null {
  if (res.challengeReason) return res.challengeReason;
  if (isCloudflareChallengeHtml(res.text, res.status)) return "Cloudflare palika lapā";
  return null;
}

export function scanCaptchaTokenPlaceholder(html: string): { kind: "recaptcha_v2" | "turnstile"; siteKey: string } | null {
  const recaptchaKey = recaptchaSiteKey(html);
  if (recaptchaKey) return { kind: "recaptcha_v2", siteKey: recaptchaKey };
  const ts = turnstileSiteKey(html);
  if (ts) return { kind: "turnstile", siteKey: ts };
  return null;
}

export async function solveScanRecaptcha(websiteURL: string, websiteKey: string, sourceLabel: string): Promise<
  { ok: true; token: string; cookie: string; ua: string } | { ok: false; reason: string }
> {
  if (!hasCaptchaSolverKey()) return { ok: false, reason: `${sourceLabel}: nav CAPSOLVER_API_KEY` };
  const capProxy = getCaptchaSolverProxy();
  const solved = await solveCaptcha(
    { kind: "recaptcha_v2", websiteURL, websiteKey, proxy: capProxy || undefined },
    { timeoutMs: 90_000, sourceLabel },
  );
  if (!solved.ok) return { ok: false, reason: solved.reason };
  return {
    ok: true,
    token: solved.token,
    cookie: cookiesRecordToHeader(solved.cookies),
    ua: solved.userAgent || VIN_HTTP_UA,
  };
}
