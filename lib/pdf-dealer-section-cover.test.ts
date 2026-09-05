import { describe, expect, it } from "vitest";
import { emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { buildDealerSectionCoverHtml } from "@/lib/pdf-dealer-section-cover";

describe("PDF dīlera sadaļas vāks", () => {
  it("rāda modeli, VIN un vizīšu joslu", () => {
    const vehicle = emptyOutvinVehicleInfo();
    vehicle.model = "BMW X1 (E84) xDrive 20 d";
    vehicle.vinCode = "WBAVL12090VX12345";
    vehicle.colorCode = "A96";
    vehicle.power = "135 kW (184 ZS)";
    const html = buildDealerSectionCoverHtml({
      vehicle,
      serviceWorks: [
        {
          date: "12.03.2024",
          odometer: "142220",
          location: "d.velop AG, Osnabrück",
          works: "Eļļas maiņa",
        },
        {
          date: "03.04.2016",
          odometer: "31400",
          location: "BMW Mobiler Service, Minhene",
          works: "",
        },
      ],
    });
    expect(html).toContain("pdf-dealer-cover");
    expect(html).toContain("PROVIN DĪLERIS");
    expect(html).toContain("BMW X1 (E84) xDrive 20 d");
    expect(html).toContain("VIN WBAVL12090VX12345");
    expect(html).toContain("A96");
    expect(html).toContain("135 kW (184 ZS)");
    expect(html).toContain("31 400 km");
    expect(html).toContain("142 220 km");
    expect(html).toContain("2 vizītes");
    expect(html).toContain("pdf-dealer-cover-curve");
    expect(html).not.toContain("pdf-svc-span__bar");
    expect(html).not.toContain("Pirmais ieraksts");
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
  });

  it("tukšus datus neatgriež", () => {
    expect(
      buildDealerSectionCoverHtml({
        vehicle: emptyOutvinVehicleInfo(),
        serviceWorks: [],
      }),
    ).toBe("");
  });
});
