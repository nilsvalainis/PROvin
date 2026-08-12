import { describe, expect, it } from "vitest";
import { appendCopilotFullPdfRaw, formatCopilotPdfRawChunk, upsertPdfRawChunk } from "@/lib/admin-copilot-pdf-raw";
import { seedCopilotBlocksFromPdfText } from "@/lib/admin-copilot-pdf-seed";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";

describe("appendCopilotFullPdfRaw", () => {
  it("dumps full AutoDNA extract into geminiContextRaw only (not mileagePasteRaw)", () => {
    const blocks = createDefaultSourceBlocks();
    const text = "TRANSPORTLĪDZEKĻA VĒSTURE\n01.06.2020 120000 km Vācija\n".repeat(20);
    const r = appendCopilotFullPdfRaw(blocks, "autodna", "AutoDNA_report.pdf", text);
    expect(r.changed).toBe(true);
    expect(r.blocks.autodna.geminiContextRaw).toContain("=== PDF: AutoDNA_report.pdf ===");
    expect(r.blocks.autodna.geminiContextRaw).toContain("TRANSPORTLĪDZEKĻA VĒSTURE");
    expect(r.blocks.autodna.mileagePasteRaw ?? "").toBe("");
  });

  it("upserts same filename with updated body even when tables already filled", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.serviceHistory = [{ date: "01.01.2020", odometer: "1000", country: "Latvija" }];
    const once = appendCopilotFullPdfRaw(blocks, "autodna", "dna.pdf", "VERSION_ONE country Vācija");
    const twice = appendCopilotFullPdfRaw(once.blocks, "autodna", "dna.pdf", "VERSION_TWO country Itālija");
    expect(twice.changed).toBe(true);
    expect(twice.blocks.autodna.geminiContextRaw).toContain("VERSION_TWO");
    expect(twice.blocks.autodna.geminiContextRaw).not.toContain("VERSION_ONE");
    expect(twice.blocks.autodna.mileagePasteRaw ?? "").toBe("");
  });

  it("does not write CSDD/auto_records/citi into rawUnprocessedData", () => {
    const blocks = createDefaultSourceBlocks();
    const csdd = appendCopilotFullPdfRaw(blocks, "csdd", "csdd.pdf", "CSDD body text");
    expect(csdd.blocks.csdd.geminiContextRaw).toContain("CSDD body text");
    expect(csdd.blocks.csdd.rawUnprocessedData).toBe("");

    const ar = appendCopilotFullPdfRaw(blocks, "auto_records", "dealer.pdf", "dealer body");
    expect(ar.blocks.auto_records.geminiContextRaw).toContain("dealer body");
    expect(ar.blocks.auto_records.rawUnprocessedData).toBe("");

    const citi = appendCopilotFullPdfRaw(blocks, "citi_avoti", "other.pdf", "other body");
    expect(citi.blocks.citi_avoti.sections[0]?.geminiContextRaw).toContain("other body");
    expect(citi.blocks.citi_avoti.sections[0]?.rawUnprocessedData ?? "").toBe("");
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
