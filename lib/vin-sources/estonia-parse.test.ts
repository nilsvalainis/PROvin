import { describe, expect, it } from "vitest";

import {
  MNT_CAPTCHA_REJECTED_MESSAGE,
  mntCaptchaRejectedMessage,
  parseLkfExtract,
  parseMntExtract,
} from "@/lib/vin-sources/estonia-parse";
import {
  cookieHeaderFromSetCookieLines,
  extractDrupalAjaxHtml,
  extractDrupalAjaxPageState,
  extractInnerHtmlById,
  extractInputValue,
  extractPageFromHtml,
  extractPartialUpdateHtml,
  extractPartialViewState,
  isCloudflareChallengeHtml,
  mergeCookieHeader,
  parseMntAjaxSource,
  splitCombinedSetCookieHeader,
} from "@/lib/vin-sources/html-extract";

/** Reāla eteenindus.mnt.ee HTTP 200 formas lapa (2026-10-06): Cloudflare Bot Management JS bāka katrā lapā. */
const MNT_OK_PAGE_WITH_CF_BEACON = `<!DOCTYPE html><html><head><title>Sõiduki taustakontroll</title></head><body>
<form id="soidukOtsingForm" name="soidukOtsingForm" method="post" action="/public/soidukTaustakontroll.jsf">
<input id="soidukOtsingForm:recaptchaResponse" type="hidden" name="soidukOtsingForm:recaptchaResponse" />
<script id="soidukOtsingForm:j_idt157" type="text/javascript">otsiAction = function() {PrimeFaces.ab({s:"soidukOtsingForm:j_idt157",f:"soidukOtsingForm",u:"soidukOtsingForm",pa:arguments[0]});}</script>
<input type="hidden" name="javax.faces.ViewState" id="j_id1:javax.faces.ViewState:6" value="-6414174971008989319:2754969209214899528" autocomplete="off" />
</form>
<a href="/cdn-cgi/l/email-protection#e28b8c848d"><span class="__cf_email__" data-cfemail="caa3a4aca58a">[email&#160;protected]</span></a>
<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>
<script>(function(){function c(){var b=a.contentDocument||(a.contentWindow&&a.contentWindow.document);if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'a4677c512d38cc31',t:'MTc5MTMxOTI3Mw=='};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;document.body.appendChild(a);c()}})();</script>
</body></html>`;

const CF_MANAGED_CHALLENGE_PAGE = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body class="no-js">
<div class="main-wrapper" role="main"><div id="challenge-error-text">Enable JavaScript and cookies to continue</div></div>
<script>window._cf_chl_opt={cvId: '3',cZone: "eteenindus.mnt.ee",cType: 'managed',cRay: 'a4677c512d38cc31'};
var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1?ray=a4677c512d38cc31';</script>
</body></html>`;

describe("isCloudflareChallengeHtml", () => {
  it("mnt.ee parasto HTTP 200 lapu ar Cloudflare JS bāku neuzskata par challenge", () => {
    expect(isCloudflareChallengeHtml(MNT_OK_PAGE_WITH_CF_BEACON, 200)).toBe(false);
    expect(parseMntAjaxSource(MNT_OK_PAGE_WITH_CF_BEACON)).toBe("soidukOtsingForm:j_idt157");
    expect(extractInputValue(MNT_OK_PAGE_WITH_CF_BEACON, "javax.faces.ViewState")).toBe(
      "-6414174971008989319:2754969209214899528",
    );
  });

  it("īstu managed challenge atpazīst arī bez title un ar HTTP 200", () => {
    expect(isCloudflareChallengeHtml(CF_MANAGED_CHALLENGE_PAGE, 403)).toBe(true);
    const noTitle = CF_MANAGED_CHALLENGE_PAGE.replace("<title>Just a moment...</title>", "");
    expect(isCloudflareChallengeHtml(noTitle, 200)).toBe(true);
    expect(isCloudflareChallengeHtml("<html><title>Just a moment...</title></html>", 503)).toBe(true);
  });

  it("HTTP 403 ar cloudflare tekstu ir challenge, HTTP 200 ar to pašu bāku nav", () => {
    const beaconOnly = `<script>a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';</script>`;
    expect(isCloudflareChallengeHtml(beaconOnly, 403)).toBe(true);
    expect(isCloudflareChallengeHtml(beaconOnly, 200)).toBe(false);
  });
});

describe("mnt.ee partial response", () => {
  it("ņem jauno ViewState no JSF partial-response update", () => {
    const xml = `<?xml version='1.0' encoding='UTF-8'?>
<partial-response id="j_id1"><changes><update id="soidukOtsingForm"><![CDATA[<form id="soidukOtsingForm"><div id="soidukOtsingForm:messages">reCAPTCHA valideerimise viga</div></form>]]></update><update id="j_id1:javax.faces.ViewState:0"><![CDATA[-6414174971008989319:2754969209214899528]]></update></changes></partial-response>`;
    expect(extractPartialViewState(xml)).toBe("-6414174971008989319:2754969209214899528");
    expect(extractPartialViewState("<partial-response/>")).toBe("");
    expect(parseMntExtract("1FTEX15NXSKB79831", extractPageFromHtml(extractPartialUpdateHtml(xml))).message).toBe(
      MNT_CAPTCHA_REJECTED_MESSAGE,
    );
  });

  it("noraidīto žetonu ziņa saglabā reCAPTCHA neizdevās prefiksu pārlūka rezervei", () => {
    const msg = mntCaptchaRejectedMessage(["ReCaptchaV3TaskProxyLess", "ReCaptchaV3M1TaskProxyLess"]);
    expect(msg).toBe("reCAPTCHA neizdevās (mnt.ee noraidīja ReCaptchaV3TaskProxyLess, ReCaptchaV3M1TaskProxyLess žetonu)");
    expect(/reCAPTCHA neizdevās/i.test(msg)).toBe(true);
    expect(mntCaptchaRejectedMessage([])).toBe(MNT_CAPTCHA_REJECTED_MESSAGE);
  });
});

describe("html extract", () => {
  it("nolasa tabulu un ViewState", () => {
    const html = `
      <form>
        <input type="hidden" name="javax.faces.ViewState" value="vs-1" />
        <table><tr><th>Kuupäev</th><th>Läbisõit</th></tr>
        <tr><td>22.08.2025</td><td>120 000 km</td></tr></table>
      </form>`;
    const page = extractPageFromHtml(html);
    expect(extractInputValue(html, "javax.faces.ViewState")).toBe("vs-1");
    expect(page.tables[0]?.rows[0]).toEqual(["22.08.2025", "120 000 km"]);
  });

  it("ņem PrimeFaces CDATA formu", () => {
    const xml = `<?xml version='1.0'?><partial-response><changes><update id="x"><![CDATA[<form id="soidukOtsingForm">OK</form>]]></update></changes></partial-response>`;
    expect(extractPartialUpdateHtml(xml)).toContain("soidukOtsingForm");
  });

  it("apvieno sīkdatnes", () => {
    expect(mergeCookieHeader("a=1; b=2", "b=9; c=3")).toBe("a=1; b=9; c=3");
  });

  it("ņem visus Set-Cookie, arī ar Expires komatu", () => {
    expect(
      cookieHeaderFromSetCookieLines([
        "lkf_api_session=aaa; path=/",
        "lkf_api_permanent=bbb; expires=Tue, 19 Jan 2038 03:14:07 GMT; path=/",
      ]),
    ).toBe("lkf_api_session=aaa; lkf_api_permanent=bbb");
    expect(
      splitCombinedSetCookieHeader(
        "lkf_api_session=aaa; path=/, lkf_api_permanent=bbb; expires=Tue, 19 Jan 2038 03:14:07 GMT; path=/",
      ),
    ).toEqual([
      "lkf_api_session=aaa; path=/",
      "lkf_api_permanent=bbb; expires=Tue, 19 Jan 2038 03:14:07 GMT; path=/",
    ]);
  });

  it("nolasa mnt.ee otsiAction AJAX avotu", () => {
    const html = `<script>otsiAction = function() {PrimeFaces.ab({s:"soidukOtsingForm:j_idt157",f:"soidukOtsingForm",u:"soidukOtsingForm",pa:arguments[0]});}</script>`;
    expect(parseMntAjaxSource(html)).toBe("soidukOtsingForm:j_idt157");
  });

  it("ņem Drupal AJAX insert HTML no #api-query-output", () => {
    const body = JSON.stringify([
      { command: "settings", settings: { foo: 1 } },
      {
        command: "insert",
        method: "html",
        selector: "#api-query-output",
        data: "<p>Andmeid ei ole liikluskindlustuse registris.</p>",
      },
    ]);
    expect(extractDrupalAjaxHtml(body)).toContain("Andmeid ei ole liikluskindlustuse registris");
    expect(extractDrupalAjaxHtml(`)]}'\n${body}`)).toContain("Andmeid ei ole liikluskindlustuse registris");
  });

  it("ņem Drupal ajaxPageState no drupal-settings-json", () => {
    const html = `<script type="application/json" data-drupal-selector="drupal-settings-json">{"ajaxPageState":{"theme":"lkf","theme_token":null,"libraries":"core/drupal"}}</script>`;
    expect(extractDrupalAjaxPageState(html)).toEqual({
      "ajax_page_state[theme]": "lkf",
      "ajax_page_state[libraries]": "core/drupal",
    });
  });

  it("nolasa tukšu #api-query-output", () => {
    const html = `<div class="request-outcome" id="api-query-output"></div>`;
    expect(extractInnerHtmlById(html, "api-query-output")).toBe("");
  });
});

describe("parseMntExtract", () => {
  it("palīdzības frāzi pirms rezultāta neuzskata par tukšu reģistru", () => {
    const hit = parseMntExtract("WBA5R1C0XLFH42873", {
      text: "Sisestatud andmetega sõidukit registris ei ole! VIN-kood WBA5R1C0XLFH42873 Mark: BMW",
      tables: [{ headers: ["Kuupäev", "Läbisõit"], rows: [["22.08.2025", "120000 km"]] }],
      pairs: [{ label: "Mark", value: "BMW" }],
    });
    expect(hit.found).toBe(true);
  });

  it("captcha kļūdu neatdod kā tukšu reģistru", () => {
    const fail = parseMntExtract("WBA5R1C0XLFH42873", {
      text: "reCAPTCHA valideerimise viga",
      tables: [],
      pairs: [],
    });
    expect(fail.found).toBe(false);
    expect(fail.message).toContain("reCAPTCHA");
  });

  it("nobraukuma tabulu uzskata par atrastu", () => {
    const hit = parseMntExtract("WBA5R1C0XLFH42873", {
      text: "VIN-kood WBA5R1C0XLFH42873 Mark: BMW",
      tables: [{ headers: ["Kuupäev", "Läbisõit"], rows: [["22.08.2025", "120000 km"]] }],
      pairs: [{ label: "Mark", value: "BMW" }],
    });
    expect(hit.found).toBe(true);
    expect(hit.mileage[0]?.odometer).toBe("120000");
  });
});

describe("parseLkfExtract", () => {
  it("klasificē VIN, kas nav OCTA reģistrā", () => {
    const miss = parseLkfExtract("1FTEX15NXSKB79831", {
      text: "Andmeid ei ole liikluskindlustuse registris.",
      tables: [],
      pairs: [],
    });
    expect(miss.found).toBe(false);
    expect(miss.message).toMatch(/nav Igaunijas OCTA/i);
  });

  it("klasificē, ka atlīdzības gadījumu nav", () => {
    const none = parseLkfExtract("WBA5R1C0XLFH42873", {
      text: "Sõiduk ei ole osalenud liikluskindlustuse juhtumis.",
      tables: [],
      pairs: [],
    });
    expect(none.found).toBe(false);
    expect(none.message).toBe("OCTA atlīdzības gadījumi nav atrasti");
  });

  it("nolasa atlīdzības tabulu ar datumu un summu", () => {
    const hit = parseLkfExtract("WBA5R1C0XLFH42873", {
      text: "Kahjujuhtumid",
      tables: [{ headers: ["Kuupäev", "Summa"], rows: [["15.03.2022", "1 200 €"]] }],
      pairs: [],
    });
    expect(hit.found).toBe(true);
    expect(hit.incidents[0]).toMatchObject({ date: "2022-03-15", amount: "1200.00 €", country: "Igaunija" });
  });

  it("Drupal AJAX rezultāta HTML bez tabulas - nav reģistrā", () => {
    const html = extractDrupalAjaxHtml(
      JSON.stringify([
        {
          command: "insert",
          method: "html",
          selector: "#api-query-output",
          data: "<div class='result'><p>Andmeid ei ole liikluskindlustuse registris.</p></div>",
        },
      ]),
    );
    const parsed = parseLkfExtract("1FTEX15NXSKB79831", extractPageFromHtml(html));
    expect(parsed.found).toBe(false);
    expect(parsed.message).toMatch(/nav Igaunijas OCTA/i);
  });

  it("meklēšanas forma bez rezultāta nav 'nav reģistrā'", () => {
    const form = parseLkfExtract("1FTEX15NXSKB79831", {
      text: "Sõiduki registrimärk või VIN-kood Otsi Kontrolli, kas sõiduk on osalenud liikluskindlustuse juhtumis.",
      tables: [],
      pairs: [],
    });
    expect(form.found).toBe(false);
    expect(form.message).toMatch(/meklēšanas forma/i);
  });

  it("CAPTCHA kļūdu neatdod kā neklasificētu", () => {
    const fail = parseLkfExtract("1FTEX15NXSKB79831", {
      text: "The answer you entered for the CAPTCHA was not correct.",
      tables: [],
      pairs: [],
    });
    expect(fail.found).toBe(false);
    expect(fail.message).toContain("reCAPTCHA");
  });
});

