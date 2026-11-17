import { describe, expect, it } from "vitest";

import { auctionDamageLv, DAMAGE_LABEL_UNTRANSLATED_SUFFIX } from "@/lib/vin-scan/damage-labels-lv";

describe("auctionDamageLv (j26)", () => {
  it("Copart/IAAI kodi latviski, arī kombinācijas", () => {
    expect(auctionDamageLv("Front End + Side")).toBe("priekšpuse, sāns");
    expect(auctionDamageLv("REAR END")).toBe("aizmugure");
    expect(auctionDamageLv("Minor Dent/Scratches")).toBe("nelieli ieliekumi / skrāpējumi");
    expect(auctionDamageLv("Water/Flood")).toBe("applūdis");
    expect(auctionDamageLv("Hail")).toBe("krusa");
    expect(auctionDamageLv("All Over")).toBe("visa virsbūve");
  });

  it("nezināms kods - oriģināls ar atzīmi; latvisks teksts paliek", () => {
    expect(auctionDamageLv("Replaced Vin")).toBe(`Replaced Vin ${DAMAGE_LABEL_UNTRANSLATED_SUFFIX}`);
    expect(auctionDamageLv("priekšpuse")).toBe("priekšpuse");
    expect(auctionDamageLv("")).toBe("");
  });
});
