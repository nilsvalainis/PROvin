import { describe, expect, it } from "vitest";
import {
  isMainAnalysisSourceBlock,
  sourceBlockPlainTextExcludingComments,
} from "@/lib/admin-source-comment-blocks";
import { emptyAutoRecordsBlock, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { outvinDealerReportToPlainText, emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";

describe("isMainAnalysisSourceBlock", () => {
  it("treats all Gemini source blocks as deep analysis", () => {
    for (const key of [
      "csdd",
      "autodna",
      "carvertical",
      "ltab",
      "auto_records",
      "citi_avoti",
      "tirgus",
    ] as const) {
      expect(isMainAnalysisSourceBlock(key)).toBe(true);
    }
  });
});

describe("outvinDealerReportToPlainText", () => {
  it("includes vehicle info and checks", () => {
    const report = emptyOutvinDealerReport();
    report.vehicleInfo.typeCode = "937";
    report.accidentCheck = "Nav ierakstu.";
    const plain = outvinDealerReportToPlainText(report);
    expect(plain).toContain("Tips: 937");
    expect(plain).toContain("Negadījumu pārbaude");
  });
});

describe("auto_records Gemini context", () => {
  it("includes outvin report in plain text", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      auto_records: {
        ...emptyAutoRecordsBlock(),
        outvinReport: {
          ...emptyOutvinDealerReport(),
          vehicleInfo: {
            ...emptyOutvinDealerReport().vehicleInfo,
            model: "E 220",
            typeCode: "937",
          },
        },
      },
    });
    const plain = sourceBlockPlainTextExcludingComments("auto_records", blocks);
    expect(plain).toContain("Oficiālā dīlera atskaite");
    expect(plain).toContain("Modelis: E 220");
    expect(plain).toContain("937");
  });
});
