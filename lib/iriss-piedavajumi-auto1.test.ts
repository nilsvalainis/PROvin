import { describe, expect, it } from "vitest";
import type { IrissRelayAuctionDetail } from "@/lib/iriss-auction-detail";
import {
  irissPdAuto1BlockCount,
  irissPdAuto1BlocksFromDetail,
  irissPdAuto1FieldCount,
  irissPdDamageSummary,
  irissPdPaintZoneOf,
  normalizeIrissPdAuto1Blocks,
  parseIrissPdDamageTable,
} from "@/lib/iriss-piedavajumi-auto1";

/** Releja atbilde pēc Auto1 lapas (auto1-ref 26.10: tehniskie dati, aprīkojums, serviss, TA, bojājumi, VIN). */
const DETAIL: IrissRelayAuctionDetail = {
  platform: "auto1",
  key: "DE48213",
  url: "https://www.auto1.com/en/app/merchant/car/DE48213",
  title: "Volvo XC90 2.4 D5",
  fields: [
    ["Build year:", "2010"],
    ["First registration:", "06/2010"],
    ["Odometer reading:", "290,354 km"],
    ["Fuel type:", "Diesel"],
    ["Horsepower:", "136 kW / 185 HP"],
    ["Cylinder capacity:", "2,401 ccm"],
    ["Gear box:", "Automatic"],
    ["Inspection expires:", "12/2026"],
    ["Body type:", "SUV"],
    ["Total number of owners:", "2"],
    ["Keys:", "2"],
    ["Prior damage / Accident according to previous owner", "No"],
    ["Country of origin:", "DE"],
    ["Country of last registration:", "DE"],
    ["Environmental class:", "EURO 4"],
    ["COC papers:", "Yes"],
    ["Seats:", "7"],
    ["Color:", "White (Original)"],
    ["Upholstery:", "Leather (Original)"],
    ["Door count:", "5"],
    ["CO2 Emissions:", "224g/km"],
    ["Towbar", "Detachable tow hitch"],
    ["Xenon lights", "Bi-xenon headlights with dynamic cornering lights"],
    ["Heated seats", "Front seat heating"],
    ["Service book details:", "Available"],
    ["Service appointment:", "Some"],
    ["Last service on:", "10/09/2017"],
    ["Last service Mileage:", "144,742 km"],
    ["Drive belt change on:", "-"],
    ["Date of latest technical inspection:", "12/06/2024"],
    ["Mileage at latest technical inspection:", "278,763 km"],
    ["Front body", "276 µm"],
    ["Roof", "106 µm"],
    ["Rear body", "111 µm"],
  ],
  tables: [
    [
      ["Area", "Damage", "Severity", "Description", "Quantity", "Parts affected"],
      ["Exterior", "Dent", "Width: ≥20mm & <50mm", "Paint damage", "2", "Rear left fender (2)"],
      ["Width: ≥5mm & <20mm", "Paint damage", "1", "Front right door (1)"],
      ["Repaint", "Thickness: ≥250µm & <500µm", "Professional repaint", "1", "Hood (1)"],
      ["Scratch", "Length: <20mm", "Deep scratch - down to primer", "25", "Hood (4), Front bumper (4), Tailgate (2)"],
      ["Interior", "Crack", "Length: ≥50mm & <100mm", "-", "1", "Driver seat (1)"],
      ["Dirty", "-", "-", "2", "Load compartment cover (1)"],
    ],
  ],
  lists: [
    { heading: "Car equipment", items: ["Navigation System Navigation system incl. DVD player (RTI)", "ABS Anti-lock braking system (ABS)"] },
    { heading: "Car data according to identification number (VIN)", items: ["Additional heating", "Interior: Leather", "AUX-IN connection"] },
  ],
  photos: [],
  jsonFields: [],
  item: null,
};

describe("Auto1 bloki no detaļu lapas", () => {
  const b = irissPdAuto1BlocksFromDetail(DETAIL);

  it("tehniskie dati: LV etiķetes, vērtības kā avotā, Auto1 secībā", () => {
    expect(b.tech).toHaveLength(21);
    expect(b.tech[0]).toEqual({ label: "Izlaiduma gads", value: "2010" });
    expect(b.tech).toContainEqual({ label: "Jauda", value: "136 kW / 185 HP" });
    expect(b.tech).toContainEqual({ label: "Iepriekšējie bojājumi / avārija (pēc iepr. īpašnieka)", value: "No" });
    expect(b.tech.at(-1)).toEqual({ label: "CO2 izmeši", value: "224g/km" });
  });

  it("aprīkojums: kategorija LV (bold), apraksts kā avotā; arī no saraksta", () => {
    expect(b.equipment[0]).toEqual({ name: "Āķis", detail: "Detachable tow hitch" });
    expect(b.equipment).toContainEqual({ name: "Navigācija", detail: "Navigation system incl. DVD player (RTI)" });
    expect(b.equipment).toContainEqual({ name: "ABS", detail: "Anti-lock braking system (ABS)" });
  });

  it("serviss un tehniskā apskate", () => {
    expect(b.service).toEqual([
      { label: "Servisa grāmata", value: "Available" },
      { label: "Servisa apmeklējumi", value: "Some" },
      { label: "Pēdējais serviss", value: "10/09/2017" },
      { label: "Pēdējā servisa km", value: "144,742 km" },
      { label: "Siksnas maiņa", value: "-" },
    ]);
    expect(b.inspection).toEqual([
      { label: "Pēdējās TA datums", value: "12/06/2024" },
      { label: "Nobraukums pēdējā TA", value: "278,763 km" },
    ]);
  });

  it("bojājumu tabula: apvienotās šūnas (zona, bojājums) tiek pārnestas", () => {
    expect(b.damage).toHaveLength(6);
    expect(b.damage[1]).toEqual({ area: "exterior", damage: "Dent", severity: "Width: ≥5mm & <20mm", description: "Paint damage", quantity: "1", parts: "Front right door (1)" });
    expect(b.damage[2]).toMatchObject({ area: "exterior", damage: "Repaint" });
    expect(b.damage[5]).toMatchObject({ area: "interior", damage: "Dirty", quantity: "2" });
    expect(irissPdDamageSummary(b.damage)).toEqual([
      { area: "exterior", kinds: ["Dent", "Repaint", "Scratch"], total: 29 },
      { area: "interior", kinds: ["Crack", "Dirty"], total: 3 },
    ]);
  });

  it("krāsas karte: µm pa zonām, ▲ no bojājumu daļām (sāni pēc durvīm/spārniem)", () => {
    const z = Object.fromEntries((b.paint?.zones ?? []).map((x) => [x.id, x]));
    expect(z.front).toMatchObject({ readings: [276], warning: true });
    expect(z.roof).toMatchObject({ readings: [106], warning: false });
    expect(z.rear).toMatchObject({ readings: [111], warning: true });
    expect(z.left?.warning).toBe(true);
    expect(z.right?.warning).toBe(true);
  });

  it("dati pēc VIN", () => {
    expect(b.vinData).toEqual(["Additional heating", "Interior: Leather", "AUX-IN connection"]);
  });

  it("skaitītāji blokiem un laukiem", () => {
    expect(irissPdAuto1BlockCount(b, "tech")).toBe(21);
    expect(irissPdAuto1BlockCount(b, "damage")).toBe(6);
    expect(irissPdAuto1BlockCount(b, "paint")).toBe(3);
    expect(irissPdAuto1FieldCount(b)).toBeGreaterThan(40);
  });

  it("saglabātais JSON normalizējas bez zudumiem un atmet nederīgo", () => {
    expect(normalizeIrissPdAuto1Blocks(JSON.parse(JSON.stringify(b)))).toEqual(b);
    expect(normalizeIrissPdAuto1Blocks(null)).toBeNull();
    const bad = normalizeIrissPdAuto1Blocks({ tech: [{ label: "", value: "x" }, "junk"], damage: [{ area: "hack", damage: "D" }] });
    expect(bad?.tech).toEqual([]);
    expect(bad?.damage[0]?.area).toBe("other");
  });
});

describe("Auto1 krāsas kartes zonas", () => {
  it.each([
    ["Front bumper", "front"],
    ["Hood", "front"],
    ["Front left fender", "left"],
    ["Rear right door", "right"],
    ["Tailgate", "rear"],
    ["Roof", "roof"],
    ["Right body", "right"],
    ["Driver seat", null],
  ])("%s -> %s", (part, zone) => {
    expect(irissPdPaintZoneOf(part)).toBe(zone);
  });

  it("bez µm un bojājumiem karte netiek veidota; teksta mērījumi paliek nepiesaistīti", () => {
    expect(irissPdAuto1BlocksFromDetail({ ...DETAIL, fields: [], tables: [] }).paint).toBeNull();
    const t = irissPdAuto1BlocksFromDetail({ ...DETAIL, fields: [], tables: [], text: "Exterior 129 µm 125 µm" });
    expect(t.paint?.unassigned).toEqual([129, 125]);
  });

  it("tabula bez Area/Damage galvas netiek uzskatīta par bojājumiem", () => {
    expect(parseIrissPdDamageTable([[["Foo", "Bar"], ["1", "2"]]])).toEqual([]);
  });
});
