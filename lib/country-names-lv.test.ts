import { describe, expect, it } from "vitest";
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";

describe("countryLabelToIso2 US states and CA provinces", () => {
  it("maps Louisiana forms to US, never Laos", () => {
    expect(countryLabelToIso2("Luiziāna (LA)")).toBe("US");
    expect(countryLabelToIso2("Louisiana (LA)")).toBe("US");
    expect(countryLabelToIso2("Baton Rouge, LA")).toBe("US");
    expect(countryLabelToIso2("LA 70817")).toBe("US");
    expect(countryLabelToIso2("LA")).toBe("US");
    expect(countryLabelToIso2("Louisiana")).toBe("US");
    expect(normalizeCountryNameLv("LA")).toBe("ASV");
    expect(normalizeCountryNameLv("Luiziāna (LA)")).toBe("ASV");
  });

  it("maps USA markers even when CarVertical text is noisy", () => {
    expect(countryLabelToIso2("Copart (ASV)")).toBe("US");
    expect(countryLabelToIso2("USA")).toBe("US");
    expect(countryLabelToIso2("United States")).toBe("US");
    expect(countryLabelToIso2("ASV, LA")).toBe("US");
  });

  it("maps Canadian provinces to CA; standalone CA stays Canada", () => {
    expect(countryLabelToIso2("Ontario")).toBe("CA");
    expect(countryLabelToIso2("Toronto, ON")).toBe("CA");
    expect(countryLabelToIso2("Kvebeka")).toBe("CA");
    expect(countryLabelToIso2("CA")).toBe("CA");
    expect(countryLabelToIso2("Kanāda")).toBe("CA");
  });

  it("keeps real ISO countries and rejects unknown 2-letter codes", () => {
    expect(countryLabelToIso2("DE")).toBe("DE");
    expect(countryLabelToIso2("LV")).toBe("LV");
    expect(countryLabelToIso2("XX")).toBeNull();
    expect(countryLabelToIso2("LAOS")).toBeNull();
  });
});
