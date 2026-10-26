import { describe, expect, it } from "vitest";
import {
  dedupeDamageLines,
  irissAuctionDetailToSeed,
  irissDetailMileageKm,
  lvEngineDisplacement,
  lvRegistrationDate,
  lvTerm,
  mapRelayDetailResponse,
  mergeListedIntoDetailHit,
  type IrissRelayAuctionDetail,
} from "@/lib/iriss-auction-detail";
import { parseIrissAuctionLink } from "@/lib/iriss-auction-link";
import { isPlausibleListingVin } from "@/lib/iriss-listings-extract";

/** Tas pats izvilkums, ko releja extractDetailDom atdeva īstā Chrome (j56 pārbaude). */
const auto1Detail: IrissRelayAuctionDetail = {
  platform: "auto1",
  key: "DE48213",
  url: "https://www.auto1.com/en/app/merchant/car/DE48213",
  title: "BMW 320d xDrive Touring",
  fields: [
    ["Environmental class", "Euro 6"],
    ["CO2", "128 g/km"],
    ["Fuel type", "Diesel"],
    ["Gear box", "Automatic"],
    ["Keys", "2"],
    ["Inspection expires", "05/2026"],
    ["Total number of owners", "1"],
    ["Country of origin", "Germany"],
    ["First registration", "03/2021"],
    ["Odometer", "64,312 km"],
    ["Horsepower", "140 kW (190 HP)"],
    ["Cylinder capacity", "1995 ccm"],
    ["Body type", "Station wagon"],
    ["Color (Original)", "Black"],
    ["Doors", "5"],
    ["Seats", "5"],
    ["Error, control light is on", "Yes"],
  ],
  tables: [
    [
      ["Area", "Damage", "Severity"],
      ["Front door right", "Scratch", "Minor"],
      ["Bonnet", "Repaint", "250-500 µm"],
    ],
  ],
  lists: [{ heading: "Car equipment", items: ["Navigation system", "Leather seats", "Heated seats", "Trailer hitch"] }],
  photos: ["https://img-pa.auto1.com/x/1.jpg", "https://img-pa.auto1.com/x/2.jpg"],
  jsonFields: [["vin", "WBA5A71000FH12345"]],
  item: null,
};

describe("irissAuctionDetailToSeed", () => {
  const link = parseIrissAuctionLink(auto1Detail.url)!;
  const { hit, extras } = irissAuctionDetailToSeed(auto1Detail, link);

  it("maps Auto1 detail page fields to offer hit (LV terms)", () => {
    expect(hit.title).toBe("BMW 320d xDrive Touring");
    expect(hit.vin).toBe("WBA5A71000FH12345");
    expect(hit.mileageKm).toBe(64312);
    expect(hit.firstRegistration).toBe("03.2021");
    expect(hit.year).toBe("2021");
    expect(hit.fuel).toBe("Dīzelis");
    expect(hit.transmission).toBe("Automātiskā");
    expect(hit.powerKw).toBe("140");
    expect(hit.bodyType).toBe("Universālis");
    expect(hit.color).toBe("Melna");
    expect(hit.doorCount).toBe("5/5");
    expect(hit.countryCode).toBe("Germany");
    expect(hit.stockNumber).toBe("DE48213");
    expect(hit.imageUrls).toEqual(auto1Detail.photos);
    expect(hit.imageUrl).toBe("https://img-pa.auto1.com/x/1.jpg");
  });

  it("damage table -> visual text, control light -> technical", () => {
    expect(hit.damageRaw).toContain("Front door right: Scratch, Minor");
    expect(hit.damageRaw).toContain("Bonnet: Repaint");
    expect(extras.technicalIssueText).toContain("control light");
  });

  it("extras: keys, emission, engine, equipment, TA/owners facts", () => {
    expect(extras.keyCount).toBe("2");
    expect(extras.emissionClass).toBe("Euro 6");
    expect(extras.engineDisplacement).toBe("1995 cm³");
    expect(extras.equipmentHighlights).toBe("āda, navigācija, sēdekļu apsilde, āķis");
    expect(extras.technicalFacts).toBe("TA derīga līdz: 05.2026. Īpašnieku skaits: 1");
    expect(extras.hasFullServiceHistory).toBe(false);
  });

  it("Openlane JSON keys work as labels too", () => {
    const ol = parseIrissAuctionLink("https://www.openlane.eu/en/car/info?auctionId=8123456")!;
    const r = irissAuctionDetailToSeed(
      {
        ...auto1Detail,
        platform: "openlane",
        key: "8123456",
        url: ol.url,
        title: "Volvo XC90 T8 | OPENLANE",
        fields: [],
        tables: [],
        lists: [],
        jsonFields: [
          ["ChassisNumber", "YV1LFA2BCH1234567"],
          ["Mileage", "88000"],
          ["Fuel", "PHEV"],
          ["NumberOfKeys", "2"],
          ["EuroNorm", "Euro 6d"],
          ["ServiceDocumentation", "Yes"],
        ],
      },
      ol,
    );
    expect(r.hit.platform).toBe("openline");
    expect(r.hit.auctionId).toBe("8123456");
    expect(r.hit.title).toBe("Volvo XC90 T8");
    expect(r.hit.vin).toBe("YV1LFA2BCH1234567");
    expect(r.hit.mileageKm).toBe(88000);
    expect(r.hit.fuel).toBe("Uzlādējams hibrīds");
    expect(r.extras.keyCount).toBe("2");
    expect(r.extras.emissionClass).toBe("Euro 6d");
    expect(r.extras.hasFullServiceHistory).toBe(true);
  });
});

describe("helpers", () => {
  it("lvTerm / lvRegistrationDate", () => {
    expect(lvTerm("Manual (6)")).toBe("Manuālā (6)");
    expect(lvTerm("Mauve")).toBe("Mauve");
    expect(lvRegistrationDate("2021-03-01")).toBe("01.03.2021");
    expect(lvRegistrationDate("1/3/2021")).toBe("01.03.2021");
    expect(lvRegistrationDate("3/2021")).toBe("03.2021");
  });

  it("mapRelayDetailResponse: old relay without /detail, login, ok", () => {
    expect(mapRelayDetailResponse(404, { ok: false, error: "nezināms ceļš" })).toMatchObject({ ok: false, error: "relay_detail_missing" });
    expect(mapRelayDetailResponse(200, { ok: false, status: "login_required" })).toMatchObject({ ok: false, error: "login_required" });
    expect(mapRelayDetailResponse(200, { ok: false, status: "not_found" })).toMatchObject({ ok: false, error: "not_found" });
    const ok = mapRelayDetailResponse(200, { ok: true, status: "ok", detail: { ...auto1Detail, fields: [["a", "b"], ["bad"]] } });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.detail.fields).toEqual([["a", "b"]]);
  });

  it("mergeListedIntoDetailHit fills only gaps", () => {
    const link = parseIrissAuctionLink(auto1Detail.url)!;
    const { hit } = irissAuctionDetailToSeed(auto1Detail, link);
    const listed = { ...hit, id: "list-1", fuel: "Diesel", auctionEndAt: "2026-10-27T15:00:00Z", priceCurrent: 21500, price: 21500 };
    const m = mergeListedIntoDetailHit({ ...hit, price: null, priceCurrent: null }, listed);
    expect(m.id).toBe("list-1");
    expect(m.fuel).toBe("Dīzelis");
    expect(m.auctionEndAt).toBe("2026-10-27T15:00:00Z");
    expect(m.priceCurrent).toBe(21500);
  });
});

describe("FABLE F3 (26.10): Auto1 «No saites» PE68796", () => {
  it("nobraukums 319.377 (tūkstošu punkts) → 319 377 km, ne 319", () => {
    expect(irissDetailMileageKm(319.377, "")).toBe(319377);
    expect(irissDetailMileageKm(64312, "64,312 km")).toBe(64312);
    expect(irissDetailMileageKm(null, "319.377 km")).toBe(319377);
    expect(irissDetailMileageKm(null, "")).toBeNull();
  });

  it("Auto1 heksadecimālais identifikators nav VIN; īsts VIN paliek", () => {
    expect(isPlausibleListingVin("7B7A4C2C89AE96965")).toBe(false);
    expect(isPlausibleListingVin("BFF496D701AD5C23E")).toBe(false);
    expect(isPlausibleListingVin("WVGZZZE2ZNP009103")).toBe(true);
    expect(isPlausibleListingVin("WBA5R1C0XLFH42873")).toBe(true);
    const link = parseIrissAuctionLink("https://www.auto1.com/en/app/merchant/car/PE68796")!;
    const { hit } = irissAuctionDetailToSeed(
      { platform: "auto1", key: "PE68796", url: link.url, title: "Sharan", fields: [], tables: [], lists: [], photos: [], jsonFields: [], item: { vin: "7B7A4C2C89AE96965", mileageKm: 319.377 } },
      link,
    );
    expect(hit.vin).toBe("");
    expect(hit.mileageKm).toBe(319377);
  });

  it("apvienojot paliek marka no saraksta virsraksta un viltus VIN netiek pārņemts", () => {
    const link = parseIrissAuctionLink("https://www.auto1.com/en/app/merchant/car/PE68796")!;
    const { hit } = irissAuctionDetailToSeed(
      { platform: "auto1", key: "PE68796", url: link.url, title: "", fields: [], tables: [], lists: [], photos: [], jsonFields: [], item: { title: "Sharan 2.0 TDI Karat BlueMotion Tech" } },
      link,
    );
    const listed = { ...hit, id: "03f2", title: "Volkswagen Sharan 2.0 TDI Karat BlueMotion Tech", vin: "7B7A4C2C89AE96965", mileageKm: 319377 };
    const merged = mergeListedIntoDetailHit(hit, listed);
    expect(merged.title).toBe("Volkswagen Sharan 2.0 TDI Karat BlueMotion Tech");
    expect(merged.vin).toBe("");
    expect(merged.mileageKm).toBe(319377);
  });

  it("LV termini: krāsa ar (Original), Duplex, tilpums", () => {
    expect(lvTerm("Brown (Original)")).toBe("Brūna");
    expect(lvTerm("Grey (Metallic)")).toBe("Pelēka (metāliks)");
    expect(lvTerm("Duplex")).toBe("Automātiskā (divsajūgu)");
    expect(lvTerm("Something (Original)")).toBe("Something (Original)");
    expect(lvEngineDisplacement("1,968 ccm")).toBe("1968 cm³");
    expect(lvEngineDisplacement("1995 ccm")).toBe("1995 cm³");
    expect(lvEngineDisplacement("2.0 l")).toBe("2.0 l");
  });

  it("testa brauciena teksts netiek atkārtots 4x", () => {
    expect(
      dedupeDamageLines([
        "TEST DRIVE INFORMATION: TEST DRIVE LOCATION: ON PUBLIC STREET < 80KM/H (LOWER SPEED) NO SPECIFIC FINDINGS",
        "Test drive informationTest Drive location: On public street < 80km/h (lower speed)No specific findings",
        "Test Drive location: On public street < 80km/h (lower speed)No specific findings",
        "Test Drive location: On public street < 80km/h (lower speed)",
      ]),
    ).toEqual(["TEST DRIVE INFORMATION: TEST DRIVE LOCATION: ON PUBLIC STREET < 80KM/H (LOWER SPEED) NO SPECIFIC FINDINGS"]);
    expect(dedupeDamageLines(["Door: Scratch", "Bumper: Dent"])).toEqual(["Door: Scratch", "Bumper: Dent"]);
  });
});
