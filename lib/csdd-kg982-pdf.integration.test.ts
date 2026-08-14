import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCsddFieldsFromPdfSources } from "@/lib/csdd-pdf-ingest";
import { previousInspectionBlockHasData } from "@/lib/csdd-extended-parse";

const KG982_CANDIDATES = [
  "/Users/nv/Library/CloudStorage/Dropbox/_PROv/Arhīvs/Mercedes E220 w211 (Vladlens Tjujuševs)/KG982.pdf",
  "/Users/nv/Library/CloudStorage/Dropbox/_PROv/Mercedes E220 w211 (Vladlens Tjujuševs)/KG982.pdf",
];
const KG982_PDF = KG982_CANDIDATES.find((p) => existsSync(p)) ?? KG982_CANDIDATES[0]!;
const ON8848_PDF = "/Users/nv/Library/CloudStorage/Dropbox/_PROv/FORD RANGER/ON8848.pdf";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const core = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default?: (data: Buffer) => Promise<{ text?: unknown }>;
  };
  const pdfParse = core.default;
  if (typeof pdfParse !== "function") throw new Error("pdf-parse missing");
  const result = await pdfParse(buffer);
  return typeof result.text === "string" ? result.text : "";
}

describe("e.csdd.lv CSDD PDF integration", () => {
  it.skipIf(!existsSync(KG982_PDF))("KG982: mileage, smoke, prev inspection defects", async () => {
    const text = await extractPdfText(readFileSync(KG982_PDF));
    expect(text.length).toBeGreaterThan(2000);
    const { fields } = buildCsddFieldsFromPdfSources({ textHint: text });
    const mileage = fields.mileageHistory.filter((r) => r.odometer.trim());
    expect(mileage.length).toBeGreaterThanOrEqual(5);
    expect(mileage.some((r) => r.odometer === "274516" || r.odometer === "274726")).toBe(true);
    expect(fields.registrationNumber).toBe("KG982");
    expect(fields.opacityCoefficient).toMatch(/0\.58/);
    expect(previousInspectionBlockHasData(fields.prevInspectionBlock)).toBe(true);
    expect(fields.prevInspectionBlock.defects.some((d) => d.code === "5.3.4.")).toBe(true);
    expect(fields.technicalInspectionHistory.some((r) => (r.defects?.length ?? 0) > 0)).toBe(true);
  });

  it.skipIf(!existsSync(ON8848_PDF))("ON8848: particles, prev inspection codes, last TA", async () => {
    const text = await extractPdfText(readFileSync(ON8848_PDF));
    const { fields } = buildCsddFieldsFromPdfSources({ textHint: text });
    expect(fields.registrationNumber).toBe("ON8848");
    expect(fields.makeModel).toMatch(/FORD RANGER/i);
    expect(fields.particulateMatter).toBe("2000001");
    expect(fields.nextInspectionDate).toBe("2027-06-17");
    expect(fields.prevInspectionBlock.defects.map((d) => d.code)).toEqual(
      expect.arrayContaining(["8.2.2.3.", "4.6.1.", "4.3.1.", "4.3.2."]),
    );
  });
});
