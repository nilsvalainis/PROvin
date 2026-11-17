import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateDzintarzemeTamePdfBytes } from "@/lib/dzintarzeme-tame-pdf";
import type { DzintarzemeTameInput } from "@/lib/dzintarzeme-tame-calculator";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const core = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default?: (data: Buffer) => Promise<{ text?: unknown }>;
  };
  const pdfParse = core.default;
  if (typeof pdfParse !== "function") throw new Error("pdf-parse missing");
  const result = await pdfParse(buffer);
  return typeof result.text === "string" ? result.text : "";
}

const input: DzintarzemeTameInput = {
  brandModel: "VW Golf",
  vin: "WVWZZZ1KZAW000001",
  autoPrice: 10000,
  applyVatToAutoPrice: false,
  commissionVariant: "A",
  depositPercent: 20,
  commissionManualNet: 0,
  commissionManualPercent: 0,
  transportNet: 800,
  chemicalCleaningNet: 0,
  polishingNet: 0,
  paintingNet: 0,
  leasingValuationNet: 0,
  extraServices: [],
};

describe("dzintarzeme tame PDF advance", () => {
  it("jaunais makets (Nils 28.10): klients, auto, kopsavilkums un atlikums pēc avansa", async () => {
    const bytes = await generateDzintarzemeTamePdfBytes(input, undefined, {
      advancePaidEur: 200,
      docNo: "P-8BCA",
      clientName: "Juris Pakalns",
      phone: "29796840",
      year: "2019",
      mileageKm: "142000",
    });
    const text = await extractPdfText(Buffer.from(bytes));
    expect(text).toContain("Izmaksu tāme");
    expect(text).toContain("Juris Pakalns");
    expect(text).toContain("+371 29 796 840");
    expect(text).toContain("142 000 km");
    expect(text).toContain("Kopā bez PVN");
    expect(text).toContain("10 000,00 €");
    expect(text).toContain("CSDD reģistrācijas un valsts nodevas nav iekļautas");
    expect(text).not.toContain("Derīga līdz");
    expect(text).toContain("Avanss");
    expect(text).toContain("Atlikums apmaksai");
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
