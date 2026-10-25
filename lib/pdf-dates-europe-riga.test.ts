/**
 * FABLE 25.10: servera PDF/HTML (Vercel = UTC) datumi rādīja 2-3 h agrāku laiku, ap pusnakti - iepriekšējo dienu.
 * 24.10.2026 22:30 UTC = 25.10.2026 01:30 Rīgā.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInvoiceHtml, toInvoiceOrderPayload } from "@/lib/generate-invoice-html";
import { formatGeneratedDocumentWhen } from "@/lib/iriss-generated-documents";

const LATE_UTC = Date.parse("2026-10-24T22:30:00.000Z");

describe("servera PDF datumi Europe/Riga", () => {
  it("rēķina HTML datums ir Rīgas laikā", () => {
    const html = buildInvoiceHtml(
      toInvoiceOrderPayload(
        {
          id: "cs_test_tz",
          created: LATE_UTC / 1000,
          amountTotal: 6999,
          currency: "EUR",
          customerEmail: "demo@provin.lv",
          customerDetailsEmail: "demo@provin.lv",
          vin: "WVWZZZ3CZWE123456",
        },
        "PRV-2026-0002",
      ),
    );
    expect(html).toContain("2026. gada 25. oktobris 01:30");
    expect(html).not.toContain("24. oktobris");
  });

  it("IRISS ģenerēto dokumentu laiks ir Rīgas laikā", () => {
    expect(formatGeneratedDocumentWhen(new Date(LATE_UTC).toISOString())).toContain("01:30");
    expect(formatGeneratedDocumentWhen(new Date(LATE_UTC).toISOString())).toContain("25.10.");
  });

  it("katrs lv-LV datuma formatētājs servera PDF failos norāda timeZone Europe/Riga", () => {
    const files = [
      "lib/invoice-pdf.ts",
      "lib/generate-invoice-html.ts",
      "lib/b2b-topup-invoice.ts",
      "lib/dzintarzeme-tame-pdf.ts",
      "lib/iriss-pasutijums-pdf.ts",
      "lib/iriss-generated-documents.ts",
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const calls = src.split('new Intl.DateTimeFormat("lv-LV"').slice(1);
      expect(calls.length, file).toBeGreaterThan(0);
      for (const tail of calls) expect(tail.slice(0, 160), file).toContain('timeZone: "Europe/Riga"');
    }
  });
});
