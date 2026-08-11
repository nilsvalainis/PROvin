import { describe, expect, it } from "vitest";
import { appendCopilotFullPdfRaw, formatCopilotPdfRawChunk, upsertPdfRawChunk } from "@/lib/admin-copilot-pdf-raw";
import { seedCopilotBlocksFromPdfText } from "@/lib/admin-copilot-pdf-seed";
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

  it("upserts same filename with updated body even when tables already filled", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.serviceHistory = [{ date: "01.01.2020", odometer: "1000", country: "Latvija" }];
    const once = appendCopilotFullPdfRaw(blocks, "autodna", "dna.pdf", "VERSION_ONE country Vācija");
    const twice = appendCopilotFullPdfRaw(once.blocks, "autodna", "dna.pdf", "VERSION_TWO country Itālija");
    expect(twice.changed).toBe(true);
    expect(twice.blocks.autodna.mileagePasteRaw).toContain("VERSION_TWO");
    expect(twice.blocks.autodna.mileagePasteRaw).not.toContain("VERSION_ONE");
  });

  it("skips write when identical chunk already present", () => {
    const blocks = createDefaultSourceBlocks();
    const once = appendCopilotFullPdfRaw(blocks, "carvertical", "cv.pdf", "Claim 5000 EUR");
    const twice = appendCopilotFullPdfRaw(once.blocks, "carvertical", "cv.pdf", "Claim 5000 EUR");
    expect(twice.changed).toBe(false);
  });

  it("formats chunk header", () => {
    expect(formatCopilotPdfRawChunk("a.pdf", " hi ")).toBe("=== PDF: a.pdf ===\nhi");
  });

  it("upsertPdfRawChunk replaces by filename", () => {
    const a = upsertPdfRawChunk("", "x.pdf", "aaa", 10_000);
    const b = upsertPdfRawChunk(a, "x.pdf", "bbb", 10_000);
    expect(b).toContain("bbb");
    expect(b).not.toContain("aaa");
  });
});

describe("seedCopilotBlocksFromPdfText", () => {
  it("seeds AutoDNA mileage country from paste-style text", () => {
    const blocks = createDefaultSourceBlocks();
    const text = [
      "TRANSPORTLĪDZEKĻA VĒSTURE",
      "01.06.2020",
      "120 000 km",
      "Valsts Vācija",
      "15.08.2021",
      "145 000 km",
      "Valsts Latvija",
    ].join("\n");
    const r = seedCopilotBlocksFromPdfText(blocks, "autodna", text);
    expect(r.blocks.autodna.serviceHistory.some((row) => row.country === "Vācija")).toBe(true);
    expect(r.blocks.autodna.serviceHistory.some((row) => row.country === "Latvija")).toBe(true);
    expect(r.seedActions.some((a) => a.type === "upsert_mileage" && a.country === "Vācija")).toBe(true);
  });
});
