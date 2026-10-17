import { describe, expect, it } from "vitest";
import { maskVinForDemo } from "@/lib/demo-vin-mask";
import { formatDealerCoverVin } from "@/lib/pdf-dealer-section-cover";

describe("maskVinForDemo", () => {
  it("masks the last 6 characters of a 17-char VIN", () => {
    expect(maskVinForDemo("WDD2130041A179362")).toBe("WDD2130041AXXXXXX");
    expect(maskVinForDemo("wba vl12090vx12345")).toBe("WBAVL12090VXXXXXX");
  });

  it("leaves incomplete VIN unchanged", () => {
    expect(maskVinForDemo("WDD213")).toBe("WDD213");
    expect(maskVinForDemo("")).toBe("");
  });
});

describe("formatDealerCoverVin demo mask", () => {
  it("masks only when asked", () => {
    expect(formatDealerCoverVin("WBAVL12090VX12345")).toBe("WBAVL12090VX12345");
    expect(formatDealerCoverVin("WBAVL12090VX12345", { maskDemo: true })).toBe("WBAVL12090VXXXXXX");
  });
});
