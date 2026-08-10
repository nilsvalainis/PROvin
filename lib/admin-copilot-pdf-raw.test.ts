import { describe, expect, it } from "vitest";
import { appendCopilotFullPdfRaw, formatCopilotPdfRawChunk } from "@/lib/admin-copilot-pdf-raw";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";

describe("appendCopilotFullPdfRaw", () => {
  it("dumps full AutoDNA extract into mileagePasteRaw", () => {
    const blocks = createDefaultSourceBlocks();
    const text = "TRANSPORTLĪDZEKĻA VĒSTURE\n01.06.2020 120000 km Vācija\n".repeat(20);
    const r = appendCopilotFullPdfRaw(blocks, "autodna", "AutoDNA_report.pdf", text);
    expect(r.changed).toBe(true);
    expect(r.blocks.autodna.mileagePasteRaw).toContain("=== PDF: AutoDNA_report.pdf ===");
    expect(r.blocks.autodna.mileagePasteRaw).toContain("TRANSPORTLĪDZEKĻA VĒSTURE");
    expect(r.blocks.autodna.geminiContextRaw).toContain("TRANSPORTLĪDZEKĻA VĒSTURE");
  });

  it("skips duplicate dump of the same PDF chunk", () => {
    const blocks = createDefaultSourceBlocks();
    const once = appendCopilotFullPdfRaw(blocks, "carvertical", "cv.pdf", "Claim 5000 EUR");
    const twice = appendCopilotFullPdfRaw(once.blocks, "carvertical", "cv.pdf", "Claim 5000 EUR");
    expect(twice.changed).toBe(false);
  });

  it("formats chunk header", () => {
    expect(formatCopilotPdfRawChunk("a.pdf", " hi ")).toBe("=== PDF: a.pdf ===\nhi");
  });
});
