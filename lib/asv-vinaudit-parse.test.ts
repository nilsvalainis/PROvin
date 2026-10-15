import { beforeEach, describe, expect, it } from "vitest";
import { setEcbDailyRatesForTests } from "@/lib/currency-eur-convert";
import { asvProductsCostUsdCents, asvProductPaths, formatAsvCostUsd, parseAsvProductIds } from "@/lib/asv-catalog";
import { ASV_PRODUCTS } from "@/lib/asv-catalog";
import { collectAsvImageHints, milesToKmRounded, parseVinauditPayload } from "@/lib/asv-vinaudit-parse";
import { asvBlockHasContent, asvBlockToPlainText, normalizeAsvBlock } from "@/lib/asv-report";

const SAMPLE = {
  success: true,
  id: "va_report_99",
  vin: "1HGCM82633A004352",
  date: "2018-03-02 09:47:20 PST",
  attributes: { year: "2003", make: "HONDA", model: "ACCORD", owner_count: "3" },
  titles: [{ date: "2011-05-20", meter: "25000", meter_unit: "M", state: "CA" }],
  salvage: [
    {
      date: "2015-06-12",
      listing_id: "12345678",
      location: "COPART - DALLAS TX",
      damages: "FRONT END",
      odometer: "45000",
      sale_document: "SALVAGE CERTIFICATE",
      images: ["https://images.example.test/crash1.jpg"],
    },
  ],
  accidents: [
    {
      date: "2015-06-01",
      collision: "FRONT",
      impact: "MODERATE",
      estimated_damage: "4500 USD",
      state: "TX",
    },
  ],
  sale: [{ date: "2016-01-10", seller: "Dealer", price: "12000", odometer: "52000", state: "TX" }],
  checks: {
    salvage: true,
    rebuilt: false,
    flood: false,
    lemon: false,
    odometer: false,
    theft: false,
  },
  lien: [{ date: "2012-01-01", state: "CA", type: "bank lien" }],
  thefts: [],
  clean: false,
};

describe("ASV catalog", () => {
  it("shows Lite as the cheap screening product", () => {
    expect(parseAsvProductIds(["vhr_lite", "vhr_full", "vhr_lite"])).toEqual(["vhr_lite", "vhr_full"]);
    expect(formatAsvCostUsd(asvProductsCostUsdCents(["vhr_lite"]))).toBe("$0.55");
    expect(formatAsvCostUsd(asvProductsCostUsdCents(["vhr_full"]))).toBe("$4.50");
    const lite = ASV_PRODUCTS.find((p) => p.id === "vhr_lite")!;
    expect(asvProductPaths(lite, "/custom/lite/")[0]).toBe("/custom/lite/");
    expect(ASV_PRODUCTS.find((p) => p.id === "vhr_full")?.path).toBe("/vinaudit/vehiclehistoryreport/us");
    expect(lite.path).toBe("/vinaudit/vehiclehistoryreportlite/us");
  });
});

describe("parseVinauditPayload", () => {
  beforeEach(() => {
    setEcbDailyRatesForTests({ date: "2026-10-15", rates: { USD: 1.09 } });
  });

  it("converts title miles to km and keeps US region", () => {
    const { block, imageHints } = parseVinauditPayload(SAMPLE, {
      productUsed: "vhr_full",
      costUsd: "$4.50",
      vin: "1HGCM82633A004352",
    });
    expect(asvBlockHasContent(block)).toBe(true);
    const title = block.titles.find((r) => r.region.includes("CA"));
    expect(title?.odometer).toBe(String(milesToKmRounded(25000)));
    expect(title?.date).toMatch(/20\.05\.2011|2011/);
    expect(block.attentionMarks).toBe("1/6");
    expect(block.ownersCount).toBe("3");
    expect(block.damages.some((d) => /FRONT/i.test(d.description))).toBe(true);
    expect(block.damages.find((d) => /FRONT/i.test(d.description))?.amount).toMatch(/€/);
    expect(block.sales.some((s) => /€/.test(s.price))).toBe(true);
    expect(block.sales.some((s) => /COPART/i.test(s.venue))).toBe(true);
    expect(block.liens.some((r) => /ķīla|lien/i.test(`${r.label} ${r.detail}`))).toBe(true);
    expect(block.aiContextRaw).toContain("Servisa apmeklējumi");
    expect(block.aiContextRaw).not.toMatch(/VIN Audit|Carfax/i);
    expect(imageHints.some((h) => h.url.includes("crash1.jpg"))).toBe(true);
    const plain = asvBlockToPlainText(block);
    expect(plain).toContain("ASV VĒSTURE");
    expect(plain).not.toMatch(/VIN Audit|Carfax/i);
  });

  it("unwraps One Auto result wrapper", () => {
    const { block } = parseVinauditPayload({ success: true, result: SAMPLE });
    expect(block.reportId).toBe("va_report_99");
    expect(block.mileage.some((r) => r.odometer === String(milesToKmRounded(25000)))).toBe(true);
  });

  it("maps official /vinaudit/vehiclehistoryreport/us dictionary", () => {
    const { block } = parseVinauditPayload(
      {
        success: true,
        result: {
          vehicle_data: {
            report_id: "oneautoapi.1234567890",
            vehicle_history_checked_datetime: "2026-09-05 06:09:11 PDT",
            vehicle_identification_number: "2HGES16501H666666",
            model_year: 2001,
            manufacturer_desc: "Honda",
            model_range_desc: "Civic",
            trim_desc: "LX",
          },
          titles: [
            {
              state_code: "PA",
              title_issued_date: "2005-09-27",
              mileage: 42781,
              mileage_unit: "mi",
              is_current: true,
            },
          ],
          title_brands: [
            {
              date: "2005-09-27",
              brand_title: "Salvage: Damage or Not Specified",
              brander_name: "PENNSYLVANIA",
            },
          ],
          salvage_data: [
            {
              salvage_auction_lot_date: "2020-06-08",
              salvage_auction_location: "CA - Los Angeles",
              salvage_auction_record_id: 123456,
              primary_damage_desc: "Front End",
              secondary_damage_desc: "Rear End",
              mileage: "12345",
            },
          ],
          accidents: [
            {
              report_date: "2015-11-04",
              damage_severity: "high",
              impact_point: "front end",
              source: { state_code: "CA" },
            },
          ],
          thefts: [{ stolen_date: "2013-12-24", record_type: "Theft Recovery", theft_reported_state: "FL" }],
          liens: [{ date: "2020-12-06", state_code: "FL", agency: "Westlake Financial Services" }],
          sales_data: [
            {
              record_date: "2019-11-18",
              advertised_price: 32194,
              mileage_observed: 9914,
              seller_details: { name: "Hatch Honda", state_code: "AZ", seller_type: "Dealer" },
            },
          ],
        },
      },
      { productUsed: "vhr_full", vin: "2HGES16501H666666" },
    );
    expect(block.reportId).toBe("oneautoapi.1234567890");
    expect(block.titles[0]?.odometer).toBe(String(milesToKmRounded(42781)));
    expect(block.titles[0]?.note).toMatch(/aktuālais/i);
    expect(block.brands.some((r) => /Salvage/i.test(r.label))).toBe(true);
    expect(block.damages.some((d) => /front end/i.test(d.description))).toBe(true);
    expect(block.sales.some((s) => /Hatch Honda/i.test(s.venue))).toBe(true);
    expect(block.liens.some((r) => /Westlake/i.test(r.detail))).toBe(true);
    expect(block.thefts.some((r) => /Theft Recovery/i.test(r.label))).toBe(true);
    expect(block.checks.some((c) => c.severity === "alert" && /salvage/i.test(c.label))).toBe(true);
    expect(block.reportDate).toBe("05.09.2026 16:09");
    expect(block.aiContextRaw).toMatch(/Honda Civic LX/);
    expect(asvBlockToPlainText(block)).not.toMatch(/VIN Audit|Carfax/i);
  });

  it("keeps Lite checks without inventing titles", () => {
    const { block } = parseVinauditPayload({
      vin: "1HGCM82633A004352",
      checks: { salvage: false, flood: false },
      clean: true,
    });
    expect(block.checks).toHaveLength(2);
    expect(block.checks.every((c) => c.severity === "ok")).toBe(true);
    expect(block.titles.every((t) => !t.date && !t.odometer)).toBe(true);
  });
});

describe("collectAsvImageHints", () => {
  it("walks nested salvage photos", () => {
    const hints = collectAsvImageHints({
      salvage: [{ photos: ["https://iaai.example.test/lot/1/photo.jpg"] }],
    });
    expect(hints).toHaveLength(1);
  });
});

describe("normalizeAsvBlock", () => {
  it("pads empty tables", () => {
    const b = normalizeAsvBlock({ comments: "x" });
    expect(b.mileage).toHaveLength(1);
    expect(b.damages).toHaveLength(1);
  });

  it("saglabā JoJ keša un lota laukus", () => {
    const b = normalizeAsvBlock({
      jojIngest: {
        lastFetchedVin: "WBSAE0C06PCL70372",
        fetchedAt: "2026-03-25T12:00:00.000Z",
        lastCostUsd: "$0.00",
        status: "none",
        summary: "nav ierakstu",
        fromCache: true,
        cachedAt: "2026-03-25T12:00:00.000Z",
        httpStatus: 404,
        lot: "41872206",
        lotDomain: "iaai_com",
      },
    });
    expect(b.jojIngest).toMatchObject({
      fromCache: true,
      cachedAt: "2026-03-25T12:00:00.000Z",
      httpStatus: 404,
      lot: "41872206",
      lotDomain: "iaai_com",
      lastCostUsd: "$0.00",
      status: "none",
    });
  });
});

describe("VHR Lite documented field names", () => {
  it("maps Lite accident/salvage cost, mileage and airbag fields", () => {
    const { block } = parseVinauditPayload({
      success: true,
      result: {
        vehicle_data: { report_id: "oneautoapi.1", vehicle_identification_number: "4T1BK3DB5BU666666" },
        salvage_data: [
          {
            salvage_auction_lot_date: "2020-10-21",
            primary_damage_desc: "Front End",
            estimated_damage_usd: 12010,
            mileage_observed: 23762,
            salvage_auction_location: "OH - Columbia Station",
          },
        ],
        accidents: [
          {
            report_date: "2013-01-01",
            damage_severity: "Property Damage Accident",
            crash_severity: "Serious",
            estimated_damage_cost: 1234,
            airbags_deployed: "Yes",
            estimated_speed: "35",
            insurer_name: "Geico",
            source: { state_code: "NY" },
          },
        ],
        thefts: [{ stolen_date: "2014-03-02", stolen_status_desc: "Stolen", theft_reported_state: "NJ" }],
      },
    });
    const acc = block.damages.find((d) => d.description.includes("Serious"))!;
    expect(acc.amount).not.toBe("");
    expect(acc.description).toContain("airbag: Yes");
    expect(acc.description).toContain("smagums: Serious");
    expect(acc.description).toContain("ātrums: 35");
    expect(acc.description).toContain("avots: Geico");
    expect(block.sales[0]!.odometer).not.toBe("");
    expect(block.damages.find((d) => d.description.includes("Front End"))!.amount).not.toBe("");
    expect(block.thefts.some((t) => t.detail.includes("Stolen"))).toBe(true);
  });

  it("falls back to salvage mileage_desc when observed miles are absent", () => {
    const { block } = parseVinauditPayload({
      success: true,
      result: {
        salvage_data: [
          {
            salvage_auction_lot_date: "2021-02-11",
            primary_damage_desc: "Side",
            mileage_desc: "44120",
            salvage_auction_location: "TX - Dallas",
          },
        ],
      },
    });
    expect(block.sales[0]!.odometer).not.toBe("");
  });
});
