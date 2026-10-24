import { describe, expect, it } from "vitest";
import { parseTransportInvoiceAmount, shouldAutofillTransportCost } from "@/lib/iriss-logistics-transport-invoice-amount";

describe("shouldAutofillTransportCost", () => {
  it("allows autofill when the field is still empty", () => {
    expect(shouldAutofillTransportCost({ transportCostEur: null, transportCostAuto: false })).toBe(true);
  });

  it("allows a newer PDF to overwrite a previous auto-filled value", () => {
    expect(shouldAutofillTransportCost({ transportCostEur: 240, transportCostAuto: true })).toBe(true);
  });

  it("never overwrites a value the user entered by hand", () => {
    expect(shouldAutofillTransportCost({ transportCostEur: 240, transportCostAuto: false })).toBe(false);
  });
});

describe("parseTransportInvoiceAmount", () => {
  it("parses EN-style amount (comma thousands, dot decimal) next to a Total label", () => {
    const text = `
      Auto1 Transport Invoice TR-884213
      Service: Transport Hattingen -> Riga
      Subtotal: 200.00 EUR
      VAT (0%): 0.00 EUR
      Total amount: 240.00 EUR
      Payment due: 30 days
    `;
    const r = parseTransportInvoiceAmount(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.amountEur).toBe(240);
      expect(r.confidence).toBe("label");
    }
  });

  it("parses DE-style amount (dot thousands, comma decimal) next to Gesamtbetrag", () => {
    const text = "Transportrechnung\nGesamtbetrag: 1.240,50 EUR\n";
    const r = parseTransportInvoiceAmount(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.amountEur).toBe(1240.5);
      expect(r.confidence).toBe("label");
    }
  });

  it("parses a bare decimal amount near the label when no currency symbol is attached", () => {
    const text = "Invoice\nTotal Amount\n239.50\nThank you for your business.";
    const r = parseTransportInvoiceAmount(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.amountEur).toBe(239.5);
      expect(r.confidence).toBe("label");
    }
  });

  it("falls back to the largest currency-marked amount when no Total label is present", () => {
    const text = "Line 1: 50.00 EUR\nLine 2: 190.00 EUR\nNo total line here.";
    const r = parseTransportInvoiceAmount(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.amountEur).toBe(190);
      expect(r.confidence).toBe("fallback");
    }
  });

  it("prefers the Total-labeled amount over a larger unrelated amount elsewhere in the document", () => {
    const text = "Vehicle value reference: 11,970.81 EUR\n...\nTotal amount due: 240.00 EUR";
    const r = parseTransportInvoiceAmount(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.amountEur).toBe(240);
      expect(r.confidence).toBe("label");
    }
  });

  it("returns no_amount_found when the text has no money-like amount", () => {
    const r = parseTransportInvoiceAmount("Transport Request Confirmation. Pickup scheduled for 21.10.2026.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_amount_found");
  });

  it("returns empty_text for blank input", () => {
    const r = parseTransportInvoiceAmount("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty_text");
  });

  it("ignores a stray 0.00 VAT line and still finds the real total", () => {
    const text = "Total: 0.00 EUR VAT\nGrand total: 325.00 EUR";
    const r = parseTransportInvoiceAmount(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amountEur).toBe(325);
  });

  it("handles space as a thousands separator (LV style)", () => {
    const text = "Kopsumma: 1 240,00 EUR";
    const r = parseTransportInvoiceAmount(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amountEur).toBe(1240);
  });
});
