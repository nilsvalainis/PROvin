import { describe, expect, it } from "vitest";

import { translateDealerVehicleValue } from "@/lib/dealer-vehicle-value-i18n";

describe("26.11: SV/DA/NO/DE/NL krāsas un virsbūve dīlera blokā (bez AI)", () => {
  it("«Svart» / «Personbil» (WDD2122931A366915) visās 4 valodās", () => {
    expect(translateDealerVehicleValue("color", "Svart", "lv")).toBe("melns");
    expect(translateDealerVehicleValue("color", "Svart", "en")).toBe("black");
    expect(translateDealerVehicleValue("color", "Svart", "ru")).toBe("чёрный");
    expect(translateDealerVehicleValue("color", "Svart", "de")).toBe("schwarz");
    expect(translateDealerVehicleValue("body", "Personbil", "lv")).toBe("vieglais automobilis");
    expect(translateDealerVehicleValue("body", "Personbil", "en")).toBe("passenger car");
    expect(translateDealerVehicleValue("body", "Personbil", "ru")).toBe("легковой автомобиль");
    expect(translateDealerVehicleValue("body", "Personbil", "de")).toBe("Pkw");
  });

  it("dāņu, norvēģu, vācu, nīderlandiešu krāsas", () => {
    expect(translateDealerVehicleValue("color", "Sort", "lv")).toBe("melns");
    expect(translateDealerVehicleValue("color", "Hvid", "lv")).toBe("balts");
    expect(translateDealerVehicleValue("color", "Grønn metallic", "lv")).toBe("zaļš metāliskā");
    expect(translateDealerVehicleValue("color", "Sølv", "en")).toBe("silver");
    expect(translateDealerVehicleValue("color", "Weiß", "ru")).toBe("белый");
    expect(translateDealerVehicleValue("color", "Rot", "lv")).toBe("sarkans");
    expect(translateDealerVehicleValue("color", "Grijs", "de")).toBe("grau");
    expect(translateDealerVehicleValue("color", "Blå", "lv")).toBe("zils");
  });

  it("virsbūve: stationcar, kombi coupé, pkw, personenauto", () => {
    expect(translateDealerVehicleValue("body", "Stationcar", "lv")).toBe("universālis");
    expect(translateDealerVehicleValue("body", "Halvkombi", "en")).toBe("hatchback");
    expect(translateDealerVehicleValue("body", "PKW", "lv")).toBe("vieglais automobilis");
    expect(translateDealerVehicleValue("body", "Personenauto", "de")).toBe("Pkw");
  });

  it("citos laukos krāsu vārdi netiek skarti", () => {
    expect(translateDealerVehicleValue("transmission", "Sort", "lv")).toBe("Sort");
  });
});
