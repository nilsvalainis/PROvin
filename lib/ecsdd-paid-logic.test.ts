import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { emptyCsddFields, type CsddFormFields } from "@/lib/admin-source-blocks";
import { buildCsddLocalParseFromText } from "@/lib/csdd-pdf-ingest";
import {
  applyCsddPaidReportToForm,
  autoSmsDecision,
  autoSmsTakeable,
  buildSmsHref,
  isValidAutoSms,
  parseAutoSmsRecord,
  resolvePaidQuery,
  smsPlatformFromUserAgent,
} from "@/lib/ecsdd-paid-logic";
import { encodeQr, qrSvgPath } from "@/lib/qr-code";
import { formatPaidReportPanels } from "@/relay/provin-ecsdd/lib/ecsdd-paid.mjs";

const SNAPS = JSON.parse(fs.readFileSync(path.join(__dirname, "__fixtures__", "ecsdd-paid", "snapshots.json"), "utf8")) as Record<
  string,
  { panels: { title: string; rows: string[][]; lines: string[] }[] }
>;

describe("CSDD maksas izziņa: SMS saite", () => {
  it("Apple uses &body=, others ?body=; the text is URL-encoded", () => {
    const sms = { number: "1800", body: "CSDD 99999 AB1234" };
    expect(buildSmsHref(sms, "apple")).toBe("sms:1800&body=CSDD%2099999%20AB1234");
    expect(buildSmsHref(sms, "other")).toBe("sms:1800?body=CSDD%2099999%20AB1234");
    expect(smsPlatformFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)")).toBe("apple");
    expect(smsPlatformFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("apple");
    expect(smsPlatformFromUserAgent("Mozilla/5.0 (Linux; Android 14)")).toBe("other");
  });

  it("asks by plate first (the SMS is per plate), then VIN", () => {
    const csdd = { ...emptyCsddFields(), registrationNumber: "ab-1234", vin: "WBAFB71080LV00001" };
    expect(resolvePaidQuery(csdd, "WBAFB71080LV00001")).toBe("AB1234");
    expect(resolvePaidQuery(emptyCsddFields(), "WBAFB71080LV00001")).toBe("WBAFB71080LV00001");
    expect(resolvePaidQuery(emptyCsddFields(), "")).toBeNull();
  });

  it("the QR code matches a reference matrix that a QR reader decoded (sms: link, ECC M, mask 2)", () => {
    const ref = ["1fcd3a7f", "10480541", "175c505d", "175c0f5d", "1757ea5d", "1052e441", "1fd5557f", "0014b000", "17c37d7c", "0eb30a75", "03e834d6", "1b084231", "13483d8e", "192cca71", "0247e568", "02048120", "10dd7c0d", "1b8e06b7", "14643080", "15056151", "17793dfe", "0016c111", "1fc1ed50", "105c8711", "175f6dfe", "17553003", "17583632", "10452482", "1fd5e274"];
    const qr = encodeQr("sms:1800&body=CSDD%2099999%20AB1234", { ecc: "M", mask: 2 });
    expect(qr.version).toBe(3);
    expect(qr.modules.map((r) => parseInt(r.map((c) => (c ? "1" : "0")).join(""), 2).toString(16).padStart(8, "0"))).toEqual(ref);
    for (let v = 1; v <= 10; v++) expect(encodeQr("x", { minVersion: v }).size).toBe(v * 4 + 17);
    expect(() => encodeQr("x".repeat(400))).toThrow();
    expect(qrSvgPath([[true]], 1)).toEqual({ d: "M1,1h1v1h-1z", viewBox: 3 });
  });
});

describe("CSDD maksas izziņa: ievietošana CSDD blokā", () => {
  const text = formatPaidReportPanels(SNAPS["paid-report"].panels, "Informācija sagatavota elektroniski 22.11.2026 12:49:40.");
  const parsed = buildCsddLocalParseFromText(text, "test");

  it("fills an empty block the same way as the PDF upload", () => {
    const out = applyCsddPaidReportToForm(emptyCsddFields(), parsed.fields, parsed.rawUnprocessedData);
    expect(out.vin).toBe("WBAFB71080LV00001");
    expect(out.ownerCountLatvia).toBe("4");
    expect(out.mileageHistory.length).toBe(10);
    expect(out.technicalInspectionHistory.filter((r) => r.date).length).toBe(10);
    expect(out.rawUnprocessedData).toContain("Reģistrācijas numurs AB1234");
  });

  it("keeps fields typed by hand and longer hand-made tables; API-locked fields stay with the API", () => {
    const current: CsddFormFields = {
      ...emptyCsddFields(),
      previousRegistrationCountry: "VĀCIJA",
      comments: "mans komentārs",
      mileageHistory: Array.from({ length: 12 }, (_, i) => ({ date: `01.01.20${10 + i}`, odometer: String(1000 * i), country: "LV" })),
    };
    const out = applyCsddPaidReportToForm(current, parsed.fields, parsed.rawUnprocessedData);
    expect(out.previousRegistrationCountry).toBe("VĀCIJA");
    expect(out.comments).toBe("mans komentārs");
    expect(out.mileageHistory.length).toBe(12);
    expect(out.ownerCountLatvia).toBe("4");
  });
});

describe("CSDD maksas izziņa: \"Sūtīt automātiski\" (viena SMS uz pieprasījumu)", () => {
  const rec = { id: "AB1234-2026-11-23T10:00:00.000Z", number: "1800", body: "CSDD 99999 AB1234", plate: "AB1234", createdAt: "2026-11-23T10:00:00.000Z", emailedAt: "2026-11-23T10:00:01.000Z" };

  it("only a CSDD text for this plate to a short or full number is sent", () => {
    expect(isValidAutoSms(rec)).toBe(true);
    expect(isValidAutoSms({ ...rec, body: "CSDD 99999 AB1235" })).toBe(false);
    expect(isValidAutoSms({ ...rec, body: "Sveiki" })).toBe(false);
    expect(isValidAutoSms({ ...rec, number: "abc" })).toBe(false);
    expect(parseAutoSmsRecord({ ...rec, extra: 1 })).toEqual(rec);
    expect(parseAutoSmsRecord({ ...rec, id: "" })).toBeNull();
  });

  it("double click / retry with the same id or the same text within 2 min does not send again", () => {
    const at = (s: number) => new Date(Date.parse(rec.createdAt) + s * 1000);
    expect(autoSmsDecision(null, rec, at(0))).toBe("send");
    expect(autoSmsDecision(rec, rec, at(1))).toBe("duplicate");
    expect(autoSmsDecision(rec, rec, at(3600))).toBe("duplicate");
    expect(autoSmsDecision(rec, { id: "other-id-123", body: rec.body }, at(60))).toBe("duplicate");
    expect(autoSmsDecision(rec, { id: "other-id-123", body: rec.body }, at(180))).toBe("send");
    // e-pasts neizdevās (nav emailedAt): pēc 30 s drīkst vēlreiz
    const failed = { ...rec, emailedAt: undefined };
    expect(autoSmsDecision(failed, rec, at(10))).toBe("duplicate");
    expect(autoSmsDecision(failed, rec, at(40))).toBe("send");
  });

  it("the Shortcut URL variant takes a request once and only within 10 min", () => {
    const at = (s: number) => new Date(Date.parse(rec.createdAt) + s * 1000);
    expect(autoSmsTakeable(rec, at(60))).toBe(true);
    expect(autoSmsTakeable({ ...rec, consumedAt: at(61).toISOString() }, at(62))).toBe(false);
    expect(autoSmsTakeable(rec, at(11 * 60))).toBe(false);
    expect(autoSmsTakeable(null, at(0))).toBe(false);
  });
});
