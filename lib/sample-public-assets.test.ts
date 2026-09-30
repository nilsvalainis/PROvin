import { describe, expect, it } from "vitest";
import {
  SAMPLE_PUBLIC_ASSET_VERSION,
  sampleMobilePage1Src,
  samplePdfHref,
} from "@/lib/sample-public-assets";

describe("sample public assets", () => {
  it("adds a cache-busting query to the PDF path", () => {
    expect(samplePdfHref("/samples/provin-audits-bmw-525-e61-v2.pdf")).toBe(
      `/samples/provin-audits-bmw-525-e61-v2.pdf?v=${SAMPLE_PUBLIC_ASSET_VERSION}`,
    );
    expect(
      samplePdfHref("/samples/provin-audits-bmw-525-e61-v2.pdf#toolbar=0&navpanes=0"),
    ).toBe(`/samples/provin-audits-bmw-525-e61-v2.pdf?v=${SAMPLE_PUBLIC_ASSET_VERSION}`);
  });

  it("maps a PDF href to the versioned page-1 PNG", () => {
    expect(sampleMobilePage1Src("/samples/provin-audits-bmw-525-e61-v2.pdf")).toBe(
      `/samples/provin-audits-bmw-525-e61-v2-page1.png?v=${SAMPLE_PUBLIC_ASSET_VERSION}`,
    );
    expect(
      sampleMobilePage1Src("/samples/provin-audits-bmw-525-e61-v2.pdf?v=8#toolbar=0"),
    ).toBe(`/samples/provin-audits-bmw-525-e61-v2-page1.png?v=${SAMPLE_PUBLIC_ASSET_VERSION}`);
    expect(sampleMobilePage1Src("/samples/not-a-report.txt")).toBeNull();
  });
});
