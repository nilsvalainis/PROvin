import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizePdfExtractedText } from "@/lib/pdf-text-normalize";
import { parseVendorPdfLocal } from "@/lib/vendor-pdf-local-parse";

const BMW_PDF =
  "/Users/nv/Library/CloudStorage/Dropbox/_PROv/BMW X3 B47 (Oskars Skudrulis)/carVertical - WBAHT710105G31814.pdf";
const SKODA_PDF =
  "/Users/nv/Library/CloudStorage/Dropbox/_PROv/Škoda Kodiaq 4x4 benzīns (Ronalds Striguns)/carVertical - TMBLD9NS7J8038392.pdf";

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
  return normalizePdfExtractedText(parts.join("\n"));
}

const hasLivePdfs = existsSync(BMW_PDF) && existsSync(SKODA_PDF);

describe.skipIf(!hasLivePdfs)("CarVertical live PDF extraction", () => {
  it("parses BMW X1 PDF (27 mileage, timeline, no damage)", async () => {
    const text = await extractPdfText(readFileSync(BMW_PDF));
    expect(text.length).toBeGreaterThan(5000);

    const parsed = parseVendorPdfLocal("carvertical", text);
    expect(parsed.serviceHistory.length).toBe(27);
    expect(parsed.vehicleHistoryTimeline?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(parsed.damageDetails?.length ?? 0).toBe(0);
    expect(parsed.serviceHistory.some((r) => r.odometer === "295012")).toBe(true);
  });

  it("parses Škoda Kodiaq PDF (12 mileage, timeline, 1 damage)", async () => {
    const text = await extractPdfText(readFileSync(SKODA_PDF));
    expect(text.length).toBeGreaterThan(5000);

    const parsed = parseVendorPdfLocal("carvertical", text);
    expect(parsed.serviceHistory.length).toBe(12);
    expect(parsed.vehicleHistoryTimeline?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(parsed.damageDetails?.length ?? 0).toBe(1);
    expect(parsed.incidents.some((r) => r.incidentNo.includes("Šveice"))).toBe(true);
    expect(parsed.damageDetails?.[0]?.lossAmount).toMatch(/5001/);
  });
});
