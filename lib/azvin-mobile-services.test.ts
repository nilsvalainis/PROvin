import { describe, expect, it } from "vitest";
import { getAzvinMobileService } from "@/lib/azvin-mobile-services";
import { getAzvinUiCopy } from "@/lib/azvin-ui-copy";

describe("AZ.VIN hero packages", () => {
  it("does not offer a 100% refund on the Europe report", () => {
    const europe = getAzvinMobileService("europe", "lv");
    expect(europe.showRefundBanner).toBeFalsy();
    expect(europe.extraNote).toBeUndefined();
    expect(europe.refundBanner).toBeUndefined();
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

  it("matches the PROVIN dealer checklist and keeps the refund as one green sentence", () => {
    const dealer = getAzvinMobileService("dealer", "lv");
    const refund = getAzvinUiCopy("lv").dealerRefundBanner;
    expect(dealer.showRefundBanner).toBeFalsy();
    expect(dealer.features.map((feature) => feature.name)).toEqual([
      "Servisa un apkopju vēsture*",
      "Odometra rādījumi",
      "Kopsavilkums",
      "Atbalstītie ražotāji",
      refund,
    ]);
    expect(dealer.features.map((feature) => feature.tone)).toEqual([
      undefined,
      undefined,
      undefined,
      "brands",
      "guarantee",
    ]);
    expect(refund).toBe(
      "100% Naudas atmaksas garantija: Ja dīleru datubāzēs dati nav pieejami, veiksim pilnu atmaksu.",
    );
    expect(refund.includes("\n")).toBe(false);
  });
});
