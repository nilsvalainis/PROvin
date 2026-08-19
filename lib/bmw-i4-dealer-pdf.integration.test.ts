import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { extractDealerReport } from "@/lib/dealer-report-extract";
import { normalizePdfExtractedText } from "@/lib/pdf-text-normalize";
import { KEY_READ_HISTORY_LABEL } from "@/lib/vendor-service-history";

const BMW_I4_PDF =
  "/Users/nv/Library/CloudStorage/Dropbox/_PROv/BMW i4/BMW - WBY31AW04NFN09888.pdf";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const core = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default?: (data: Buffer) => Promise<{ text?: unknown }>;
  };
  const pdfParse = core.default;
  if (typeof pdfParse !== "function") throw new Error("pdf-parse missing");
  const result = await pdfParse(buffer);
  return typeof result.text === "string" ? result.text : "";
}

describe("BMW i4 dīlera PDF (WBY31AW04NFN09888)", () => {
  it.skipIf(!existsSync(BMW_I4_PDF))("ielasa visus Key Read, kas nav tas pats apmeklējums", async () => {
    const text = normalizePdfExtractedText(await extractPdfText(readFileSync(BMW_I4_PDF)));
    const extract = extractDealerReport(text);
    const cbs = extract.serviceHistory.filter((e) => e.works.includes(KEY_READ_HISTORY_LABEL));
    expect(extract.serviceHistory.filter((e) => e.location.includes("Bilia"))).toHaveLength(1);
    expect(extract.serviceHistory.filter((e) => e.location.includes("Autowåx"))).toHaveLength(2);
    expect(cbs.map((e) => `${e.date}|${e.odometer}`).sort()).toEqual([
      "01.04.2025|109110",
      "09.10.2023|59679",
      "14.04.2023|37365",
      "18.06.2022|6",
      "21.08.2023|52884",
      "22.04.2024|76994",
      "27.05.2024|80021",
      "27.09.2023|57954",
    ]);
    expect(cbs.every((e) => e.works.length === 1 && e.works[0] === KEY_READ_HISTORY_LABEL)).toBe(true);
    expect(
      extract.serviceHistory.some((e) => e.date === "10.04.2026" && e.works.includes(KEY_READ_HISTORY_LABEL)),
    ).toBe(false);
  });
});
