import { describe, expect, it } from "vitest";
import {
  canonicalizeListingUrl,
  isValidPlateNumber,
  isValidVin,
  isValidVinOrPlate,
  validateOrderFields,
} from "@/lib/order-field-validation";

describe("order field validation — VIN vai numurzīme", () => {
  it("accepts a full 17-char VIN", () => {
    expect(isValidVin("1HGCM82633A004352")).toBe(true);
    expect(isValidVinOrPlate("1HGCM82633A004352")).toBe(true);
  });

  it("accepts a 3–6 char license plate (with spaces or hyphen)", () => {
    expect(isValidPlateNumber("KG982")).toBe(true);
    expect(isValidPlateNumber("kg 982")).toBe(true);
    expect(isValidPlateNumber("AB-1234")).toBe(true);
    expect(isValidVinOrPlate("KG982")).toBe(true);
  });

  it("rejects values that are neither VIN nor plate", () => {
    expect(isValidPlateNumber("AB")).toBe(false);
    expect(isValidPlateNumber("ABCD123")).toBe(false);
    expect(isValidVinOrPlate("AB")).toBe(false);
    /** 7–10 zīmes — par garu numurzīmei, par īsu VIN. */
    expect(isValidVinOrPlate("ABCD123")).toBe(false);
    expect(isValidVinOrPlate("")).toBe(false);
  });

  it("validateOrderFields: plate ok, listing url optional", () => {
    expect(
      validateOrderFields({
        vin: "KG982",
        listingUrl: "",
        email: "test@example.com",
        phone: "+371 21234567",
      }),
    ).toBeNull();
    expect(
      validateOrderFields({
        vin: "AB",
        listingUrl: "",
        email: "test@example.com",
        phone: "+371 21234567",
      }),
    ).toBe("vin");
    expect(
      validateOrderFields({
        vin: "KG982",
        listingUrl: "https://www.ss.lv",
        email: "test@example.com",
        phone: "+371 21234567",
      }),
    ).toBe("listing");
  });
});

describe("canonicalizeListingUrl", () => {
  it("rewrites m.ss.lv to ss.lv and keeps the path", () => {
    expect(canonicalizeListingUrl("https://m.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html")).toBe(
      "https://ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html",
    );
    expect(canonicalizeListingUrl("http://m.ss.lv/msg/lv/transport/cars/bmw/x.html")).toBe(
      "http://ss.lv/msg/lv/transport/cars/bmw/x.html",
    );
  });

  it("leaves desktop ss.lv and other hosts unchanged", () => {
    const desktop = "https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html";
    expect(canonicalizeListingUrl(desktop)).toBe(desktop);
    const auto24 = "https://www.auto24.ee/used/123";
    expect(canonicalizeListingUrl(auto24)).toBe(auto24);
  });
});
