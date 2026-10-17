import { describe, expect, it } from "vitest";
import {
  replaceDealerVehicleCodesInText,
  translateDealerVehicleCodeLv,
} from "@/lib/dealer-vehicle-code-lv";

describe("translateDealerVehicleCodeLv", () => {
  it("translates BMW codes", () => {
    expect(translateDealerVehicleCodeLv("drive", "HECK")).toBe("aizmugurējā piedziņa");
    expect(translateDealerVehicleCodeLv("drive", "ALLR")).toBe("pilnpiedziņa");
    expect(translateDealerVehicleCodeLv("steeringSide", "LL")).toBe("kreisā stūre");
    expect(translateDealerVehicleCodeLv("body", "TOU")).toBe("universālis");
    expect(translateDealerVehicleCodeLv("body", "SAV")).toBe("apvidus");
    expect(translateDealerVehicleCodeLv("body", "LIM")).toBe("sedans");
  });

  it("rewrites codes inside a sentence", () => {
    expect(replaceDealerVehicleCodesInText("Piedziņa HECK. Virsbūve TOU.")).toBe(
      "Piedziņa: aizmugurējā piedziņa. Virsbūve: universālis.",
    );
    expect(replaceDealerVehicleCodesInText("Piedziņa ALLR")).toBe("Piedziņa: pilnpiedziņa");
  });
});
