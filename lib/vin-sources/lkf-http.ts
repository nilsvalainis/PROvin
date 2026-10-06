import "server-only";

import { getCaptchaSolverProxy, solveCaptcha, vinStickyHttpProxyUrl } from "@/lib/captcha-solver";
import { parseLkfExtract } from "@/lib/vin-sources/estonia-parse";
import {
  cookiesRecordToHeader,
  extractDrupalAjaxHtml,
  extractDrupalAjaxPageState,
  extractInnerHtmlById,
  extractInputValue,
  extractPageFromHtml,
  mergeCookieHeader,
} from "@/lib/vin-sources/html-extract";
import { vinHttpFetch } from "@/lib/vin-sources/http";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const LKF_URL = "https://lkf.ee/et/kahjukontroll";
const LKF_AJAX_URL = "https://lkf.ee/et/kahjukontroll?ajax_form=1&_wrapper_format=drupal_ajax";
const LKF_SITE_KEY = "6LdtedISAAAAABWNkw4vodbhMcB1SZ-ykU6A04fL";
const FETCH_TIMEOUT_MS = 45_000;

function fail(vin: string, message: string, raw = ""): VinSourceFetchResult {
  return { ...emptyVinSourceResult("lkf_ee", vin, message), raw: raw.slice(0, 20_000) };
}

function resultHtmlFromPosted(postedText: string): string {
  const ajax = extractDrupalAjaxHtml(postedText);
  if (ajax) return ajax;
  const inner = extractInnerHtmlById(postedText, "api-query-output");
  if (inner) return inner;
  return postedText;
}

export async function fetchLkfHttp(vin: string): Promise<VinSourceFetchResult> {
  const proxyUrl = vinStickyHttpProxyUrl();
  let page;
  try {
    page = await vinHttpFetch(LKF_URL, {
      proxyUrl,
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: { referer: "https://lkf.ee/" },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 180) : "kļūda";
    return fail(vin, `lkf.ee HTTP ielase neizdevās (${detail})`);
  }
  if (page.status >= 400 || !page.text) {
    return fail(vin, `lkf.ee atbildēja ar HTTP ${page.status}`, page.text);
  }

  const formBuildId = extractInputValue(page.text, "form_build_id");
  const formId = extractInputValue(page.text, "form_id") || "history_traffic_accidents_form";
  const captchaSid = extractInputValue(page.text, "captcha_sid");
  const captchaToken = extractInputValue(page.text, "captcha_token");
  if (!formBuildId) {
    return fail(vin, "lkf.ee forma nav nolasāma", page.text);
  }

  const capProxy = getCaptchaSolverProxy();
  const solved = await solveCaptcha({
    kind: "recaptcha_v2",
    websiteURL: LKF_URL,
    websiteKey: LKF_SITE_KEY,
    proxy: capProxy || undefined,
  });
  if (!solved.ok) return fail(vin, solved.reason, page.text);

  const cookie = mergeCookieHeader(page.cookie, cookiesRecordToHeader(solved.cookies));
  const body = new URLSearchParams({
    form_build_id: formBuildId,
    form_id: formId,
    vehicle: vin,
    captcha_sid: captchaSid,
    captcha_token: captchaToken,
    captcha_response: solved.token,
    captcha_cacheable: "1",
    "g-recaptcha-response": solved.token,
    op: "Otsi",
    _triggering_element_name: "op",
    _triggering_element_value: "Otsi",
    _drupal_ajax: "1",
    ...extractDrupalAjaxPageState(page.text),
  });

  let posted;
  try {
    posted = await vinHttpFetch(LKF_AJAX_URL, {
      method: "POST",
      cookie,
      proxyUrl,
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: {
        accept: "application/vnd.drupal-ajax, application/json, */*; q=0.01",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        origin: "https://lkf.ee",
        referer: LKF_URL,
        "x-requested-with": "XMLHttpRequest",
        ...(solved.userAgent ? { "user-agent": solved.userAgent } : {}),
      },
      body: body.toString(),
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 180) : "kļūda";
    return fail(vin, `lkf.ee AJAX ielase neizdevās (${detail})`, page.text);
  }
  if (posted.status >= 400) {
    return fail(vin, `lkf.ee atbildēja ar HTTP ${posted.status}`, posted.text);
  }

  const html = resultHtmlFromPosted(posted.text);
  if (!html.trim()) {
    return fail(vin, "lkf.ee AJAX atbilde bez rezultāta HTML", posted.text);
  }
  return parseLkfExtract(vin, extractPageFromHtml(html));
}
