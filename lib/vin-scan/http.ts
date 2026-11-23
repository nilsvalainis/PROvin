import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import {
  getCaptchaSolverProxy,
  hasCaptchaSolverKey,
  httpProxyUrlFromCapsolver,
  solveCaptcha,
  vinStickyHttpProxyUrl,
} from "@/lib/captcha-solver";
import { CAPSOLVER_MIN_TIMEOUT_MS, capsolverTimeoutMs } from "@/lib/vin-scan/source-timeouts";
import {
  cookiesRecordToHeader,
  extractInputValue,
  isCloudflareChallengeHtml,
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
  /** Lapā ir reCAPTCHA/Turnstile, kas netika atrisināta (nav pieprasīts vai neizdevās). */
  captchaReason?: string;
  /** Tikai ar `captcha: "solve"`: atrisinātais žetons, kas zondei jāiesniedz formā. */
  captchaToken?: string;
  captchaKind?: ScanCaptchaKind;
};

export type ScanCaptchaKind = "recaptcha_v2" | "turnstile";

const DEFAULT_TIMEOUT_MS = 12_000;

type VinScanDeadline = { deadlineMs: number };

const vinScanDeadline = new AsyncLocalStorage<VinScanDeadline>();

/** Avota ārējais timeout. CapSolver nedrīkst turpināties pēc šī brīža. */
export function runWithVinScanDeadline<T>(deadlineMs: number, run: () => Promise<T>): Promise<T> {
  return vinScanDeadline.run({ deadlineMs }, run);
}

/** Pašreizējā VIN SCAN avota ārējais termiņš (epoch ms) vai `undefined` ārpus skenēšanas. */
export function currentVinScanDeadlineMs(): number | undefined {
  return vinScanDeadline.getStore()?.deadlineMs;
}

function solverBudgetMs(localTimeoutMs: number, startedAt: number, now = Date.now()): number {
  const localRemain = localTimeoutMs - (now - startedAt);
  const slot = vinScanDeadline.getStore();
  const outerRemain = slot ? slot.deadlineMs - now : localRemain;
  const remain = Math.min(localRemain, outerRemain);
  if (remain <= 0) return 0;
  return capsolverTimeoutMs(remain, 0);
}

/**
 * CapSolver budžets ārējam izsaucējam (piem. lkf.ee): VIN SCAN avota termiņa iekšienē
 * atlikušais laiks mīnus rezerve, ārpus VIN SCAN (apmaksāts pasūtījums) - `fallbackMs`.
 */
export function vinScanSolverBudgetMs(fallbackMs: number, now = Date.now()): number {
  const slot = vinScanDeadline.getStore();
  if (!slot) return fallbackMs;
  return capsolverTimeoutMs(slot.deadlineMs - now, 0);
}

function solverCallOpts(localTimeoutMs: number, startedAt: number, sourceLabel: string): { timeoutMs: number; sourceLabel: string } | null {
  const budget = solverBudgetMs(localTimeoutMs, startedAt);
  if (budget < CAPSOLVER_MIN_TIMEOUT_MS) return null;
  return { timeoutMs: budget, sourceLabel };
}

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

function detectCaptcha(html: string): { kind: ScanCaptchaKind; siteKey: string } | null {
  const recaptchaKey = recaptchaSiteKey(html);
  if (recaptchaKey && /recaptcha|hcaptcha|i['’]m not a robot|\bcaptcha\b/i.test(html)) {
    return { kind: "recaptcha_v2", siteKey: recaptchaKey };
  }
  const tsKey = turnstileSiteKey(html);
  if (tsKey && /turnstile/i.test(html)) return { kind: "turnstile", siteKey: tsKey };
  return null;
}

function captchaLabel(kind: ScanCaptchaKind): string {
  return kind === "turnstile" ? "Turnstile" : "reCAPTCHA";
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

async function bypassCloudflare(
  websiteURL: string,
  challenged: VinHttpResult,
  ua: string,
  solver: { timeoutMs: number; sourceLabel: string } | null,
): Promise<{ cookie: string; ua: string; proxyUrl?: string } | { reason: string }> {
  if (!solver) return { reason: "CapSolver izlaists: avota laiks ir beidzies" };
  if (!hasCaptchaSolverKey()) return { reason: "Cloudflare: nav CAPSOLVER_API_KEY" };
  const proxy = getCaptchaSolverProxy();
  if (!proxy) return { reason: "Cloudflare Challenge vajag CAPSOLVER_PROXY vai FIXIE_URL" };
  const solved = await solveCaptcha(
    {
      kind: "cloudflare_challenge",
      websiteURL,
      proxy,
      html: challenged.text.slice(0, 80_000),
      userAgent: ua,
    },
    solver,
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
 * HTTP ielase ar Cloudflare Challenge apiešanu (cf_clearance sīkdatnes tiek izmantotas).
 * reCAPTCHA v2 / Turnstile risina TIKAI ar `captcha: "solve"` un tad atgriež `captchaToken`,
 * ko zondei pašai jāiesniedz formā. Bez tā lapa ar captcha atgriežas ar `captchaReason`
 * un CapSolver netiek saukts (žetons bez formas iesniegšanas ir tikai izmaksas).
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
    captcha?: "solve";
  } = {},
): Promise<ScanHttpResult> {
  const timeoutMs = init.timeoutMs ?? 20_000;
  const startedAt = Date.now();
  const sourceLabel = init.sourceLabel || "vin-scan";
  const headers = init.headers ?? {};
  let cookie = init.cookie ?? "";
  let ua = init.userAgent || VIN_HTTP_UA;
  let proxyUrl = vinStickyHttpProxyUrl();
  const first = await vinHttpFetch(url, {
    method: init.method,
    headers: { "user-agent": ua, ...headers },
    body: init.body,
    cookie,
    timeoutMs,
    proxyUrl,
  });
  cookie = mergeCookieHeader(cookie, first.cookie);

  if (isCloudflareChallengeHtml(first.text, first.status)) {
    const bypassed = await bypassCloudflare(
      init.solveUrl || url,
      { ...first, cookie },
      ua,
      solverCallOpts(timeoutMs, startedAt, sourceLabel),
    );
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
    if (isCloudflareChallengeHtml(retry.text, retry.status)) {
      return { ...merged, challengeReason: "Cloudflare palika lapā pēc CapSolver" };
    }
    return merged;
  }

  const page: ScanHttpResult = { status: first.status, text: first.text, cookie, ua, proxyUrl, finalUrl: first.finalUrl };
  const captcha = detectCaptcha(first.text);
  if (!captcha) return page;
  const label = captchaLabel(captcha.kind);
  if (init.captcha !== "solve") {
    return { ...page, captchaReason: `lapa prasa ${label}, automātiski to nerisinām` };
  }
  if (!hasCaptchaSolverKey()) return { ...page, captchaReason: `${label}: nav CAPSOLVER_API_KEY` };
  const budget = solverCallOpts(timeoutMs, startedAt, sourceLabel);
  if (!budget) return { ...page, captchaReason: `${label}: CapSolver izlaists, avota laiks ir beidzies` };
  const capProxy = captcha.kind === "recaptcha_v2" ? getCaptchaSolverProxy() : "";
  const solved = await solveCaptcha(
    captcha.kind === "recaptcha_v2"
      ? { kind: "recaptcha_v2", websiteURL: init.solveUrl || url, websiteKey: captcha.siteKey, proxy: capProxy || undefined }
      : { kind: "turnstile", websiteURL: init.solveUrl || url, websiteKey: captcha.siteKey },
    budget,
  );
  if (!solved.ok) return { ...page, captchaReason: `${label}: ${solved.reason}` };
  if (!solved.token) return { ...page, captchaReason: `${label}: CapSolver atgrieza tukšu žetonu` };
  return {
    ...page,
    cookie: mergeCookieHeader(cookie, cookiesRecordToHeader(solved.cookies)),
    ua: solved.userAgent || ua,
    captchaToken: solved.token,
    captchaKind: captcha.kind,
  };
}

export function scanChallengeReason(res: {
  status: number;
  text: string;
  challengeReason?: string;
}): string | null {
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
  const budget = vinScanSolverBudgetMs(capsolverTimeoutMs(90_000, 0));
  if (budget < CAPSOLVER_MIN_TIMEOUT_MS) return { ok: false, reason: `${sourceLabel}: CapSolver izlaists, avota laiks ir beidzies` };
  const capProxy = getCaptchaSolverProxy();
  const solved = await solveCaptcha(
    { kind: "recaptcha_v2", websiteURL, websiteKey, proxy: capProxy || undefined },
    { timeoutMs: budget, sourceLabel },
  );
  if (!solved.ok) return { ok: false, reason: solved.reason };
  return {
    ok: true,
    token: solved.token,
    cookie: cookiesRecordToHeader(solved.cookies),
    ua: solved.userAgent || VIN_HTTP_UA,
  };
}
