import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseCcVinReportText } from "@/lib/cc-vin-report-parse";
import { normalizePdfExtractedText } from "@/lib/pdf-text-normalize";

const BMW535_PDF =
  "/Users/nv/Library/CloudStorage/Dropbox/_PROv/BMW 535 MINI DEALER + VIN CHECK/WBA5K71050G295219_BMW_535_2015_EN.pdf";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const core = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default?: (data: Buffer) => Promise<{ text?: unknown }>;
  };
  const pdfParse = core.default;
  if (typeof pdfParse !== "function") throw new Error("pdf-parse missing");
  const result = await pdfParse(buffer);
  return typeof result.text === "string" ? result.text : "";
}

describe("CheckCar.vin BMW 535 PDF integration", () => {
  it.skipIf(!existsSync(BMW535_PDF))("nolasa 27 odometra pārus un AUTOBID izsoli", async () => {
    const text = normalizePdfExtractedText(await extractPdfText(readFileSync(BMW535_PDF)));
    const p = parseCcVinReportText(text);
    expect(p.vin).toBe("WBA5K71050G295219");
    expect(p.mileage.length).toBeGreaterThanOrEqual(27);
    expect(p.mileage.some((r) => r.date === "01.05.2016" && r.odometer === "27000")).toBe(true);
    expect(p.mileage.some((r) => r.odometer === "304900")).toBe(true);
    expect(p.damages.some((r) => r.date === "01.06.2016" && r.region === "Vācija")).toBe(true);
    expect(p.sales.some((r) => r.venue === "AUTOBID" && r.odometer.includes("304"))).toBe(true);
  });
});
