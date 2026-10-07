import { describe, expect, it } from "vitest";
import {
  SAMPLE_PUBLIC_ASSET_VERSION,
  sampleMobilePage1Src,
  samplePdfHref,
  samplePdfViewerHref,
} from "@/lib/sample-public-assets";

describe("sample public assets", () => {
  it("uses one canonical PDF URL without a cache-bust query", () => {
    expect(samplePdfHref("/samples/provin-audits-bmw-525-e61-v2.pdf")).toBe(
      "/samples/provin-audits-bmw-525-e61-v2.pdf",
    );
    expect(
      samplePdfHref("/samples/provin-audits-bmw-525-e61-v2.pdf#toolbar=0&navpanes=0"),
    ).toBe("/samples/provin-audits-bmw-525-e61-v2.pdf");
  });

  it("keeps a versioned viewer URL only for iframes", () => {
    expect(samplePdfViewerHref("/samples/provin-audits-bmw-525-e61-v2.pdf")).toBe(
      `/samples/provin-audits-bmw-525-e61-v2.pdf?v=${SAMPLE_PUBLIC_ASSET_VERSION}`,
    );
  });

  it("maps a PDF href to the page-1 PNG without a query", () => {
    expect(sampleMobilePage1Src("/samples/provin-audits-bmw-525-e61-v2.pdf")).toBe(
      "/samples/provin-audits-bmw-525-e61-v2-page1.png",
    );
    expect(
      sampleMobilePage1Src("/samples/provin-audits-bmw-525-e61-v2.pdf?v=8#toolbar=0"),
    ).toBe("/samples/provin-audits-bmw-525-e61-v2-page1.png");
    expect(sampleMobilePage1Src("/samples/not-a-report.txt")).toBeNull();
  });
});
