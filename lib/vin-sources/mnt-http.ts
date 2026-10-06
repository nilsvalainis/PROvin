import "server-only";

/**
 * eteenindus.mnt.ee HTTP: forma no Vercel IP, reCAPTCHA v3 ProxyLess.
 *
 * Lapa ir aiz Cloudflare, bet parasti atbild HTTP 200 ar formu (bez challenge). Katrā lapā ir
 * Cloudflare Bot Management bāka `/cdn-cgi/challenge-platform/scripts/jsd/main.js`; to NEDRĪKST
 * uzskatīt par challenge (skat. isCloudflareChallengeHtml). Īsts challenge joprojām iet caur
 * CapSolver AntiCloudflareTask + Fixie, un kļūda tiek apzīmēta kā „mnt.ee Cloudflare: …”.
 *
 * Ja mnt.ee noraida standarta V3 žetonu („reCAPTCHA valideerimise viga”), vienu reizi mēģina
 * CapSolver M1 žetonu tajā pašā JSF sesijā. CAPSOLVER_FORCE_PROXY=1 = vecais ceļš caur Fixie.
 */

import {
  CAPSOLVER_PROXIED_TIMEOUT_MS,
  CAPSOLVER_PROXYLESS_TIMEOUT_MS,
  captchaTaskTypeName,
  getCaptchaSolverProxy,
  httpProxyUrlFromCapsolver,
  isMntRecaptchaM1FallbackEnabled,
  mntFormHttpProxyUrl,
  mntRecaptchaV3Proxy,
  prefixCaptchaSourceReason,
  solveCaptcha,
  type RecaptchaV3Task,
} from "@/lib/captcha-solver";
import { MNT_CAPTCHA_REJECTED_MESSAGE, mntCaptchaRejectedMessage, parseMntExtract } from "@/lib/vin-sources/estonia-parse";
import {
  cookiesRecordToHeader,
  extractInputValue,
  extractPageFromHtml,
  extractPartialUpdateHtml,
  extractPartialViewState,
  isCloudflareChallengeHtml,
  mergeCookieHeader,
  parseMntAjaxSource,
} from "@/lib/vin-sources/html-extract";
import { VIN_HTTP_UA, vinHttpFetch, type VinHttpResult } from "@/lib/vin-sources/http";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const MNT_URL = "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf";
const MNT_SITE_KEY = "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa";
const MNT_ACTION = "soiduk_otsing";
const FETCH_TIMEOUT_MS = 45_000;
/** Admin fetch pārtrauc pēc 280 s, route maxDuration 300 s: viss mnt.ee ceļš ietilpst 240 s. */
const MNT_TOTAL_BUDGET_MS = 240_000;
/** M1 rezervi sāk tikai tad, ja vēl pietiek laika CapSolver + POST. */
const MNT_MIN_RETRY_BUDGET_MS = 60_000;
const CF_LABEL = "mnt.ee Cloudflare";

function fail(vin: string, message: string, raw = ""): VinSourceFetchResult {
  return { ...emptyVinSourceResult("mnt_ee", vin, message), raw: raw.slice(0, 20_000) };
}

type Session = { cookie: string; ua: string; proxyUrl?: string };

async function getPage(session: Session): Promise<VinHttpResult> {
  return vinHttpFetch(MNT_URL, {
    cookie: session.cookie,
    proxyUrl: session.proxyUrl,
    timeoutMs: FETCH_TIMEOUT_MS,
    headers: {
      referer: "https://eteenindus.mnt.ee/",
      "user-agent": session.ua,
    },
  });
}

async function bypassCloudflare(challenged: VinHttpResult, session: Session): Promise<Session | { reason: string }> {
  const proxy = getCaptchaSolverProxy();
  if (!proxy) return { reason: `${CF_LABEL}: Challenge vajag CAPSOLVER_PROXY vai FIXIE_URL` };
  const solved = await solveCaptcha(
    {
      kind: "cloudflare_challenge",
      websiteURL: MNT_URL,
      proxy,
      html: challenged.text.slice(0, 80_000),
      userAgent: session.ua,
    },
    { timeoutMs: 90_000, sourceLabel: CF_LABEL },
  );
  if (!solved.ok) return { reason: solved.reason };
  const fromCookies = cookiesRecordToHeader(solved.cookies);
  const clearance = fromCookies || (solved.token ? `cf_clearance=${solved.token}` : "");
  if (!clearance) return { reason: prefixCaptchaSourceReason("CapSolver: cf_clearance tukšs", CF_LABEL) };
  return {
    cookie: mergeCookieHeader(session.cookie, clearance),
    ua: solved.userAgent || session.ua,
    proxyUrl: httpProxyUrlFromCapsolver(proxy) ?? session.proxyUrl,
  };
}

async function loadMntForm(session: Session): Promise<{ res: VinHttpResult; session: Session } | { reason: string }> {
  let res = await getPage(session);
  if (!isCloudflareChallengeHtml(res.text, res.status)) return { res, session };
  const next = await bypassCloudflare(res, session);
  if ("reason" in next) return next;
  res = await getPage(next);
  if (isCloudflareChallengeHtml(res.text, res.status)) {
    return { reason: `${CF_LABEL}: Challenge netika apietas (HTTP ${res.status})` };
  }
  return { res, session: next };
}

/** Kā reālais pārlūks: otsiAction remoteCommand ar `soidukOtsingForm:recaptchaResponse`. */
function buildMntAjaxBody(input: {
  ajaxSource: string;
  regMark: string;
  vin: string;
  token: string;
  viewState: string;
}): string {
  return new URLSearchParams({
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": input.ajaxSource,
    "javax.faces.partial.execute": "soidukOtsingForm",
    "javax.faces.partial.render": "soidukOtsingForm",
    [input.ajaxSource]: input.ajaxSource,
    soidukOtsingForm: "soidukOtsingForm",
    "soidukOtsingForm:regMark": input.regMark,
    "soidukOtsingForm:vinKood": input.vin,
    "soidukOtsingForm:recaptchaResponse": input.token,
    "javax.faces.ViewState": input.viewState,
  }).toString();
}

type SubmitOutcome =
  | { kind: "result"; result: VinSourceFetchResult }
  | { kind: "captcha_rejected"; taskType: string; nextViewState: string; raw: string };

async function solveAndSubmit(input: {
  vin: string;
  regMark: string;
  ajaxSource: string;
  viewState: string;
  page: VinHttpResult;
  session: Session;
  variant: RecaptchaV3Task["variant"];
  /** Atlikušais budžets CapSolver žetonam; nepārsniedz noklusējuma ProxyLess / proxied laiku. */
  solveTimeoutMs: number;
}): Promise<SubmitOutcome> {
  const { vin, page } = input;
  const capProxy = mntRecaptchaV3Proxy();
  const task: RecaptchaV3Task = {
    kind: "recaptcha_v3",
    websiteURL: MNT_URL,
    websiteKey: MNT_SITE_KEY,
    pageAction: MNT_ACTION,
    proxy: capProxy,
    variant: input.variant,
  };
  const taskType = captchaTaskTypeName(task);
  const solved = await solveCaptcha(task, {
    timeoutMs: Math.min(capProxy ? CAPSOLVER_PROXIED_TIMEOUT_MS : CAPSOLVER_PROXYLESS_TIMEOUT_MS, input.solveTimeoutMs),
    sourceLabel: "mnt.ee",
  });
  if (!solved.ok) return { kind: "result", result: fail(vin, `${solved.reason} [${taskType}]`, page.text) };

  const session: Session = {
    ...input.session,
    cookie: mergeCookieHeader(input.session.cookie, cookiesRecordToHeader(solved.cookies)),
    ua: solved.userAgent || input.session.ua,
  };

  let ajax: VinHttpResult;
  try {
    ajax = await vinHttpFetch(MNT_URL, {
      method: "POST",
      cookie: session.cookie,
      proxyUrl: session.proxyUrl,
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: {
        accept: "application/xml, text/xml, */*; q=0.01",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "faces-request": "partial/ajax",
        origin: "https://eteenindus.mnt.ee",
        referer: MNT_URL,
        "x-requested-with": "XMLHttpRequest",
        "user-agent": session.ua,
      },
      body: buildMntAjaxBody({
        ajaxSource: input.ajaxSource,
        regMark: input.regMark,
        vin,
        token: solved.token,
        viewState: input.viewState,
      }),
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 180) : "kļūda";
    return { kind: "result", result: fail(vin, `mnt.ee AJAX ielase neizdevās (${detail})`, page.text) };
  }
  if (ajax.status >= 400) {
    return { kind: "result", result: fail(vin, `mnt.ee AJAX atbildēja ar HTTP ${ajax.status}`, ajax.text) };
  }

  const html = extractPartialUpdateHtml(ajax.text);
  const result = parseMntExtract(vin, extractPageFromHtml(html));
  if (result.message === MNT_CAPTCHA_REJECTED_MESSAGE) {
    console.warn("[mnt.ee] reCAPTCHA valideerimise viga", { taskType, proxied: Boolean(session.proxyUrl) });
    return {
      kind: "captcha_rejected",
      taskType,
      nextViewState: extractPartialViewState(ajax.text) || input.viewState,
      raw: ajax.text,
    };
  }
  return { kind: "result", result };
}

export async function fetchMntHttp(vin: string, regMark = ""): Promise<VinSourceFetchResult> {
  const deadline = Date.now() + MNT_TOTAL_BUDGET_MS;
  const proxyUrl = mntFormHttpProxyUrl();
  let session: Session = { cookie: "", ua: VIN_HTTP_UA, proxyUrl };

  let loaded: { res: VinHttpResult; session: Session };
  try {
    const passed = await loadMntForm(session);
    if ("reason" in passed) return fail(vin, passed.reason);
    loaded = passed;
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 180) : "kļūda";
    return fail(vin, `mnt.ee HTTP ielase neizdevās (${detail})`);
  }

  const page = loaded.res;
  session = { ...loaded.session, cookie: mergeCookieHeader(loaded.session.cookie, page.cookie) };
  if (page.status >= 400 || !page.text) {
    return fail(vin, `mnt.ee atbildēja ar HTTP ${page.status}`, page.text);
  }

  const viewState = extractInputValue(page.text, "javax.faces.ViewState");
  const ajaxSource = parseMntAjaxSource(page.text);
  if (!viewState || !ajaxSource) {
    return fail(vin, "mnt.ee forma nav nolasāma", page.text);
  }

  const rejected: string[] = [];
  let currentViewState = viewState;
  let lastRaw = page.text;
  const variants: RecaptchaV3Task["variant"][] = isMntRecaptchaM1FallbackEnabled() ? ["standard", "m1"] : ["standard"];
  for (const variant of variants) {
    const remaining = deadline - Date.now();
    if (variant !== "standard" && remaining < MNT_MIN_RETRY_BUDGET_MS) break;
    const outcome = await solveAndSubmit({
      vin,
      regMark,
      ajaxSource,
      viewState: currentViewState,
      page,
      session,
      variant,
      solveTimeoutMs: Math.max(15_000, remaining - FETCH_TIMEOUT_MS),
    });
    if (outcome.kind === "result") return outcome.result;
    rejected.push(outcome.taskType);
    currentViewState = outcome.nextViewState;
    lastRaw = outcome.raw;
  }
  return fail(vin, mntCaptchaRejectedMessage(rejected), lastRaw);
}
