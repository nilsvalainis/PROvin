import { describe, expect, it } from "vitest";
import {
  FLASH_MAX_DEFAULT_TIER,
  FLASH_MAX_JOBS,
  flashMaxJobModelTier,
  formatFlashMaxNotice,
  isFlashMaxEmptyDataError,
  shouldSkipFlashMaxJob,
} from "@/lib/admin-flash-max";
import { createDefaultSourceBlocks, emptyCsddFields } from "@/lib/admin-source-blocks";

describe("FLASH MAX jobs", () => {
  it("uses per-field models matching standalone ✨ buttons", () => {
    expect(FLASH_MAX_DEFAULT_TIER).toBe("gemini-flash");
    expect(FLASH_MAX_JOBS.map((j) => j.id)).toEqual([
      "csdd",
      "autodna",
      "carvertical",
      "dealer_comments",
      "dealer_service",
      "dealer_oil",
      "incidents",
      "mileage",
      "technical_risks",
      "inspection",
      "summary",
      "sources_comparison",
    ]);
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "autodna")!)).toBe("gemini-flash");
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "mileage")!)).toBe("flash");
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "technical_risks")!)).toBe("flash");
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "summary")!)).toBe("pro");
  });

  it("skips source comments when the block has no data", () => {
    const empty = createDefaultSourceBlocks();
    expect(shouldSkipFlashMaxJob(FLASH_MAX_JOBS[0]!, empty)).toBe("no_source_data");
    expect(shouldSkipFlashMaxJob(FLASH_MAX_JOBS.find((j) => j.id === "mileage")!, empty)).toBe(
      "no_mileage_data",
    );
  });

  it("does not skip CSDD when the form has data", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = { ...emptyCsddFields(), makeModel: "BMW 320d", comments: "" };
    expect(shouldSkipFlashMaxJob(FLASH_MAX_JOBS[0]!, blocks)).toBeNull();
  });

  it("treats empty-source API errors as skippable", () => {
    expect(isFlashMaxEmptyDataError("empty_source_data")).toBe(true);
    expect(isFlashMaxEmptyDataError("Trūkst avota datu — aizpildi tabulas vai laukus")).toBe(true);
    expect(isFlashMaxEmptyDataError("AI: neizdevās savienoties")).toBe(false);
  });

  it("summarizes mixed results", () => {
    expect(
      formatFlashMaxNotice([
        { id: "csdd", label: "CSDD", status: "ok" },
        { id: "autodna", label: "AutoDNA", status: "skipped", detail: "nav avota datu" },
        { id: "summary", label: "3. Kopsavilkums", status: "error", detail: "timeout" },
      ]),
    ).toMatch(/sagatavoti 1/);
  });
});
