import { describe, expect, it } from "vitest";
import {
  fillOpenlaneFuelTransmission,
  parseOpenlaneTitleFuelTransmission,
} from "@/lib/iriss-listings-openlane-spec";

describe("Openlane fuel / transmission", () => {
  it("parses trailing ' - Fuel - Gearbox' from the English title", () => {
    expect(parseOpenlaneTitleFuelTransmission("Volvo XC40 1.5 T2 129hp - Petrol - Automatic")).toEqual({
      fuel: "Petrol",
      transmission: "Automatic",
    });
    expect(parseOpenlaneTitleFuelTransmission("BMW 320d xDrive - Diesel - Automatic")).toEqual({
      fuel: "Diesel",
      transmission: "Automatic",
    });
    expect(parseOpenlaneTitleFuelTransmission("Peugeot 208 - Gasoline - Manual")).toEqual({
      fuel: "Petrol",
      transmission: "Manual",
    });
    expect(parseOpenlaneTitleFuelTransmission("Toyota Yaris - Hybrid - Automatic")).toEqual({
      fuel: "Hybrid",
      transmission: "Automatic",
    });
  });

  it("ignores FuelTypeId 0 and fills from title", () => {
    const out = fillOpenlaneFuelTransmission({
      fuel: "",
      transmission: "",
      title: "Volvo XC40 1.5 T2 129hp - Petrol - Automatic",
      raw: { FuelTypeId: 0, TransmissionTypeId: 0, FuelType: 0, Fuel: "", Transmission: 0 },
    });
    expect(out).toEqual({ fuel: "Petrol", transmission: "Automatic" });
  });

  it("prefers a reliable named raw field over the title", () => {
    const out = fillOpenlaneFuelTransmission({
      title: "Volvo XC40 1.5 T2 - Petrol - Automatic",
      raw: { FuelType: "Diesel", TransmissionType: { Name: "Manual" }, FuelTypeId: 0 },
    });
    expect(out).toEqual({ fuel: "Diesel", transmission: "Manual" });
  });

  it("does not invent fuel from a model code when the title has no spec segments", () => {
    expect(parseOpenlaneTitleFuelTransmission("Volvo XC40 1.5 T2")).toEqual({ fuel: "", transmission: "" });
  });
});
