import { describe, expect, it } from "vitest";
import { DEFAULT_LISTING_COSTS } from "./iriss-listings-cost";
import { applyB2bDemoSettingsPatch, emptyB2bDemoSettings } from "./b2b-demo-settings";

describe("b2b demo settings", () => {
  const tenantId = "tnt_settings1";

  it("neskopē ĪRISS hardcoded komisiju / transportu", () => {
    const empty = emptyB2bDemoSettings(tenantId);
    expect(empty.commissionEur).toBe(0);
    expect(empty.transportEur).toBe(0);
    expect(empty.auctionFeeEur).toBe(0);
    expect(empty.unexpectedEur).toBe(0);
    expect(empty.commissionEur).not.toBe(DEFAULT_LISTING_COSTS.commission);
    expect(empty.transportEur).not.toBe(DEFAULT_LISTING_COSTS.transport);
    expect(empty.pdfFooterText).toBe("");
  });

  it("pielieto tikai sava tenanta iestatījumus", () => {
    const next = applyB2bDemoSettingsPatch(emptyB2bDemoSettings(tenantId), tenantId, {
      companyName: "Auto Sala",
      commissionEur: 500,
      vatMode: "margin",
    });
    expect(next.tenantId).toBe(tenantId);
    expect(next.companyName).toBe("Auto Sala");
    expect(next.commissionEur).toBe(500);
    expect(next.vatMode).toBe("margin");
  });

  it("noraida nedrošu logo URL", () => {
    expect(() =>
      applyB2bDemoSettingsPatch(emptyB2bDemoSettings(tenantId), tenantId, { logoUrl: "javascript:alert(1)" }),
    ).toThrow(/Logo/);
  });
});
