import "server-only";

/**
 * eteenindus.mnt.ee HTTP: reCAPTCHA v3 ProxyLess, forma no Vercel IP.
 * Cloudflare Challenge joprojām CapSolver + Fixie. CAPSOLVER_FORCE_PROXY=1 = vecais ceļš.
 */

import {
  CAPSOLVER_PROXIED_TIMEOUT_MS,
  CAPSOLVER_PROXYLESS_TIMEOUT_MS,
  getCaptchaSolverProxy,
  httpProxyUrlFromCapsolver,
  mntFormHttpProxyUrl,
  mntRecaptchaV3Proxy,
  prefixCaptchaSourceReason,
  solveCaptcha,
} from "@/lib/captcha-solver";
import { parseMntExtract } from "@/lib/vin-sources/estonia-parse";
import {
  cookiesRecordToHeader,
  extractInputValue,
  extractPageFromHtml,
  extractPartialUpdateHtml,
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
  if (!proxy) return { reason: "mnt.ee Cloudflare Challenge vajag CAPSOLVER_PROXY vai FIXIE_URL" };
  const solved = await solveCaptcha(
    {
      kind: "cloudflare_challenge",
      websiteURL: MNT_URL,
      proxy,
      html: challenged.text.slice(0, 80_000),
      userAgent: session.ua,
    },
    { timeoutMs: 90_000, sourceLabel: "mnt.ee" },
  );
  if (!solved.ok) return { reason: solved.reason };
  const fromCookies = cookiesRecordToHeader(solved.cookies);
  const clearance = fromCookies || (solved.token ? `cf_clearance=${solved.token}` : "");
  if (!clearance) return { reason: prefixCaptchaSourceReason("CapSolver: cf_clearance tukšs", "mnt.ee") };
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
    return { reason: "mnt.ee Cloudflare netika apietas" };
  }
  return { res, session: next };
}

export async function fetchMntHttp(vin: string, regMark = ""): Promise<VinSourceFetchResult> {
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
  session = loaded.session;
  if (page.status >= 400 || !page.text) {
    return fail(vin, `mnt.ee atbildēja ar HTTP ${page.status}`, page.text);
  }
  if (isCloudflareChallengeHtml(page.text, page.status)) {
    return fail(vin, "mnt.ee Cloudflare Challenge netika apietas", page.text);
  }

  const viewState = extractInputValue(page.text, "javax.faces.ViewState");
  const ajaxSource = parseMntAjaxSource(page.text);
  if (!viewState || !ajaxSource) {
    return fail(vin, "mnt.ee forma nav nolasāma", page.text);
  }

  const capProxy = mntRecaptchaV3Proxy();
  const solved = await solveCaptcha(
    {
      kind: "recaptcha_v3",
      websiteURL: MNT_URL,
      websiteKey: MNT_SITE_KEY,
      pageAction: MNT_ACTION,
      proxy: capProxy,
    },
    {
      timeoutMs: capProxy ? CAPSOLVER_PROXIED_TIMEOUT_MS : CAPSOLVER_PROXYLESS_TIMEOUT_MS,
      sourceLabel: "mnt.ee",
    },
  );
  if (!solved.ok) return fail(vin, solved.reason, page.text);

  session = {
    ...session,
    cookie: mergeCookieHeader(page.cookie, cookiesRecordToHeader(solved.cookies)),
    ua: solved.userAgent || session.ua,
  };

  const body = new URLSearchParams({
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": ajaxSource,
    "javax.faces.partial.execute": "soidukOtsingForm",
    "javax.faces.partial.render": "soidukOtsingForm",
    [ajaxSource]: ajaxSource,
    soidukOtsingForm: "soidukOtsingForm",
    "soidukOtsingForm:regMark": regMark,
    "soidukOtsingForm:vinKood": vin,
    "soidukOtsingForm:recaptchaResponse": solved.token,
    "javax.faces.ViewState": viewState,
  });

  let ajax: VinHttpResult;
  try {
    ajax = await vinHttpFetch(MNT_URL, {
      method: "POST",
      cookie: session.cookie,
      proxyUrl: session.proxyUrl,
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "faces-request": "partial/ajax",
        origin: "https://eteenindus.mnt.ee",
        referer: MNT_URL,
        "x-requested-with": "XMLHttpRequest",
        "user-agent": session.ua,
      },
      body: body.toString(),
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 180) : "kļūda";
    return fail(vin, `mnt.ee AJAX ielase neizdevās (${detail})`, page.text);
  }
  if (ajax.status >= 400) {
    return fail(vin, `mnt.ee AJAX atbildēja ar HTTP ${ajax.status}`, ajax.text);
  }

  const html = extractPartialUpdateHtml(ajax.text);
  return parseMntExtract(vin, extractPageFromHtml(html));
}
