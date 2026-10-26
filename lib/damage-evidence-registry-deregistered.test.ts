import { describe, expect, it } from "vitest";
import { mergeSourceBlocksWithDefaults, SOURCE_BLOCK_LABELS, toPdfManualVendorBlocks } from "@/lib/admin-source-blocks";
import { collectDamageEvidence, countPdfDamageEvidence } from "@/lib/damage-evidence";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";

/** FABLE F2 A (VW ID.4, FI): Traficom ierobežojums bez datētas izņemšanas vēstures (maksas sadaļa). */
function blocksWithTraficomRestrictionOnly() {
  const blocks = mergeSourceBlocksWithDefaults({});
  blocks.traficom_fi = {
    ...blocks.traficom_fi,
    autoNotes: "Tehniskā apskate nav nokārtota / apstiprināta.\nAuto noņemts no reģistra bojājuma dēļ.",
    statusRecords: "Statuss: noņemts no reģistra (Decommissioned).\nIerobežojumi: Auto noņemts no reģistra bojājuma dēļ.",
  };
  return blocks;
}

describe("Traficom «noņemts no reģistra bojājuma dēļ» bojājumu skaitā", () => {
  it("kopsavilkuma kartīte nav «Nav ierakstu», ja reģistrs saka - izņemts bojājuma dēļ", () => {
    const manualVendorBlocks = toPdfManualVendorBlocks(blocksWithTraficomRestrictionOnly());
    expect(manualVendorBlocks.some((b) => b.title === SOURCE_BLOCK_LABELS.traficom_fi)).toBe(true);
    expect(countPdfDamageEvidence({ manualVendorBlocks })).toBe(1);
    const tile = buildPdfReportSummaryTiles({ manualVendorBlocks }).find((t) => t.id === "incidents");
    expect(tile).toMatchObject({ value: "Bojājumi: 1", tone: "warn" });
  });

  it("AI bojājumu pierādījumos ir rinda bez summas", () => {
    const ev = collectDamageEvidence(blocksWithTraficomRestrictionOnly());
    expect(ev.rows).toEqual([
      expect.objectContaining({ descriptionLv: "Noņemts no reģistra bojājuma dēļ", amount: "", sourceLabel: SOURCE_BLOCK_LABELS.traficom_fi }),
    ]);
  });

  it("datēta izņemšanas rinda netiek skaitīta divreiz", () => {
    const blocks = blocksWithTraficomRestrictionOnly();
    blocks.traficom_fi.incidents = [{ date: "12.12.2024", amount: "", country: "Somija", note: "Noņemts no reģistra bojājuma dēļ" }];
    expect(countPdfDamageEvidence({ manualVendorBlocks: toPdfManualVendorBlocks(blocks) })).toBe(1);
    expect(collectDamageEvidence(blocks).total).toBe(1);
  });

  it("tikai neveikta tehniskā apskate nav bojājums", () => {
    const blocks = mergeSourceBlocksWithDefaults({});
    blocks.traficom_fi = { ...blocks.traficom_fi, autoNotes: "Tehniskā apskate nav nokārtota / apstiprināta." };
    expect(countPdfDamageEvidence({ manualVendorBlocks: toPdfManualVendorBlocks(blocks) })).toBe(0);
    expect(buildPdfReportSummaryTiles({ manualVendorBlocks: toPdfManualVendorBlocks(blocks) }).find((t) => t.id === "incidents")?.value).toBe("Nav ierakstu");
  });
});
