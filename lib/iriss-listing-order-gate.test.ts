import { describe, expect, it } from "vitest";
import { gateListingOrderIds, listingMatchesOrderMakeModel } from "@/lib/iriss-listing-order-gate";

/** Produkcijas ekrānuzņēmums 2026-10-16: katram ET auto rādīti 4 nesaistīti klienti. */
const ORDERS = new Map([
  ["o-volvo", "Volvo V60 (3er/5er G21)"],
  ["o-skoda", "Škoda Superb 1.4TSI / VW Jetta 1.4"],
  ["o-jeep", "Jeep, Mitsubishi Pajero"],
  ["o-bmw", "BMW 220 B48 7 vietas"],
]);
const ALL = [...ORDERS.keys()];

describe("listingMatchesOrderMakeModel", () => {
  it("keeps only the Skoda order on Skoda Superb Combi (eCarsTrade 7708275)", () => {
    const v = { manufacturer: "Skoda", title: "Skoda Superb Combi 1.5 TSI ACT Edition Plus | Winterpack | Camera | PDC | Clima | Cruise |" };
    expect(gateListingOrderIds(v, ALL, ORDERS)).toEqual(["o-skoda"]);
  });

  it("keeps only the Volvo order on Volvo V60", () => {
    expect(gateListingOrderIds({ manufacturer: "Volvo", title: "Volvo V60 2.0 B3 Mild-Hybrid Momentum Core" }, ALL, ORDERS)).toEqual(["o-volvo"]);
  });

  it("drops every order on Skoda Kodiaq (Skoda order wants Superb)", () => {
    expect(gateListingOrderIds({ manufacturer: "Skoda", title: "Skoda Kodiaq 2.0 TDI Style - AWD - Diesel" }, ALL, ORDERS)).toEqual([]);
  });

  it("make-only part matches any model of that make; other part needs its model", () => {
    expect(listingMatchesOrderMakeModel({ title: "Jeep Compass 1.3 T4 PHEV" }, "Jeep, Mitsubishi Pajero")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "Mitsubishi Pajero 3.2 DI-D InStyle" }, "Jeep, Mitsubishi Pajero")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "Mitsubishi Space Star 1,2 CVT" }, "Jeep, Mitsubishi Pajero")).toBe(false);
    expect(listingMatchesOrderMakeModel({ title: "VW Jetta 1.4 TSI" }, "Škoda Superb 1.4TSI / VW Jetta 1.4")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "Volkswagen Golf 1.4 TSI" }, "Škoda Superb 1.4TSI / VW Jetta 1.4")).toBe(false);
  });

  it("does not confuse V60 with XC60", () => {
    expect(listingMatchesOrderMakeModel({ title: "Volvo XC60 2.0 D3 Momentum 2WD" }, "Volvo V60")).toBe(false);
    expect(listingMatchesOrderMakeModel({ title: "Volvo V60 Cross Country D4 AWD" }, "Volvo V60")).toBe(true);
  });

  it("reads BMW numeric models and series from real Auto1 / Openlane / ET titles", () => {
    expect(listingMatchesOrderMakeModel({ title: "BMW 2er 220d Gran Tourer M Sport" }, "BMW 220 B48 7 vietas")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "BMW 2 Series Gran Tourer 220i Advantage" }, "BMW 220")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "BMW 220 B48 Gran Tourer" }, "BMW 220")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "BMW 2er 218d Gran Tourer" }, "BMW 220")).toBe(false);
    expect(listingMatchesOrderMakeModel({ title: "BMW 520d Touring" }, "BMW 5 sērija")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "BMW 3 Series 318i" }, "BMW 5 sērija")).toBe(false);
    expect(listingMatchesOrderMakeModel({ title: "BMW X3 xDrive20d" }, "BMW X5")).toBe(false);
  });

  it("reads Mercedes classes and multi-word models", () => {
    expect(listingMatchesOrderMakeModel({ title: "Mercedes-Benz E 220d AMG Line" }, "Mercedes E klase")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "Mercedes-Benz A 220 d BlueEfficiency" }, "Mercedes E klase")).toBe(false);
    expect(listingMatchesOrderMakeModel({ title: "Mercedes-Benz GLC 250 d Coupe 4Matic" }, "Mercedes-Benz GLC")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "Toyota RAV4 2.5 Hybrid" }, "Toyota RAV4 hybrid")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "Land Rover Range Rover Evoque" }, "Land Rover Range Rover Sport")).toBe(false);
  });

  it("cannot judge free text without a make or a vehicle without title: keeps the link", () => {
    expect(listingMatchesOrderMakeModel({ title: "Volvo V60" }, "Krossovers līdz 15k")).toBe(true);
    expect(listingMatchesOrderMakeModel({ title: "" }, "Volvo V60")).toBe(true);
  });

  it("keeps SCAN and unknown (deleted) order ids untouched", () => {
    expect(gateListingOrderIds({ title: "Skoda Kodiaq" }, ["scan:1", "gone-order", "o-volvo"], ORDERS)).toEqual(["scan:1", "gone-order"]);
  });
});
