import { describe, expect, it } from "vitest";

import { JOJ_NOT_CONFIGURED, jojSearchVinUrl, parseJojSearchVin } from "@/lib/vin-scan/parse-joj";

const VIN = "WBSAE0C06PCL70372";

/** Saīsināts JoJ/Car Stat `/search-vin` piemērs no dokumentācijas. */
const FOUND = {
  data: {
    id: 16070300,
    year: 2023,
    title: "2023 BMW M8",
    vin: VIN,
    manufacturer: { id: 16, name: "BMW" },
    model: { id: 3038, name: "M8", manufacturer_id: 16 },
    lots: [
      {
        id: 16447827,
        lot: "94166665",
        domain: { name: "copart_com", id: 3 },
        odometer: { km: 28218, mi: 17534, status: { name: "actual", id: 1 } },
        sale_date: "2026-03-25T15:55:05.000000Z",
        bid: 56500,
        final_bid: 56500,
        damage: { main: { id: 37, name: "Side" }, second: { id: 3, name: "Front End" } },
        images: {
          small: ["https://cs.copart.com/v1/thb.jpg"],
          normal: ["https://cs.copart.com/v1/hrs.jpg"],
          big: ["https://cs.copart.com/v1/hrs.jpg"],
          downloaded: ["https://cars2.import-motor.com/copart/bmw/m8/2023/94166665/WBSAE0C06PCL70372-1.webp"],
        },
        archived: true,
      },
      {
        lot: "41872206",
        domain: { name: "iaai_com", id: 1 },
        sale_date: "2026-03-11T14:00:00.000000Z",
        final_bid: 8450,
        odometer: { km: 91000, mi: 56500 },
        damage: { main: { name: "Front End" } },
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
    expect(r.media?.photoCount).toBeGreaterThanOrEqual(2);
    expect(r.openUrl).toContain("94166665");
    expect(r.mileage?.[0]?.odometer).toMatch(/km/);
  });

  it("404 un tukši lots ir none, 423 ir unknown, 429 nav kešojama kļūda", () => {
    expect(parseJojSearchVin({ status: 404, json: {}, vin: VIN })).toMatchObject({
      status: "none",
      summary: "Nav izsoles ieraksta",
    });
    expect(parseJojSearchVin({ status: 200, json: { data: { lots: [] } }, vin: VIN }).status).toBe("none");
    expect(parseJojSearchVin({ status: 423, json: {}, vin: VIN }).summary).toMatch(/ierobežots/);
    expect(parseJojSearchVin({ status: 429, json: {}, vin: VIN }).summary).toMatch(/limits/);
    expect(parseJojSearchVin({ status: 401, json: {}, vin: VIN }).status).toBe("unknown");
  });

  it("search-vin URL un nav konfigurēts teksts", () => {
    expect(jojSearchVinUrl("wbsae0c06pcl70372", "https://copart-and-iaai-api.jojapi.net/")).toBe(
      `https://copart-and-iaai-api.jojapi.net/search-vin/${VIN}`,
    );
    expect(JOJ_NOT_CONFIGURED).toBe("nav konfigurēts");
  });
});
