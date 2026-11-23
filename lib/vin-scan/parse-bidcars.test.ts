import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bidCarsOdometerKm, parseBidCarsLotHtml, vinScanParseFromBidCarsLot } from "@/lib/vin-scan/parse-bidcars";

const FIX = path.join(__dirname, "__fixtures__", "bidcars");
const read = (name: string) => readFileSync(path.join(FIX, name), "utf8");

describe("bid.cars lota lapa (releja Chrome HTML)", () => {
  it("arhīva lots: IAAI 2020, bojājums, nobraukums, 10 bildes tikai no šī VIN", () => {
    const vin = "WBA5R1C0XLFH42873";
    const lot = parseBidCarsLotHtml(read(`lot-${vin}.html`), vin)!;
    expect(lot).not.toBeNull();
    expect(lot.title).toBe("2020 BMW 3 Series, 330I");
    expect(lot).toMatchObject({ year: "2020", make: "BMW", model: "3 Series", lot: "0-27382814", venue: "IAAI" });
    expect(lot.primaryDamage).toBe("Front end");
    expect(lot.secondaryDamage).toBe("");
    expect(lot.loss).toBe("Collision");
    expect(lot.odometer).toBe("31 000 mi (49 890 km)");
    expect(lot.key).toBe("Missing");
    expect(lot.photoCount).toBe(10);
    expect(lot.photoUrls).toHaveLength(10);
    expect(lot.photoUrls.every((u) => u.includes(vin))).toBe(true);
    expect(lot.sales).toEqual([
      {
        venue: "IAAI",
        date: "2020-08-11",
        lot: "0-27382814",
        finalBid: "",
        odometer: "31 000 mi",
        status: "Sold",
        seller: "State Farm Group Insurance",
      },
    ]);
    const p = vinScanParseFromBidCarsLot(lot, "https://bid.cars/en/lot/0-27382814/2020-BMW-3-Series-WBA5R1C0XLFH42873");
    expect(p.status).toBe("found");
    expect(p.summary).toBe("1 izsole · 2020-08-11 · IAAI · 49 890 km · priekšpuse · 10 foto");
    expect(p.vehicle).toEqual({ make: "BMW", model: "3 Series", year: "2020" });
    expect(p.mileage).toEqual([{ date: "2020-08-11", odometer: "49 890 km" }]);
    expect(p.auctions).toHaveLength(1);
    expect(p.auctions![0]).toMatchObject({ date: "2020-08-11", venue: "IAAI", lot: "0-27382814", damage: "Front end", photoCount: 10 });
    expect(p.media?.photoCount).toBe(10);
    expect(p.detail).toContain("Pārdošanas vēsture:");
    expect(p.detail).toContain("2020-08-11 · IAAI · 0-27382814 · 31 000 mi · Sold · State Farm Group Insurance");
  });

  it("aktīvs lots ar 2 neveiksmīgām izsolēm: vēsture ar cenām, bildes tikai vienreiz", () => {
    const vin = "1C4PJMDB9JD528953";
    const lot = parseBidCarsLotHtml(read(`lot-${vin}.html`), vin)!;
    expect(lot.venue).toBe("Copart");
    expect(lot.primaryDamage).toBe("Front end");
    expect(lot.secondaryDamage).toBe("Side");
    expect(lot.photoCount).toBe(13);
    expect(lot.sales.map((s) => [s.date, s.finalBid, s.status])).toEqual([
      ["2026-11-11", "$1,850", "Not sold"],
      ["2026-11-18", "$1,450", "Not sold"],
    ]);
    const p = vinScanParseFromBidCarsLot(lot, "https://bid.cars/en/lot/1-68599186/x");
    expect(p.summary).toBe("2 izsoles · 2026-11-18 · Copart · 204 372 km · priekšpuse, sāns · 13 foto");
    const photos = (p.auctions ?? []).reduce((n, a) => n + (a.photoCount ?? 0), 0);
    expect(photos).toBe(13);
    expect(p.auctions!.map((a) => a.price)).toEqual(["$1,850", "$1,450"]);
  });

  it("cita VIN lapa netiek pieņemta", () => {
    expect(parseBidCarsLotHtml(read("lot-WBA5R1C0XLFH42873.html"), "1C4PJMDB9JD528953")).toBeNull();
    expect(parseBidCarsLotHtml("<html><title>Just a moment...</title></html>", "WBA5R1C0XLFH42873")).toBeNull();
  });

  it("nobraukums km no mi", () => {
    expect(bidCarsOdometerKm("126 991 mi (204 372 km)")).toBe("204 372 km");
    expect(bidCarsOdometerKm("31 000 mi")).toBe("49 890 km");
    expect(bidCarsOdometerKm("")).toBe("");
  });
});
