import { describe, expect, it } from "vitest";

import { parseLkfExtract, parseMntExtract } from "@/lib/vin-sources/estonia-parse";
import {
  cookieHeaderFromSetCookieLines,
  extractDrupalAjaxHtml,
  extractDrupalAjaxPageState,
  extractInnerHtmlById,
  extractInputValue,
  extractPageFromHtml,
  extractPartialUpdateHtml,
  mergeCookieHeader,
  parseMntAjaxSource,
  splitCombinedSetCookieHeader,
} from "@/lib/vin-sources/html-extract";

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

