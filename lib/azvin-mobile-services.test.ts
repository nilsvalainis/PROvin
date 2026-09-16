import { describe, expect, it } from "vitest";
import {
  AZVIN_FEATURE_ROW_COUNT,
  getAzvinMobileService,
  getAzvinMobileServices,
  type AzvinServiceId,
} from "@/lib/azvin-mobile-services";
import { AZVIN_LOCALES } from "@/lib/azvin-hero-copy";
import { getAzvinUiCopy } from "@/lib/azvin-ui-copy";

const SERVICE_IDS: AzvinServiceId[] = ["korea", "europe", "usa", "dealer"];

describe("AZ.VIN hero packages", () => {
  it("keeps the same card chrome on every tab: title, description and five rows", () => {
    for (const locale of AZVIN_LOCALES) {
      const services = getAzvinMobileServices(locale);
      expect(services).toHaveLength(4);
      for (const service of services) {
        expect(service.cardTitle.trim().length).toBeGreaterThan(0);
        expect(service.description.trim().length).toBeGreaterThan(0);
        expect(service.turnaround?.trim().length).toBeGreaterThan(0);
        expect(service.features).toHaveLength(AZVIN_FEATURE_ROW_COUNT);
        expect(service.features.every((feature) => feature.name.trim().length > 0)).toBe(true);
      }
    }
    expect(AZVIN_LOCALES).toEqual(["az", "en", "ru", "lv"]);
    expect(SERVICE_IDS).toEqual(["korea", "europe", "usa", "dealer"]);
  });

  it("does not offer a 100% refund on the Europe report", () => {
    const europe = getAzvinMobileService("europe", "lv");
    expect(europe.cardTitle).toBe("EIROPAS VĒSTURE");
    expect(europe.features.some((feature) => feature.tone === "guarantee")).toBe(false);
  });

  it("hides the EU substitution note behind CarVertical and AutoDNA info tips", () => {
    const europe = getAzvinMobileService("europe", "lv");
    const [carVertical, autoDna, ...rest] = europe.features;
    expect(carVertical?.name).toBe("CarVertical vēstures atskaite");
    expect(autoDna?.name).toBe("AutoDNA vēstures atskaite");
    expect(carVertical?.infoTip).toContain("specializētu maksas atskaiti");
    expect(autoDna?.infoTip).toBe(carVertical?.infoTip);
    expect(rest.every((feature) => !feature.infoTip)).toBe(true);
  });

  it("formats Korea, America and dealer refunds as the short PROVIN label plus info tip", () => {
    const refund = getAzvinUiCopy("lv").dealerRefundBanner;
    expect(refund).toBe("100% Naudas atmaksas garantija.");

    const dealer = getAzvinMobileService("dealer", "lv");
    expect(dealer.cardTitle).toBe("OFICIĀLO DĪLERU DATI");
    expect(dealer.features.map((feature) => feature.tone)).toEqual([
      undefined,
      undefined,
      undefined,
      "brands",
      "guarantee",
    ]);
    expect(dealer.features[4]?.name).toBe(refund);
    expect(dealer.features[4]?.infoTip).toContain("dīleru datubāzē");

    for (const id of ["korea", "usa"] as const) {
      const service = getAzvinMobileService(id, "lv");
      const last = service.features[service.features.length - 1];
      expect(last?.tone).toBe("guarantee");
      expect(last?.name).toBe(refund);
      expect((last?.infoTip ?? "").length).toBeGreaterThan(20);
    }
  });
});
