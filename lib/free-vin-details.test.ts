import { describe, expect, it } from "vitest";
import { buildFreeVinSignals, fetchFreeVinDetails, parseUsRecalls, parseVpicDetails } from "@/lib/free-vin-details";
import { decodeVin } from "@/lib/vin-decode";

function vpicJson(row: Record<string, string>): string {
  return JSON.stringify({ Results: [row] });
}

// Īstas vPIC atbildes laukos (29.10.2026), saīsinātas.
const BMW_X5_US = {
  Make: "BMW",
  Model: "X5",
  ModelYear: "2022",
  BodyClass: "Sport Utility Vehicle [SUV]/Multipurpose Vehicle [MPV]",
  DisplacementL: "3.0",
  EngineCylinders: "6",
  EngineKW: "",
  EngineHP: "335",
  FuelTypePrimary: "Gasoline",
  DriveType: "AWD/All-Wheel Drive",
  TransmissionStyle: "Automatic",
  PlantCity: "GREER",
  PlantCountry: "UNITED STATES (USA)",
  PlantCompanyName: "",
  ErrorCode: "1",
};
const VW_EU_BAD = { Make: "VOLKSWAGEN", Model: "", ModelYear: "1984", PlantCity: "WESTMORELAND", ErrorCode: "1,5,14,400" };

function local(vin: string) {
  const d = decodeVin(vin, new Date("2026-10-29"));
  if (!d.ok) throw new Error("bad vin");
  return d;
}

function fakeFetch(routes: Record<string, { status: number; body: string }>) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    if (!hit) throw new Error("offline");
    return new Response(hit[1].body, { status: hit[1].status });
  };
  return { impl, calls };
}

describe("parseVpicDetails", () => {
  it("ASV BMW: rūpnīca, motors, piedziņa latviski", () => {
    const d = parseVpicDetails(200, vpicJson(BMW_X5_US));
    expect(d).toMatchObject({
      make: "BMW",
      model: "X5",
      modelYear: "2022",
      bodyClass: "Apvidus (SUV)",
      engine: "3,0 l, 6 cil., 250 kW",
      fuel: "Benzīns",
      drive: "Pilnpiedziņa",
      transmission: "Automātiskā",
      plantCity: "Greer",
      plantCountry: "ASV",
    });
  });

  it("Eiropas VIN ar vPIC kļūdām netiek rādīts (nepareizs gads un rūpnīca)", () => {
    expect(parseVpicDetails(200, vpicJson(VW_EU_BAD))).toBeNull();
  });

  it("tukšs ražotājs, HTTP kļūda vai ne-JSON -> null", () => {
    expect(parseVpicDetails(200, vpicJson({ Make: "", ErrorCode: "7" }))).toBeNull();
    expect(parseVpicDetails(503, "")).toBeNull();
    expect(parseVpicDetails(200, "<html>")).toBeNull();
  });
});

describe("parseUsRecalls", () => {
  it("skaita atsaukumus; 400 ar tukšu sarakstu nozīmē nav", () => {
    expect(parseUsRecalls(200, JSON.stringify({ results: [{ Component: "AIR BAGS", ReportReceivedDate: "01/02/2023" }] }))?.count).toBe(1);
    expect(parseUsRecalls(400, JSON.stringify({ results: [] }))).toEqual({ count: 0, items: [] });
    expect(parseUsRecalls(500, "")).toBeNull();
  });
});

describe("buildFreeVinSignals", () => {
  it("ASV VIN: ražots ASV, kontrolcipars nesakrīt, atsaukumi vienskaitlī", () => {
    const vpic = parseVpicDetails(200, vpicJson(BMW_X5_US));
    const s = buildFreeVinSignals({ local: local("5UXCR6C05N9K12345"), vpic, recalls: { count: 1, items: [] } });
    expect(s.map((x) => x.title)).toEqual(["Auto ražots ASV", "VIN kontrolcipars nesakrīt", "1 atsaukšanas akcija ASV"]);
  });

  it("derīgs ASV VIN bez atsaukumiem", () => {
    const vpic = parseVpicDetails(200, vpicJson({ ...BMW_X5_US, Make: "HONDA", Model: "Accord", ModelYear: "2003", ErrorCode: "0" }));
    const s = buildFreeVinSignals({ local: local("1HGCM82633A004352"), vpic, recalls: { count: 0, items: [] } });
    expect(s.map((x) => x.id)).toEqual(["north_america", "check_digit_ok", "us_recalls_none"]);
  });

  it("Eiropas VIN: nav ASV brīdinājumu", () => {
    expect(buildFreeVinSignals({ local: local("TMBJH9NP9N7043581"), vpic: null, recalls: null })).toEqual([]);
  });
});

describe("fetchFreeVinDetails", () => {
  it("Eiropas VIN: atsaukumus ASV nevaicā", async () => {
    const f = fakeFetch({ DecodeVinValues: { status: 200, body: vpicJson({ Make: "BMW", Model: "330i", ModelYear: "2020", PlantCity: "MUNICH", PlantCountry: "GERMANY", ErrorCode: "0" }) } });
    const r = await fetchFreeVinDetails(local("WBA5R1C0XLFH42873"), f.impl);
    expect(r.vpic?.plantCity).toBe("Munich");
    expect(r.vpic?.plantCountry).toBe("Vācija");
    expect(r.recalls).toBeNull();
    expect(f.calls.some((u) => u.includes("recallsByVehicle"))).toBe(false);
  });

  it("ASV VIN: vaicā atsaukumus pēc markas, modeļa, gada", async () => {
    const f = fakeFetch({
      DecodeVinValues: { status: 200, body: vpicJson(BMW_X5_US) },
      recallsByVehicle: { status: 200, body: JSON.stringify({ results: [{ Component: "SEAT BELTS" }] }) },
    });
    const r = await fetchFreeVinDetails(local("5UXCR6C05N9K12345"), f.impl);
    expect(r.recalls?.count).toBe(1);
    expect(f.calls.find((u) => u.includes("recallsByVehicle"))).toContain("model=X5&modelYear=2022");
  });

  it("NHTSA nesasniedzams: tikai lokālais dekods, bez kļūdas", async () => {
    const f = fakeFetch({});
    const r = await fetchFreeVinDetails(local("5UXCR6C05N9K12345"), f.impl);
    expect(r.vpic).toBeNull();
    expect(r.signals.map((x) => x.id)).toEqual(["north_america", "check_digit_bad"]);
  });
});
