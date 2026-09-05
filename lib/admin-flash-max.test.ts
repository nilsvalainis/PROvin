import { describe, expect, it } from "vitest";
import {
  FLASH_MAX_DAILY_JOB_IDS,
  FLASH_MAX_DEFAULT_TIER,
  FLASH_MAX_JOBS,
  FLASH_MAX_OPERATOR_NOTES_MAX_LEN,
  clipFlashMaxOperatorNotes,
  FLASH_MAX_SUMMARY_ONLY_JOB_IDS,
  defaultFlashMaxSelection,
  expandFlashMaxRunJobs,
  flashMaxJobModelTier,
  flashMaxSelectedJobs,
  formatFlashMaxNotice,
  isFlashMaxEmptyDataError,
  shouldSkipFlashMaxJob,
  summaryOnlyFlashMaxSelection,
} from "@/lib/admin-flash-max";
import { createDefaultSourceBlocks, emptyCsddFields, emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";

describe("FLASH MAX jobs", () => {
  it("uses per-field models matching standalone ✨ buttons", () => {
    expect(FLASH_MAX_DEFAULT_TIER).toBe("gemini-flash");
    expect(FLASH_MAX_DAILY_JOB_IDS).toEqual([
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
    expect(defaultFlashMaxSelection().selectedIds).toEqual([...FLASH_MAX_DAILY_JOB_IDS]);
    expect(FLASH_MAX_JOBS.some((j) => j.id === "ltab" && j.group === "extra")).toBe(true);
    expect(FLASH_MAX_JOBS.some((j) => j.id === "oneauto")).toBe(false);
    expect(FLASH_MAX_JOBS.some((j) => j.id === "oneauto_oil" || j.id === "oneauto_service")).toBe(false);
    expect(FLASH_MAX_JOBS.some((j) => j.id === "seller" && j.group === "extra")).toBe(true);
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "autodna")!)).toBe("gemini-flash");
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "mileage")!)).toBe("flash");
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "technical_risks")!)).toBe("flash");
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "summary")!)).toBe("pro");
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "seller")!)).toBe("flash");
    expect(flashMaxJobModelTier(FLASH_MAX_JOBS.find((j) => j.id === "price")!)).toBe("flash");
  });

  it("clips FLASH MAX operator notes for all selected agents", () => {
    expect(clipFlashMaxOperatorNotes("  labo visus tekstus pēc jaunā AutoDNA  ")).toBe(
      "labo visus tekstus pēc jaunā AutoDNA",
    );
    expect(clipFlashMaxOperatorNotes(null)).toBe("");
    expect(clipFlashMaxOperatorNotes("x".repeat(FLASH_MAX_OPERATOR_NOTES_MAX_LEN + 40))).toHaveLength(
      FLASH_MAX_OPERATOR_NOTES_MAX_LEN,
    );
  });

  it("lets the operator pick extras without changing daily defaults", () => {
    const picked = flashMaxSelectedJobs({
      selectedIds: ["csdd", "ltab", "summary"],
      tiers: defaultFlashMaxSelection().tiers,
    });
    expect(picked.map((j) => j.id)).toEqual(["csdd", "summary", "ltab"]);
    expect(summaryOnlyFlashMaxSelection().selectedIds).toEqual([...FLASH_MAX_SUMMARY_ONLY_JOB_IDS]);
  });

  it("expands Citi avoti into one run per section", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.citi_avoti.sections = [
      { ...emptyVendorAvotuBlock(), comments: "", label: "AutoDNA LV", rawUnprocessedData: "x" },
      { ...emptyVendorAvotuBlock(), comments: "", label: "", rawUnprocessedData: "" },
    ];
    const job = FLASH_MAX_JOBS.find((j) => j.id === "citi_avoti")!;
    const runs = expandFlashMaxRunJobs([job], blocks);
    expect(runs.map((r) => r.runLabel)).toEqual(["AutoDNA LV", "Avots 2"]);
    expect(shouldSkipFlashMaxJob(job, blocks, { citiAvotiSectionIndex: 0 })).toBeNull();
    expect(shouldSkipFlashMaxJob(job, blocks, { citiAvotiSectionIndex: 1 })).toBe("no_source_data");
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
