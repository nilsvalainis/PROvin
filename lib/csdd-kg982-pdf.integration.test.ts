import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";
import { buildCsddFieldsFromPdfSources } from "@/lib/csdd-pdf-ingest";
import { previousInspectionBlockHasData } from "@/lib/csdd-extended-parse";

const KG982_PDF =
  "/Users/nv/Library/CloudStorage/Dropbox/_PROv/Mercedes E220 w211 (Vladlens Tjujuševs)/KG982.pdf";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerPath = join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  const data = new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const line = tc.items
      .map((item) => {
        if (item && typeof item === "object" && "str" in item && typeof (item as { str: string }).str === "string") {
          return (item as { str: string }).str;
        }
        return "";
      })
      .join(" ");
    parts.push(line);
  }
  return sanitizePdfTextForParsing(parts.join("\n"));
}

describe("KG982 CSDD PDF integration", () => {
  it.skipIf(!existsSync(KG982_PDF))("parses mileage and prev inspection defects from PDF text layer", async () => {
    const text = await extractPdfText(readFileSync(KG982_PDF));
    expect(text.length).toBeGreaterThan(2000);
    const { fields } = buildCsddFieldsFromPdfSources({ textHint: text });
    const mileage = fields.mileageHistory.filter((r) => r.odometer.trim());
    expect(mileage.length).toBeGreaterThanOrEqual(5);
    expect(mileage.some((r) => r.odometer === "274516" || r.odometer === "274726")).toBe(true);
    expect(previousInspectionBlockHasData(fields.prevInspectionBlock) || fields.technicalInspectionHistory.some(
      (r) => (r.defects?.length ?? 0) > 0,
    )).toBe(true);
  });
});
