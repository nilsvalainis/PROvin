import { describe, expect, it } from "vitest";

import { parseMntExtract } from "@/lib/vin-sources/estonia-parse";
import {
  extractInputValue,
  extractPageFromHtml,
  extractPartialUpdateHtml,
  mergeCookieHeader,
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
