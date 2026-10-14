import { describe, expect, it } from "vitest";

import {
  JOJ_NOT_CONFIGURED,
  jojSearchLotUrl,
  jojSearchVinUrl,
  jojUsaDamagesUrl,
  knownJojLotFromUrl,
  parseJojDictPage,
  parseJojSearchVin,
  parseJojSearchVinFull,
} from "@/lib/vin-scan/parse-joj";

const VIN = "WBSAE0C06PCL70372";

/** Saīsināts JoJ/Car Stat `/search-vin` piemērs no OpenAPI. */
const FOUND = {
  data: {
    id: 16070300,
    year: 2023,
    title: "2023 BMW M8",
    vin: VIN,
    manufacturer: { id: 16, name: "BMW" },
    model: { id: 3038, name: "M8", manufacturer_id: 16 },
    generation: { name: "F91" },
    body_type: { name: "Coupe" },
    color: { name: "Black" },
    engine: { name: "4.4L V8" },
    transmission: { name: "Automatic" },
    drive_wheel: { name: "AWD" },
    vehicle_type: { name: "Passenger" },
    fuel: { name: "Gasoline" },
    cylinders: 8,
    hp: 617,
    lots: [
      {
        id: 16447827,
        lot: "94166665",
        domain: { name: "copart_com", id: 3 },
        odometer: { km: 28218, mi: 17534, status: { name: "actual", id: 1 } },
        sale_date: "2026-03-25T15:55:05.000000Z",
        sale_date_updated_at: "2026-03-24T10:00:00.000000Z",
        bid: 56000,
        bid_updated_at: "2026-03-25T15:00:00.000000Z",
        final_bid: 56500,
        final_bid_updated_at: "2026-03-25T15:55:05.000000Z",
        buy_now: 62000,
        buy_now_updated_at: "2026-03-20T12:00:00.000000Z",
        seller_reserve: { price: 50000, updated_at: "2026-03-18T08:00:00.000000Z" },
        estimate_repair_price: 4200,
        pre_accident_price: 89000,
        clean_wholesale_price: 71000,
        actual_cash_value: 74000,
        damage: { main: { id: 37, name: "Side" }, second: { id: 3, name: "Front End" } },
        status: { name: "sold" },
        auction_type: { name: "pure_sale" },
        condition: { name: "run_and_drives" },
        airbags: { name: "Deployed" },
        keys_available: true,
        grade_iaai: "",
        title: { id: 12, name: "Salvage" },
        detailed_title: { id: 44, name: "SALVAGE TITLE" },
        note: "Rear damage noted",
        tags: ["flood"],
        seller: { name: "GEICO", is_insurance: true, is_rental: false, is_credit_company: false },
        seller_type: { name: "Insurance" },
        location: {
          country: { iso: "US", name: "United States" },
          state: { name: "CA" },
          city: { name: "Los Angeles" },
          postal_code: "90001",
        },
        selling_branch: { name: "Los Angeles", number: "CA-01" },
        images: {
          small: ["https://cs.copart.com/v1/thb.jpg"],
          normal: ["https://cs.copart.com/v1/hrs.jpg"],
          big: ["https://cs.copart.com/v1/hrs.jpg"],
          exterior: ["https://cs.copart.com/v1/ext.jpg"],
          interior: ["https://cs.copart.com/v1/int.jpg"],
          downloaded: ["https://cars2.import-motor.com/copart/bmw/m8/2023/94166665/WBSAE0C06PCL70372-1.webp"],
          video: "https://cs.copart.com/v1/clip.mp4",
        },
        details: { drivetrain: "AWD" },
        prices: [
          { sale_date: "2026-03-18", bid: 48000, buy_now_price: 62000, status: { name: "not_sold" } },
          { sale_date: "2026-03-25", bid: 56500, status: { name: "sold" } },
        ],
        archived: true,
      },
      {
        lot: "41872206",
        domain: { name: "iaai_com", id: 1 },
        sale_date: "2026-03-11T14:00:00.000000Z",
        final_bid: 8450,
        odometer: { km: 91000, mi: 56500 },
        damage: { main: { name: "Front End" } },
        grade_iaai: "3.5",
        images: { normal: ["https://vis.iaai.com/image.jpg"] },
      },
    ],
  },
};

describe("parseJojSearchVin", () => {
  it("nolasa Copart un IAAI lots: lots nr, datums, bojājums, odometrs, final bid, foto", () => {
    const r = parseJojSearchVin({ status: 200, json: FOUND, vin: VIN });
    expect(r.status).toBe("found");
    expect(r.vehicle).toMatchObject({ make: "BMW", model: "M8", year: "2023" });
    expect(r.auctions).toHaveLength(2);
    expect(r.auctions?.[0]).toMatchObject({
      venue: "Copart",
      date: "2026-03-25",
    });
    expect(r.auctions?.[0]?.price?.replace(/\s/g, " ")).toBe("56 500 USD");
    expect(r.auctions?.[0]?.title).toContain("lots 94166665");
    expect(r.auctions?.[0]?.title).toContain("Side / Front End");
    expect(r.auctions?.[0]?.title).toMatch(/28.?218 km/);
    expect(r.auctions?.[1]).toMatchObject({ venue: "IAAI", date: "2026-03-11" });
    expect(r.media?.photoUrls?.[0]).toContain("import-motor.com");
    expect(r.media?.photoUrls).toEqual(
      expect.arrayContaining([
        "https://cs.copart.com/v1/hrs.jpg",
        "https://cs.copart.com/v1/ext.jpg",
        "https://cs.copart.com/v1/int.jpg",
      ]),
    );
    expect(r.media?.photoCount).toBeGreaterThanOrEqual(4);
    expect(r.openUrl).toContain("94166665");
    expect(r.mileage?.[0]?.odometer).toMatch(/km/);
  });

  it("kartē visus lot un specifikācijas laukus latviski, ieskaitot cenu vēsturi", () => {
    const { parse, facts } = parseJojSearchVinFull({
      status: 200,
      json: FOUND,
      vin: VIN,
      dict: { damages: { "37": "Sāns" }, titles: { "12": "Salvage (vārdnīca)" } },
    });
    expect(parse.detail).toContain("Jauda: 617 ZS");
    expect(parse.detail).toContain("Dzinējs: 4.4L V8");
    expect(parse.detail).toContain("Ātrumkārba: Automatic");
    expect(parse.detail).toContain("Piedziņa: AWD");
    expect(parse.detail).toContain("Degviela: Gasoline");
    expect(parse.detail).toContain("Krāsa: Black");
    expect(parse.detail).toContain("Virsbūve: Coupe");
    expect(parse.detail).toContain("Lots: 94166665");
    expect(parse.detail).toContain("Statuss: pārdots");
    expect(parse.detail).toContain("Izsoles veids: tīrā izsole");
    expect(parse.detail).toContain("Pārdošanas datums: 25.03.2026");
    expect(parse.detail).toMatch(/Piedāvājums: 56.?000 USD/);
    expect(parse.detail).toMatch(/Gala likme: 56.?500 USD/);
    expect(parse.detail).toMatch(/Buy Now: 62.?000 USD/);
    expect(parse.detail).toMatch(/Rezerves cena: 50.?000 USD/);
    expect(parse.detail).toMatch(/Remonta tāme: 4.?200 USD/);
    expect(parse.detail).toMatch(/Cena pirms negadījuma: 89.?000 USD/);
    expect(parse.detail).toMatch(/Tīrā vairumtirdzniecības cena: 71.?000 USD/);
    expect(parse.detail).toMatch(/Faktiskā naudas vērtība: 74.?000 USD/);
    expect(parse.detail).toContain("Odometrs:");
    expect(parse.detail).toContain("faktiskais");
    expect(parse.detail).toContain("Bojājums (galvenais): Sāns");
    expect(parse.detail).toContain("Bojājums (papildu): Front End");
    expect(parse.detail).toContain("Stāvoklis: brauc");
    expect(parse.detail).toContain("Drošības spilveni: Deployed");
    expect(parse.detail).toContain("Atslēgas: jā");
    expect(parse.detail).toContain("Title: Salvage (vārdnīca)");
    expect(parse.detail).toContain("Piezīme: Rear damage noted");
    expect(parse.detail).toContain("Birkas: flood");
    expect(parse.detail).toContain("Pārdevējs: GEICO · Apdrošinātājs");
    expect(parse.detail).toContain("Atrašanās vieta: Los Angeles, CA, United States");
    expect(parse.detail).toContain("Filiāle: Los Angeles · CA-01");
    expect(parse.detail).toContain("Cenu vēsture:");
    expect(parse.detail).toContain("Video: https://cs.copart.com/v1/clip.mp4");
    expect(parse.detail).toContain("IAAI pakāpe: 3.5");
    expect(parse.jojFacts?.sales[0]?.venue).toBe("Copart");
    expect(facts.damages[0]?.description).toContain("Sāns");
    expect(facts.titles[0]?.note).toContain("Salvage (vārdnīca)");
    expect(facts.insurance[0]?.label).toBe("Apdrošinātājs");
    expect(facts.mileage[0]?.odometer).toMatch(/km/);
  });

  it("404 un tukši lots ir none (nav ierakstu), 423 ir unknown, 429 nav kešojama kļūda", () => {
    expect(parseJojSearchVin({ status: 404, json: {}, vin: VIN })).toMatchObject({
      status: "none",
      summary: "nav ierakstu",
    });
    expect(parseJojSearchVin({ status: 200, json: { data: { lots: [] } }, vin: VIN }).status).toBe("none");
    expect(parseJojSearchVin({ status: 200, json: { data: { lots: [] } }, vin: VIN }).summary).toBe("nav ierakstu");
    expect(parseJojSearchVin({ status: 423, json: {}, vin: VIN }).summary).toMatch(/ierobežots/);
    expect(parseJojSearchVin({ status: 429, json: {}, vin: VIN }).summary).toMatch(/limits/);
    expect(parseJojSearchVin({ status: 401, json: {}, vin: VIN }).status).toBe("unknown");
  });

  it("search-vin URL ar prices_history, search-lot un lots no sludinājuma", () => {
    expect(jojSearchVinUrl("wbsae0c06pcl70372", "https://carstat-copart-iaai.jojapi.net/")).toBe(
      `https://carstat-copart-iaai.jojapi.net/search-vin/${VIN}?prices_history=1`,
    );
    expect(jojSearchLotUrl("94166665", "copart_com", "https://carstat-copart-iaai.jojapi.net")).toBe(
      "https://carstat-copart-iaai.jojapi.net/search-lot/94166665/copart_com?prices_history=1",
    );
    expect(knownJojLotFromUrl("https://www.copart.com/lot/94166665")).toEqual({
      lot: "94166665",
      domain: "copart_com",
    });
    expect(jojUsaDamagesUrl("https://carstat-copart-iaai.jojapi.net", 2)).toBe(
      "https://carstat-copart-iaai.jojapi.net/usa/damages?page=2",
    );
    expect(parseJojDictPage({ data: [{ id: 37, name: "Side" }], next_page_url: "" }, "damages")).toEqual({
      entries: { "37": "Side" },
      nextPageUrl: "",
    });
    expect(JOJ_NOT_CONFIGURED).toBe("nav konfigurēts");
  });
});
