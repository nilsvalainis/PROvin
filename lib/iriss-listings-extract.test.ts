import { describe, expect, it } from "vitest";
import { pickListingBodyType, pickListingColor, pickListingDoorCount, pickListingVin } from "@/lib/iriss-listings-extract";

const VIN = "WBAZZZ8V0K1237731";

describe("pickListingVin", () => {
  it("reads Auto1 vin when the list payload actually has it", () => {
    expect(pickListingVin({ id: 1, vin: VIN, manufacturerName: "BMW" })).toBe(VIN);
    expect(pickListingVin({ vinNumber: VIN.toLowerCase() })).toBe(VIN);
    expect(pickListingVin({ id: 1, manufacturerName: "BMW", km: 1000 })).toBe("");
  });

  it("reads Openlane ChassisNumber and nested CarIdentification", () => {
    expect(pickListingVin({ AuctionId: 1, ChassisNumber: VIN })).toBe(VIN);
    expect(pickListingVin({ CarIdentification: { Vin: VIN, Make: "BMW" } })).toBe(VIN);
    expect(pickListingVin({ ChassisNumber: null, AuctionId: 1 })).toBe("");
  });

  it("reads Autobid additionalInformation and named equipment", () => {
    expect(pickListingVin({ additionalInformation: { vin: VIN, itemLocationCountry: { isoCode: "DE" } } })).toBe(VIN);
    expect(
      pickListingVin({
        equipments: {
          eq21: { id: 21, name: "First registration", value: "03.2019" },
          eq99: { id: 99, name: "VIN", value: VIN },
        },
      }),
    ).toBe(VIN);
  });

  it("rejects short or alphabet-invalid values", () => {
    expect(pickListingVin({ vin: "ABC" })).toBe("");
    expect(pickListingVin({ vin: "WBAIOQ12345678901" })).toBe("");
  });
});

describe("pickListingColor / body / doors", () => {
  it("reads Auto1 colorName and doorCount", () => {
    expect(pickListingColor({ colorName: "Black" })).toBe("Black");
    expect(pickListingDoorCount({ doorCount: 5 })).toBe("5");
    expect(pickListingBodyType({ bodyType: "SUV" })).toBe("SUV");
  });

  it("reads Openlane Color / NumberOfDoors", () => {
    expect(pickListingColor({ Color: "Black" })).toBe("Black");
    expect(pickListingDoorCount({ NumberOfDoors: 5 })).toBe("5");
    expect(pickListingBodyType({ BodyType: { Name: "SUV" } })).toBe("SUV");
  });

  it("reads Autobid equipment by name", () => {
    expect(
      pickListingColor({
        equipments: { eq16: { id: 16, name: "Colour", value: "Black" } },
      }),
    ).toBe("Black");
  });
});
