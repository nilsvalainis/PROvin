import { describe, expect, it } from "vitest";

import { normalizePdfExtractedText } from "@/lib/pdf-text-normalize";

describe("normalizePdfExtractedText", () => {
  it("salīmē atstarpes starp cipariem vienā rindā (OCR 2 7 0 0 0)", () => {
    expect(normalizePdfExtractedText("2 7 0 0 0 km")).toBe("27000 km");
  });

  it("salīmē pdf.js izgrieztos š/ļ glifus bojājumu zonās", () => {
    expect(normalizePdfExtractedText("Labā priek š ējā da ļ a / Buferis Labā puse")).toBe(
      "Labā priekšējā daļa / Buferis Labā puse",
    );
  });

  it("nesalīmē datuma pēdējo ciparu ar nākamās rindas odometru", () => {
    const raw = "01/05/2016\n27000 km\n01/06/2016\n29000 km";
    expect(normalizePdfExtractedText(raw)).toBe(raw);
  });
});
