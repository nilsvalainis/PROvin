import { describe, expect, it } from "vitest";
import {
  applySourceBlockGeneratedComment,
  isAiSourceCommentBlockKey,
  isMainAnalysisSourceBlock,
  sourceBlockHasDataExcludingComments,
  sourceBlockPlainTextExcludingComments,
} from "@/lib/admin-source-comment-blocks";
import {
  emptyAutoRecordsBlock,
  mergeSourceBlocksWithDefaults,
} from "@/lib/admin-source-blocks";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { outvinDealerReportToPlainText, emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";

describe("isMainAnalysisSourceBlock", () => {
  it("treats all AI source blocks as deep analysis", () => {
    for (const key of [
      "csdd",
      "autodna",
      "carvertical",
      "ltab",
      "auto_records",
      "cc_vin",
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
    report.vehicleInfo.vehicleType = "937";
    report.accidentCheck = "Nav ierakstu.";
    const plain = outvinDealerReportToPlainText(report);
    expect(plain).toContain("Transportlīdzekļa tips: 937");
    expect(plain).toContain("Negadījumu pārbaude");
  });
});

describe("auto_records oil interval field", () => {
  it("applies generated oil-interval notes and keeps them out of other-source comment context", () => {
    const blocks = mergeSourceBlocksWithDefaults({
      auto_records: {
        ...emptyAutoRecordsBlock(),
        serviceWorks: [
          {
            date: "01.06.2023",
            odometer: "26276",
            location: "",
            works: "Eļļas maiņa",
          },
        ],
        oilChangeIntervalNotes: "",
      },
    });
    expect(sourceBlockHasDataExcludingComments("auto_records", blocks)).toBe(true);

    const next = applySourceBlockGeneratedComment(
      "auto_records",
      blocks.auto_records,
      "<p>Eļļa mainīta ik ~21 000 km — virs 10 000 km pilsētas griestiem.</p>",
      { targetField: "oilChangeIntervalNotes" },
    );
    expect(next).toMatchObject({
      oilChangeIntervalNotes:
        "<p>Eļļa mainīta ik ~21 000 km — virs 10 000 km pilsētas griestiem.</p>",
    });
  });
});

describe("auto_records AI context", () => {
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
    expect(plain).toContain("Oficiālā dīlera dati:");
    expect(plain).toContain("Modelis: E 220");
    expect(plain).toContain("937");
  });
});

describe("cc_vin AI komentāru slānis", () => {
  it("ir avota komentāru bloks un ieslēdz ģenerēšanu, kad ir tabulas vai AI konteksts", () => {
    expect(isAiSourceCommentBlockKey("cc_vin")).toBe(true);
    expect(sourceBlockHasDataExcludingComments("cc_vin", mergeSourceBlocksWithDefaults({}))).toBe(
      false,
    );

    const withMileage = mergeSourceBlocksWithDefaults({
      cc_vin: {
        ...emptyCcVinBlock(),
        comments: "esošs komentārs",
        mileage: [{ date: "01.09.2023", odometer: "226500", country: "Vācija" }],
      },
    });
    expect(sourceBlockHasDataExcludingComments("cc_vin", withMileage)).toBe(true);
    const plain = sourceBlockPlainTextExcludingComments("cc_vin", withMileage);
    expect(plain).toContain("226500");
    expect(plain).not.toContain("esošs komentārs");

    const withRaw = mergeSourceBlocksWithDefaults({
      cc_vin: { ...emptyCcVinBlock(), aiContextRaw: "Report ID abc" },
    });
    expect(sourceBlockHasDataExcludingComments("cc_vin", withRaw)).toBe(true);

    const next = applySourceBlockGeneratedComment(
      "cc_vin",
      withMileage.cc_vin,
      "<p>Jauns komentārs</p>",
    );
    expect(next).toMatchObject({ comments: "<p>Jauns komentārs</p>" });
  });
});
