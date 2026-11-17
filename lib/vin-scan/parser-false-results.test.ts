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
