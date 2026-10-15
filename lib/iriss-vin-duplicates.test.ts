import { describe, expect, it } from "vitest";
import {
  buildIrissVinDuplicateMap,
  duplicateMapForListings,
  irissVinDuplicatesFor,
  vinAnchorsFromRecord,
} from "@/lib/iriss-vin-duplicates";

const VIN_A = "WBA12345678901234";
const VIN_B = "WAUZZZ8V8DA123456";

describe("VIN duplicates", () => {
  it("links the same VIN across platforms, another order and an offer", () => {
    const anchors = vinAnchorsFromRecord({
      id: "order-2",
      clientFirstName: "Anna",
      clientLastName: "Berzina",
      brandModel: "BMW 320",
      vin: VIN_A,
      offers: [{ id: "off-1", vin: VIN_A, brandModel: "BMW 320d" }],
    });
    const index = buildIrissVinDuplicateMap(
      [
        { id: "l1", vin: VIN_A, title: "BMW 320d", platform: "autobid" },
        { id: "l2", vin: VIN_A.toLowerCase(), title: "BMW 320", platform: "openline" },
        { id: "l3", vin: VIN_B, title: "Audi A6", platform: "auto1" },
      ],
      anchors,
    );
    const links = irissVinDuplicatesFor(VIN_A, "listing:l1", index);
    expect(links.map((l) => l.kind).sort()).toEqual(["listing", "offer", "order"]);
    expect(links.find((l) => l.kind === "listing")?.href).toContain("listing=l2");
    expect(links.find((l) => l.kind === "order")?.href).toContain("/admin/iriss/pasutijumi/order-2");
    expect(irissVinDuplicatesFor(VIN_B, "listing:l3", index)).toEqual([]);
  });

  it("ignores fuzzy titles, invalid VIN and the current order record", () => {
    const index = buildIrissVinDuplicateMap(
      [
        { id: "a", vin: "", title: "Audi A6 Avant" },
        { id: "b", vin: "nav", title: "Audi A6 Avant" },
        { id: "c", vin: "00000000000000000", title: "Tukšs" },
        { id: "d", vin: VIN_B, title: "Audi A6", platform: "ecarstrade" },
      ],
      vinAnchorsFromRecord({ id: "order-1", vin: VIN_B, brandModel: "Audi A6", offers: [] }),
    );
    expect(irissVinDuplicatesFor("", "listing:a", index)).toEqual([]);
    expect(irissVinDuplicatesFor("nav", "listing:b", index)).toEqual([]);
    const hidden = irissVinDuplicatesFor(VIN_B, "listing:d", index, "order-1");
    expect(hidden.map((l) => l.kind)).not.toContain("order");
    const map = duplicateMapForListings(
      [{ id: "d", vin: VIN_B, title: "Audi A6", platform: "ecarstrade" }],
      vinAnchorsFromRecord({ id: "order-9", vin: VIN_B, brandModel: "Cits", offers: [{ id: "o", vin: VIN_B, title: "A6" }] }),
    );
    expect(map.d?.some((l) => l.kind === "offer")).toBe(true);
    expect(map.d?.some((l) => l.kind === "order")).toBe(true);
  });

  it("drops anchors for a deleted order", () => {
    expect(vinAnchorsFromRecord({ id: "x", deletedAt: "2026-10-01", vin: VIN_A, offers: [{ vin: VIN_A }] })).toEqual([]);
  });
});
