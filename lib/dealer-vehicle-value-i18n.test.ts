import { describe, expect, it } from "vitest";
import { CLIENT_REPORT_LANGS } from "@/lib/client-report-i18n";
import { translateDealerVehicleValue } from "@/lib/dealer-vehicle-value-i18n";

const LONG_DASHES = /[\u2013\u2014]/;

describe("translateDealerVehicleValue", () => {
  it("keeps VIN, codes, dates and model names unchanged", () => {
    expect(translateDealerVehicleValue("vinCode", "WBAJB11080B123456", "lv")).toBe("WBAJB11080B123456");
    expect(translateDealerVehicleValue("engineCode", "N57D30A", "ru")).toBe("N57D30A");
    expect(translateDealerVehicleValue("model", "BMW 650i Coupe", "lv")).toBe("BMW 650i Coupe");
    expect(translateDealerVehicleValue("productionDate", "12.03.2014", "de")).toBe("12.03.2014");
  });

  it("localizes generic gearbox, body, drive, fuel and colour values", () => {
    expect(translateDealerVehicleValue("transmission", "automatic", "lv")).toBe("automātiskā");
    expect(translateDealerVehicleValue("transmission", "automatic", "ru")).toBe("автоматическая");
    expect(translateDealerVehicleValue("transmission", "automatic", "de")).toBe("Automatik");
    expect(translateDealerVehicleValue("drive", "all-wheel drive", "lv")).toBe("pilnpiedziņa");
    expect(translateDealerVehicleValue("body", "coupe", "de")).toBe("Coupé");
    expect(translateDealerVehicleValue("fuel", "petrol", "lv")).toBe("benzīns");
    expect(translateDealerVehicleValue("interior", "Leather Black", "lv")).toMatch(/āda/i);
    expect(translateDealerVehicleValue("color", "Night Black metallic", "ru")).toMatch(/чёрн/i);
  });

  it("localizes power units and country names", () => {
    expect(translateDealerVehicleValue("power", "250 kW / 340 hp", "lv")).toContain("ZS");
    expect(translateDealerVehicleValue("power", "250 kW / 340 hp", "en")).toContain("hp");
    expect(translateDealerVehicleValue("power", "250 kW / 340 hp", "de")).toContain("PS");
    expect(translateDealerVehicleValue("power", "250 kW / 340 hp", "ru")).toMatch(/кВт|л\.с\./);
    expect(translateDealerVehicleValue("countryRegion", "Finland", "lv")).toBe("Somija");
    expect(translateDealerVehicleValue("countryRegion", "Somija", "en")).toMatch(/Finland/i);
  });

  it("never emits long dashes in any language", () => {
    for (const lang of CLIENT_REPORT_LANGS) {
      const out = [
        translateDealerVehicleValue("transmission", "7-speed automatic dual-clutch transmission", lang),
        translateDealerVehicleValue("interior", "Leather Black", lang),
        translateDealerVehicleValue("color", "Night Black metallic", lang),
      ].join(" ");
      expect(LONG_DASHES.test(out), lang).toBe(false);
    }
  });
});
