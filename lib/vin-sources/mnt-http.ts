import "server-only";

import { solveCaptcha } from "@/lib/captcha-solver";
import { parseMntExtract } from "@/lib/vin-sources/estonia-parse";
import {
  extractInputValue,
  extractPageFromHtml,
  extractPartialUpdateHtml,
  parseMntAjaxSource,
} from "@/lib/vin-sources/html-extract";
import { vinHttpFetch } from "@/lib/vin-sources/http";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const MNT_URL = "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf";
const MNT_SITE_KEY = "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa";
const MNT_ACTION = "soiduk_otsing";

export async function fetchMntHttp(vin: string, regMark = ""): Promise<VinSourceFetchResult> {
  const page = await vinHttpFetch(MNT_URL, {
    headers: { referer: "https://eteenindus.mnt.ee/" },
  });
  if (page.status >= 400 || !page.text) {
    return emptyVinSourceResult("mnt_ee", vin, `mnt.ee atbildēja ar HTTP ${page.status}`);
  }

  const viewState = extractInputValue(page.text, "javax.faces.ViewState");
  const ajaxSource = parseMntAjaxSource(page.text);
  if (!viewState || !ajaxSource) {
    return emptyVinSourceResult("mnt_ee", vin, "mnt.ee forma nav nolasāma");
  }

  const solved = await solveCaptcha({
    kind: "recaptcha_v3",
    websiteURL: MNT_URL,
    websiteKey: MNT_SITE_KEY,
    pageAction: MNT_ACTION,
  });
  if (!solved.ok) return emptyVinSourceResult("mnt_ee", vin, solved.reason);

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

  const ajax = await vinHttpFetch(MNT_URL, {
    method: "POST",
    cookie: page.cookie,
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "faces-request": "partial/ajax",
      origin: "https://eteenindus.mnt.ee",
      referer: MNT_URL,
      "x-requested-with": "XMLHttpRequest",
    },
    body: body.toString(),
  });
  if (ajax.status >= 400) {
    return emptyVinSourceResult("mnt_ee", vin, `mnt.ee AJAX atbildēja ar HTTP ${ajax.status}`);
  }

  const html = extractPartialUpdateHtml(ajax.text);
  return parseMntExtract(vin, extractPageFromHtml(html));
}
