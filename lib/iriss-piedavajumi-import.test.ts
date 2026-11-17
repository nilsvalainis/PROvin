import { describe, expect, it } from "vitest";
import { irissPdFillEmpty, irissPdFillFromAutoparks } from "@/lib/iriss-piedavajumi-import";
import { emptyIrissPdVehicle } from "@/lib/iriss-piedavajumi-types";

describe("Piedāvājums no Autoparka - lauki (Nils 28.10)", () => {
  it("tukšos aizpilda no Pamatdatiem/CSDD; gads 4 cipari, datums DD.MM.GGGG", () => {
    const v = { ...emptyIrissPdVehicle(), title: "Volvo V60 2.0 D4 Summum", year: "2012-03-30", firstRegistration: "2012-03-30", color: "melns" };
    const out = irissPdFillFromAutoparks(v, {
      mileageKm: 214500,
      fuel: "Dīzeļdegviela",
      gearbox: "Automāts",
      powerKw: 120,
      displacementCm3: 1984,
      color: "zils",
    });
    expect(out).toMatchObject({
      year: "2012",
      firstRegistration: "30.03.2012",
      mileageKm: "214500",
      fuel: "Dīzeļdegviela",
      transmission: "Automāts",
      powerKw: "120",
      engine: "1984",
      color: "melns",
    });
  });

  it("esošus (ar roku ievadītus) laukus nepārraksta", () => {
    const cur = { ...emptyIrissPdVehicle(), mileageKm: "200000", fuel: "" };
    const src = { ...emptyIrissPdVehicle(), mileageKm: "214500", fuel: "Benzīns" };
    expect(irissPdFillEmpty(cur, src)).toMatchObject({ mileageKm: "200000", fuel: "Benzīns" });
  });
});
