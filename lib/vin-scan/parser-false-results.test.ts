import { describe, expect, it } from "vitest";

import { classifyBrowserProbe } from "@/lib/vin-scan/browser-classify";
import { parseCarpassRecalls } from "@/lib/vin-scan/parse";
import { parseNicbHtml, parseOemRecallHtml } from "@/lib/vin-scan/parse-extra";

const VIN = "5UXCR6C05L9B00001";

describe("NICB: tīra lapa ar VIN nav „zagts”", () => {
  const clean = [
    `<p>VIN ${VIN}</p><p>This VIN is not listed as stolen in our records.</p>`,
    `<div>${VIN}: has not been reported as stolen or as a total loss.</div>`,
    `<div>Results for ${VIN}. No theft records or total loss records were found.</div>`,
  ];
  it.each(clean)("serveris: none (%#)", (html) => {
    const r = parseNicbHtml(html, VIN);
    expect(r.status).toBe("none");
    expect(r.flags?.stolen).toBeUndefined();
  });
  it.each(clean)("pārlūka imports: none (%#)", (html) => {
    expect(classifyBrowserProbe("nicb", html.replace(/<[^>]+>/g, " "), VIN)?.status).toBe("none");
  });
  it("īsts zādzības ieraksts paliek atradums", () => {
    const r = parseNicbHtml(`<p>${VIN}</p><p>This vehicle has been reported as stolen.</p>`, VIN);
    expect(r.status).toBe("found");
    expect(r.flags?.stolen).toBe(true);
  });
  it("total loss ieraksts paliek atradums", () => {
    expect(parseNicbHtml(`<p>${VIN}</p><p>Total loss record from insurer</p>`, VIN).status).toBe("found");
  });
});

describe("NICB: VINCheck formas lapa nav „zagts” (WBAFB71080LV66575, 23.11)", () => {
  const EU_VIN = "WBAFB71080LV66575";
  // Formas lapa pēc Cloudflare: apraksts ar „stolen”, VIN skriptā (drupalSettings) un ievades laukā; rezultāta nav.
  const formPage = `<html><head><script>var drupalSettings={"path":{"currentQuery":{"vin":"${EU_VIN}"}}};</script></head>
<body><h1>VINCheck®</h1><p>NICB's VINCheck is a free lookup service provided to help determine if a vehicle has been
reported as stolen but not recovered, or has been reported as a salvage vehicle by cooperating NICB member insurance companies.</p>
<form><input name="vin" value="${EU_VIN}"><div class="g-recaptcha"></div><input name="form_build_id" value="x"></form></body></html>`;
  const echoPage = `<div>VIN: ${EU_VIN}</div><p>To help determine if a vehicle has been reported as stolen, enter the VIN.</p>`;

  it.each([formPage, echoPage])("serveris: nav found, nav stolen karoga (%#)", (html) => {
    const r = parseNicbHtml(html, EU_VIN);
    expect(r.status).not.toBe("found");
    expect(r.flags?.stolen).toBeUndefined();
  });
  it("pārlūka zonde: formas lapa gaida (null), nevis found", () => {
    const text = formPage.replace(/<[^>]+>/g, " ");
    expect(classifyBrowserProbe("nicb", text, EU_VIN)).toBeNull();
  });
  it("NICB tīrā atbilde „No NICB VINCheck theft records were found” ir none", () => {
    expect(parseNicbHtml(`<p>${EU_VIN}</p><p>No NICB VINCheck Theft Records Were Found</p>`, EU_VIN).status).toBe("none");
  });
  it("skaidrs zādzības rezultāts paliek found", () => {
    expect(parseNicbHtml(`<p>${EU_VIN}</p><p>1 NICB VINCheck theft record was found</p>`, EU_VIN)).toMatchObject({
      status: "found",
      flags: { stolen: true },
    });
  });
});

describe("OEM atsaukumi: 10 nav 0", () => {
  it.each([
    ["10 recalls found", "found", 10],
    ["20 open recalls", "found", 20],
    ["1 recall", "found", 1],
  ] as const)("%s", (text, status, n) => {
    const r = parseOemRecallHtml(200, `<p>${VIN}</p><p>${text}</p>`, VIN, "BMW");
    expect(r.status).toBe(status);
    expect(r.flags?.recallCount).toBe(n);
  });
  it.each(["0 recalls", "0 open recalls", "No recalls for this vehicle"])("%s ir none", (text) => {
    expect(parseOemRecallHtml(200, `<p>${text}</p>`, VIN, "BMW").status).toBe("none");
  });
  it("HTTP kļūda nav none", () => {
    expect(parseOemRecallHtml(503, "", VIN, "BMW").status).toBe("unknown");
  });
});

describe("Car-Pass: kļūdas teksts nav „atsaukumu nav”", () => {
  it("success:false ar kļūdu ir unknown", () => {
    const r = parseCarpassRecalls(200, JSON.stringify({ success: false, result: "Invalid CSRF token" }));
    expect(r.status).toBe("unknown");
    expect(r.summary).toMatch(/CSRF/);
  });
  it("nezināms VIN joprojām ir none", () => {
    expect(parseCarpassRecalls(200, JSON.stringify({ success: false, result: "Vehicle unknown" })).status).toBe("none");
  });
  it("success:true bez atsaukumiem ir none", () => {
    expect(parseCarpassRecalls(200, JSON.stringify({ success: true, result: "" })).status).toBe("none");
  });
});
