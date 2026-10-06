import { describe, expect, it } from "vitest";
import {
  overlayNonemptyVehicleInfo,
  sanitizeDealerVehicleInfo,
  toDealerVehicleInfoEnglish,
} from "@/lib/dealer-vehicle-info-en";
import { emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";

describe("toDealerVehicleInfoEnglish", () => {
  it("tulko AutoDNA krāsu un ātrumkārbu", () => {
    expect(toDealerVehicleInfoEnglish("color", "Melns")).toBe("black");
    expect(toDealerVehicleInfoEnglish("transmission", "Automātiskā ātrumkārba")).toBe(
      "automatic transmission",
    );
    expect(toDealerVehicleInfoEnglish("transmission", "auto")).toBe("automatic");
  });

  it("saīsina LHD latviešu skaidrojumu uz angļu", () => {
    expect(
      toDealerVehicleInfoEnglish("steeringSide", "LHD (automašīna ar stūri kreisajā pusē)"),
    ).toBe("LHD (left-hand drive)");
  });

  it("atstāj rūpnīcas angļu nosaukumu un kodu", () => {
    expect(toDealerVehicleInfoEnglish("color", "Havana Black Metallic (LY8X)")).toBe(
      "Havana Black Metallic (LY8X)",
    );
    expect(toDealerVehicleInfoEnglish("engineCode", "CVUA")).toBe("CVUA");
  });

  it("iztukšo netulkojamu latviešu tekstu", () => {
    expect(toDealerVehicleInfoEnglish("body", "Virsbūves konstruktīvais izpildījums")).toBe("");
  });

  it("valsti rāda angliski", () => {
    expect(toDealerVehicleInfoEnglish("countryRegion", "Vācija")).toBe("Germany");
    expect(toDealerVehicleInfoEnglish("power", "135 kW (184 ZS)")).toBe("135 kW (184 hp)");
  });
});

describe("sanitizeDealerVehicleInfo", () => {
  it("izmet tukšos pēc tulkojuma", () => {
    expect(
      sanitizeDealerVehicleInfo({
        color: "Melns",
        body: "Virsbūves konstruktīvais izpildījums",
        engineCode: "CVUA",
      }),
    ).toEqual({ color: "black", engineCode: "CVUA" });
  });
});

describe("overlayNonemptyVehicleInfo", () => {
  it("API vērtība pārraksta jau aizpildīto AutoDNA lauku", () => {
    const base = { ...emptyOutvinVehicleInfo(), color: "black", transmission: "automatic" };
    const next = overlayNonemptyVehicleInfo(base, {
      color: "Havana Black Metallic",
      engineCode: "CVUA",
      transmission: "",
    });
    expect(next.color).toBe("Havana Black Metallic");
    expect(next.transmission).toBe("automatic");
    expect(next.engineCode).toBe("CVUA");
  });
});
