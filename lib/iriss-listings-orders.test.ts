import { describe, expect, it } from "vitest";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { irissPasutijumsToListRow } from "@/lib/iriss-pasutijumi-list-row";
import {
  irissListingOrderBrief,
  listingBudgetForVehicle,
  listingLinkedOrders,
  listingOrderShortId,
  listingVehicleOrderIds,
  parseIrissOrderBudget,
  parseListingOrderFilter,
  serializeListingOrderFilter,
  vehicleMatchesOrderFilter,
} from "@/lib/iriss-listings-orders";

function order(partial: Partial<ReturnType<typeof emptyIrissPasutijums>> & { id: string }) {
  const rec = emptyIrissPasutijums(partial.id, "2026-10-01T00:00:00.000Z");
  Object.assign(rec, partial);
  return irissListingOrderBrief(irissPasutijumsToListRow(rec));
}

describe("parseIrissOrderBudget", () => {
  it("reads typical IRISS budget strings and treats empty as missing", () => {
    expect(parseIrissOrderBudget("18000")).toBe(18000);
    expect(parseIrissOrderBudget("18 000 €")).toBe(18000);
    expect(parseIrissOrderBudget("līdz 15.000")).toBe(15000);
    expect(parseIrissOrderBudget("15,000")).toBe(15000);
    expect(parseIrissOrderBudget("—")).toBeNull();
    expect(parseIrissOrderBudget("")).toBeNull();
    expect(parseIrissOrderBudget("nav norādīts")).toBeNull();
  });
});

describe("order briefs and linking", () => {
  it("maps client, years, budget and brief from the list row", () => {
    const b = order({
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      clientFirstName: "Anna",
      clientLastName: "Bērziņa",
      brandModel: "VW Golf",
      productionYears: "2018-2021",
      totalBudget: "14 000",
      engineType: "1.5 TSI 110 kW",
      transmission: "Automāts",
      equipmentRequired: "ACC",
      preferredColors: "Balta",
      email: "anna@example.com",
      equipmentDesired: "Kamera",
      notes: "Tikai dīzelis",
    });
    expect(b.clientName).toBe("Anna Bērziņa");
    expect(b.brandModel).toBe("VW Golf");
    expect(b.productionYears).toBe("2018-2021");
    expect(b.powerKwLabel).toBe("110 kW");
    expect(b.budget).toBe(14000);
    expect(b.preferredColors).toBe("Balta");
    expect(b.email).toBe("anna@example.com");
    expect(b.equipmentDesired).toBe("Kamera");
    expect(b.notes).toBe("Tikai dīzelis");
    expect(b.brief).toContain("2018-2021");
    expect(b.brief).toContain("ACC");
    expect(listingOrderShortId(b.id)).toBe("aaaaaaaa");
  });

  it("keeps every order on a shared search URL and uses the lowest budget unless overridden", () => {
    const a = order({ id: "o1", clientFirstName: "A", brandModel: "Golf", totalBudget: "18000" });
    const b = order({ id: "o2", clientFirstName: "B", brandModel: "Golf", totalBudget: "12000" });
    const byId = new Map([
      [a.id, a],
      [b.id, b],
    ]);
    const linked = listingLinkedOrders(["o2", "o1", "missing"], byId);
    expect(linked.map((x) => x.id)).toEqual(["o2", "o1"]);
    expect(listingBudgetForVehicle(null, linked)).toBe(12000);
    expect(listingBudgetForVehicle(20000, linked)).toBe(20000);
    expect(listingBudgetForVehicle(null, [])).toBeNull();
    expect(listingBudgetForVehicle(null, [order({ id: "x", totalBudget: "" })])).toBeNull();
    expect(order({ id: "y" }).clientName).toBe("Klients nav");
  });

  it("manual reassignment replaces search-URL orders until cleared", () => {
    expect(listingVehicleOrderIds("car-1", ["o1", "o2"], {})).toEqual(["o1", "o2"]);
    expect(listingVehicleOrderIds("car-1", ["o1", "o2"], { "car-1": ["o9"] })).toEqual(["o9"]);
    expect(listingVehicleOrderIds("car-1", ["o1"], { "car-1": [] })).toEqual(["o1"]);
  });
});

describe("client/order filter", () => {
  it("round-trips and matches linked orders", () => {
    expect(parseListingOrderFilter("")).toEqual({ kind: "all" });
    expect(parseListingOrderFilter("o:abc")).toEqual({ kind: "order", id: "abc" });
    expect(parseListingOrderFilter("c:Anna Bērziņa")).toEqual({ kind: "client", name: "Anna Bērziņa" });
    expect(serializeListingOrderFilter({ kind: "order", id: "abc" })).toBe("o:abc");
    const linked = [order({ id: "o1", clientFirstName: "Anna", clientLastName: "Bērziņa" })];
    expect(vehicleMatchesOrderFilter(linked, { kind: "all" })).toBe(true);
    expect(vehicleMatchesOrderFilter(linked, { kind: "order", id: "o1" })).toBe(true);
    expect(vehicleMatchesOrderFilter(linked, { kind: "order", id: "nope" })).toBe(false);
    expect(vehicleMatchesOrderFilter(linked, { kind: "client", name: "Anna Bērziņa" })).toBe(true);
    expect(vehicleMatchesOrderFilter(linked, { kind: "client", name: "Cits" })).toBe(false);
  });
});
