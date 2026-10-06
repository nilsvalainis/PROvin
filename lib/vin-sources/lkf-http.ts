import "server-only";

import { solveCaptcha } from "@/lib/captcha-solver";
import { parseLkfExtract } from "@/lib/vin-sources/estonia-parse";
import { extractInputValue, extractPageFromHtml } from "@/lib/vin-sources/html-extract";
import { vinHttpFetch } from "@/lib/vin-sources/http";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const LKF_URL = "https://lkf.ee/et/kahjukontroll";
const LKF_SITE_KEY = "6LdtedISAAAAABWNkw4vodbhMcB1SZ-ykU6A04fL";

export async function fetchLkfHttp(vin: string): Promise<VinSourceFetchResult> {
  const page = await vinHttpFetch(LKF_URL, {
    headers: { referer: "https://lkf.ee/" },
  });
  if (page.status >= 400 || !page.text) {
    return emptyVinSourceResult("lkf_ee", vin, `lkf.ee atbildēja ar HTTP ${page.status}`);
  }

  const formBuildId = extractInputValue(page.text, "form_build_id");
  const formId = extractInputValue(page.text, "form_id") || "history_traffic_accidents_form";
  const captchaSid = extractInputValue(page.text, "captcha_sid");
  const captchaToken = extractInputValue(page.text, "captcha_token");
  if (!formBuildId) {
    return emptyVinSourceResult("lkf_ee", vin, "lkf.ee forma nav nolasāma");
  }

  const solved = await solveCaptcha({
    kind: "recaptcha_v2",
    websiteURL: LKF_URL,
    websiteKey: LKF_SITE_KEY,
  });
  if (!solved.ok) return emptyVinSourceResult("lkf_ee", vin, solved.reason);

  const body = new URLSearchParams({
    form_build_id: formBuildId,
    form_id: formId,
    vehicle: vin,
    captcha_sid: captchaSid,
    captcha_token: captchaToken,
    captcha_response: solved.token,
    "g-recaptcha-response": solved.token,
    op: "Otsi",
  });

  const posted = await vinHttpFetch(LKF_URL, {
    method: "POST",
    cookie: page.cookie,
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: "https://lkf.ee",
      referer: LKF_URL,
    },
    body: body.toString(),
  });
  if (posted.status >= 400) {
    return emptyVinSourceResult("lkf_ee", vin, `lkf.ee atbildēja ar HTTP ${posted.status}`);
  }

  return parseLkfExtract(vin, extractPageFromHtml(posted.text));
}
