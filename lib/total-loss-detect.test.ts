import { describe, expect, it } from "vitest";
import { detectTotalLossFromPdfInput, headerMentionsTotalLoss } from "@/lib/total-loss-detect";
import { emptyCsddFields, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { buildPdfReportSummaryTiles } from "@/lib/pdf-report-summary";

describe("detectTotalLossFromPdfInput", () => {
  it("finds totaled / salvage wording in vendor comments", () => {
    const hit = detectTotalLossFromPdfInput({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          comments: "Record of totaled vehicle, salvage title 2018",
        },
      ],
    });
    expect(hit.found).toBe(true);
    expect(hit.evidence).toMatch(/totaled|salvage/i);
  });

  it("puts Pilnīgs zaudējums on the incidents tile", () => {
    const tiles = buildPdfReportSummaryTiles({
      csddForm: emptyCsddFields(),
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.autodna,
          mileageRows: [],
          incidentRows: [],
          comments: "Ziņots par pilnīgu zaudējumu",
        },
      ],
    });
    const incidents = tiles.find((t) => t.id === "incidents");
    expect(incidents?.value).toBe("Pilnīgs zaudējums");
    expect(incidents?.note).toMatch(/pilnīgs zaudējums/i);
    expect(headerMentionsTotalLoss(`${incidents?.value} ${incidents?.note}`)).toBe(true);
    expect(incidents?.tone).toBe("alert");
  });
});
