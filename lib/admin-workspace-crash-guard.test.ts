import { describe, expect, it } from "vitest";
import {
  citiAvotiTrafficLevel,
  csddTrafficLevel,
  listingAnalysisTrafficLevel,
  vendorAvotuTrafficLevel,
} from "@/lib/admin-block-traffic-status";
import {
  computeProvinAlertBannersFromWorkspace,
  computeProvinInfoBannersFromWorkspace,
} from "@/lib/provin-alert-banners";
import {
  createDefaultSourceBlocks,
  listingAnalysisToPlainText,
  mergeSourceBlocksWithDefaults,
  vendorAvotuBlockToPlainText,
} from "@/lib/admin-source-blocks";
import { analyzeVinAndKm } from "@/lib/admin-workspace-preview-format";

describe("malformed workspace blocks do not throw", () => {
  it("merge + traffic + banners survive partial AI JSON", () => {
    const corrupt = {
      autodna: { comments: "AI teksts bez serviceHistory" },
      carvertical: { comments: "Otrs AI", incidents: null },
      csdd: { comments: "CSDD", mileageHistory: null },
      citi_avoti: { sections: null },
      listing_analysis: {
        sellerPortrait: null,
        photoAnalysis: undefined,
        listingSalesContext: "konteksts",
      },
      ltab: { comments: "ltab", rows: null },
      auto_records: { comments: "ar" },
      tirgus: { comments: "tirgus" },
    };

    const blocks = mergeSourceBlocksWithDefaults(corrupt);

    expect(() => vendorAvotuBlockToPlainText(blocks.autodna)).not.toThrow();
    expect(() => listingAnalysisToPlainText(blocks.listing_analysis)).not.toThrow();
    expect(() => csddTrafficLevel(blocks.csdd)).not.toThrow();
    expect(() => vendorAvotuTrafficLevel(blocks.autodna)).not.toThrow();
    expect(() => citiAvotiTrafficLevel(blocks.citi_avoti)).not.toThrow();
    expect(() => listingAnalysisTrafficLevel(blocks.listing_analysis)).not.toThrow();
    expect(() => computeProvinAlertBannersFromWorkspace(blocks)).not.toThrow();
    expect(() => computeProvinInfoBannersFromWorkspace(blocks)).not.toThrow();

    const analysis = analyzeVinAndKm({
      orderVin: "WDD2210801A318496",
      blocks: [{ label: "AutoDNA", text: vendorAvotuBlockToPlainText(blocks.autodna) }],
      fileNames: [],
    });
    expect(analysis.vinIssues.length).toBeGreaterThanOrEqual(0);
  });

  it("handles null autodna block at workspace root", () => {
    const corrupt = {
      autodna: null,
      carvertical: undefined,
      csdd: { comments: "ok" },
    };
    const blocks = mergeSourceBlocksWithDefaults(corrupt);
    expect(() => vendorAvotuTrafficLevel(blocks.autodna)).not.toThrow();
    expect(vendorAvotuTrafficLevel(blocks.autodna)).toBe("empty");
    expect(() => vendorAvotuBlockToPlainText(null)).not.toThrow();
    expect(vendorAvotuBlockToPlainText(undefined)).toBe("");
  });
});
