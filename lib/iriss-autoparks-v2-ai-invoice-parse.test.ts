import { describe, expect, it } from "vitest";
import { parseInvoiceAiResult } from "@/lib/iriss-autoparks-v2-ai-invoice-parse";

const now = new Date("2026-10-23T10:00:00Z");

describe("AI rēķina summa (ieteikums)", () => {
  it("derīga atbilde -> summa ar PVN, noapaļota līdz centiem", () => {
    const r = parseInvoiceAiResult(JSON.stringify({ found: true, totalAmount: 258.4000001, currency: "EUR", amountIncludesVat: true, invoiceDate: "2026-10-23", confidence: 0.93 }), "m", now);
    expect(r).toMatchObject({ amountEur: 258.4, withVat: true, date: "2026-10-23", confidence: 0.93, error: "" });
  });
  it("nav atrasts / 0 / cita valūta / bojāts JSON -> nav ieteikuma", () => {
    expect(parseInvoiceAiResult(JSON.stringify({ found: false, totalAmount: 0, currency: "", amountIncludesVat: false, invoiceDate: "", confidence: 0 }), "m", now)).toMatchObject({ amountEur: null, error: "not_found" });
    expect(parseInvoiceAiResult(JSON.stringify({ found: true, totalAmount: 100, currency: "PLN", amountIncludesVat: true, invoiceDate: "", confidence: 0.9 }), "m", now)).toMatchObject({ amountEur: null, error: "not_eur" });
    expect(parseInvoiceAiResult("nav json", "m", now)).toMatchObject({ amountEur: null, error: "invalid_json" });
  });
});
