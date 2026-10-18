import { describe, expect, it } from "vitest";
import {
  VIN_INCOMPLETE_LENGTH_ERROR_LV,
  canonicalizeListingUrl,
  isIncompleteVinLength,
  isPlaceholderVin,
  isValidPlateNumber,
  isValidVin,
  isValidVinOrPlate,
  normalizeVin,
  orderVinIsNotSeventeen,
  sanitizeVinInput,
  validateOrderFields,
  vinOrPlateErrorMessage,
} from "@/lib/order-field-validation";

const VIN17 = "W0VZCYHZXN6843259";
const VIN16 = "W0VZCYHZXN684325";

describe("normalizeVin / sanitizeVinInput", () => {
  it("strips spaces, NBSP, newlines and tabs after uppercase", () => {
    expect(normalizeVin(` ${VIN17.slice(0, 8)} ${VIN17.slice(8)} `)).toBe(VIN17);
    expect(normalizeVin(`${VIN17.slice(0, 4)}\u00A0${VIN17.slice(4)}`)).toBe(VIN17);
    expect(normalizeVin(`\n${VIN17.slice(0, 8)}\t${VIN17.slice(8)}\r`)).toBe(VIN17);
  });

  it("strips a leading VIN: / VIN prefix (case-insensitive)", () => {
    expect(normalizeVin(`VIN: ${VIN17}`)).toBe(VIN17);
    expect(normalizeVin(`vin ${VIN17}`)).toBe(VIN17);
    expect(normalizeVin(`Vin:\n${VIN17}`)).toBe(VIN17);
    expect(normalizeVin("VIN:W0VZCYHZXN6843259")).toBe(VIN17);
    expect(isValidPlateNumber("VIN12")).toBe(true);
    expect(normalizeVin("VIN12")).toBe("VIN12");
  });

  it("keeps the 17th character when paste includes a leading space or VIN prefix", () => {
    const pasted = ` ${VIN17}`;
    expect(pasted.length).toBe(18);
    expect(sanitizeVinInput(pasted)).toBe(VIN17);
    expect(sanitizeVinInput(`VIN: ${VIN17}`)).toBe(VIN17);
    expect(sanitizeVinInput(`${VIN17.slice(0, 8)} ${VIN17.slice(8)}`)).toBe(VIN17);
  });

  it("truncates only after normalization", () => {
    expect(sanitizeVinInput(` ${VIN17}X`)).toBe(VIN17);
  });
});

describe("order field validation: VIN vai numurzīme", () => {
  it("accepts a full 17-char VIN", () => {
    expect(isValidVin("1HGCM82633A004352")).toBe(true);
    expect(isValidVin(VIN17)).toBe(true);
    expect(isValidVinOrPlate("1HGCM82633A004352")).toBe(true);
  });

  it("rejects a 16-char VIN", () => {
    expect(isValidVin(VIN16)).toBe(false);
    expect(isValidVinOrPlate(VIN16)).toBe(false);
    expect(isIncompleteVinLength(VIN16)).toBe(true);
    expect(isIncompleteVinLength(`VIN: ${VIN16}`)).toBe(true);
  });

  it("accepts a Latvian license plate (with spaces or hyphen)", () => {
    expect(isValidPlateNumber("KG982")).toBe(true);
    expect(isValidPlateNumber("kg 982")).toBe(true);
    expect(isValidPlateNumber("AB-1234")).toBe(true);
    expect(isValidVinOrPlate("KG982")).toBe(true);
  });

  it("rejects non-LV plate patterns", () => {
    expect(isValidPlateNumber("12ABC")).toBe(false);
    expect(isValidPlateNumber("ABCD12")).toBe(false);
  });

  it("rejects values that are neither VIN nor plate", () => {
    expect(isValidPlateNumber("AB")).toBe(false);
    expect(isValidPlateNumber("ABCD123")).toBe(false);
    expect(isValidVinOrPlate("AB")).toBe(false);
    /** 7-10 zīmes: par garu numurzīmei, par īsu VIN. */
    expect(isValidVinOrPlate("ABCD123")).toBe(false);
    expect(isValidVinOrPlate("")).toBe(false);
  });

  it("rejects placeholder VIN codes", () => {
    expect(isPlaceholderVin("")).toBe(true);
    expect(isPlaceholderVin("AAAAAAAAAAAAAAAAA")).toBe(true);
    expect(isPlaceholderVin("WAU00000000000000")).toBe(true);
    expect(isPlaceholderVin("1HGCM82633A004352")).toBe(false);
  });

  it("blocks 12-16 chars with the approved VIN length message", () => {
    expect(
      vinOrPlateErrorMessage(VIN16, {
        vin: "generic",
        vinLength: VIN_INCOMPLETE_LENGTH_ERROR_LV,
      }),
    ).toBe(VIN_INCOMPLETE_LENGTH_ERROR_LV);
    expect(VIN_INCOMPLETE_LENGTH_ERROR_LV).toBe("VIN jābūt 17 zīmēm, pārbaudiet VIN numuru");
    expect(VIN_INCOMPLETE_LENGTH_ERROR_LV).not.toMatch(/[\u2013\u2014]/);
  });

  it("validateOrderFields: plate ok, listing url optional, 16-char VIN rejected", () => {
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
        vin: VIN17,
        listingUrl: "",
        email: "test@example.com",
        phone: "+371 21234567",
      }),
    ).toBeNull();
    expect(
      validateOrderFields({
        vin: VIN16,
        listingUrl: "",
        email: "test@example.com",
        phone: "+371 21234567",
      }),
    ).toBe("vinLength");
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

  it("flags stored order VIN that is not 17 chars", () => {
    expect(orderVinIsNotSeventeen(VIN16)).toBe(true);
    expect(orderVinIsNotSeventeen("KG982")).toBe(true);
    expect(orderVinIsNotSeventeen(VIN17)).toBe(false);
    expect(orderVinIsNotSeventeen("")).toBe(false);
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
