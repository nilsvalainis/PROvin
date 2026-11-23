import { describe, expect, it } from "vitest";
import {
  atraSortableDate,
  atraStoryScore,
  atraSummaryText,
  atraVisibleFacts,
  atraVisiblePreviews,
  buildAtraFacts,
  formatKm,
  type AtraFactRow,
  type AtraFactsInput,
} from "@/lib/atra-parbaude-facts";
import type { DealerCheckRecord } from "@/lib/dealer-check";
import { emptyCsddTechData } from "@/lib/csdd-tech-data";

const VIN = "WBANP71040CY09201";

/** Makets 23.11: BMW 530 xd E61 (IT dīleris → LV CSDD, notīts nobraukums). */
function bmw(): AtraFactsInput {
  const rows: AtraFactRow[] = [
    {
      id: "csdd",
      label: "CSDD",
      country: "LV",
      status: "found",
      summary: "BMW 530",
      mileage: [
        { date: "13.05.2017", odometer: "254 471", source: "CSDD" },
        { date: "24.11.2025", odometer: "393 885", source: "CSDD" },
      ],
      inspections: [{ date: "24.11.2025", result: "vērt. 1", odometer: "393885" }],
    },
    {
      id: "thecarapi_eu",
      label: "EU izsoles",
      country: "EU",
      status: "found",
      summary: "1 lots",
      auctions: [{ title: "BMW 530xd", date: "2017-03-02", venue: "Itālija", photoUrl: "https://x/1.jpg", photoCount: 18 }],
    },
    { id: "nicb", label: "NICB", country: "US", status: "none", summary: "Nav" },
  ];
  const dealer = {
    vin: VIN,
    mileageRows: [{ date: "29.04.2015", odometer: "362 320 km", source: "Dīleris IT" }],
    serviceRows: [
      { date: "10.03.2007", km: "3429", works: "", dealer: "" },
      { date: "29.04.2015", km: "362320", works: "", dealer: "" },
      { date: "10.08.2024", km: "358353", works: "", dealer: "" },
    ],
  } as unknown as DealerCheckRecord;
  return {
    vin: VIN,
    plate: "OP4475",
    title: "BMW 530",
    year: "2006",
    rows,
    dealer,
    csdd: { ...emptyCsddTechData(), vin: VIN, inspectionValidUntilIso: "2026-12-02" },
    hasListing: false,
  };
}

describe("Ātrā pārbaude - fakti", () => {
  it("datumi un km", () => {
    expect(atraSortableDate("29.04.2015")).toBe("2015-04-29");
    expect(atraSortableDate("2017-05-13T00:00")).toBe("2017-05-13");
    expect(atraSortableDate("04.2015")).toBe("2015-04-01");
    expect(formatKm(501734)).toBe("501 734");
  });

  it("nobraukuma kritums un «faktiski ≥» kā maketā", () => {
    const f = buildAtraFacts(bmw());
    expect(f.mileage.drop?.km).toBe(107_849);
    expect(f.mileage.actualMinKm).toBe(501_734);
    expect(f.auctions).toMatchObject({ count: 1, years: ["2017"], photoCount: 18 });
    expect(f.dealer).toMatchObject({ visits: 3, longestGapMonths: 112, lastDate: "10.08.2024" });
    expect(f.inspection.until).toBe("02.12.2026");
    expect(f.incidents.count).toBe(0);
  });

  it("stāsta potenciāls - kods, ar iemesliem", () => {
    const score = atraStoryScore(buildAtraFacts(bmw()));
    // +3 kritums, +2 izsoles bildes, +1 >400k, +1 dīlera robs = 7
    expect(score.points).toBe(7);
    expect(score.level).toBe("augsts");
    // «Negadījumi nav» un «Nav sludinājuma» bez avota atbildes netiek rādīti.
    expect(score.reasons.map((r) => r.points)).toEqual([3, 2, 1, 1]);
    const empty = atraStoryScore(buildAtraFacts({ ...bmw(), rows: [], dealer: null, csdd: null, hasListing: true }));
    expect(empty).toMatchObject({ points: 0, level: "zems" });
  });

  it("vidējs 3-5, maksimums 10", () => {
    const input = bmw();
    const onlyDrop = atraStoryScore(buildAtraFacts({ ...input, rows: input.rows.slice(0, 1), dealer: { ...input.dealer!, serviceRows: [] } }));
    expect(onlyDrop.level).toBe("videjs");
    const loss: AtraFactRow = { id: "bid_cars", label: "bid.cars", country: "US", status: "found", summary: "Salvage title, taxi" };
    const max = atraStoryScore(buildAtraFacts({ ...input, rows: [...input.rows, loss, { ...loss, id: "x", flags: { stolen: true } }] }));
    expect(max.points).toBe(10);
  });

  it("kopsavilkums - tikai fakti", () => {
    const input = bmw();
    const f = buildAtraFacts(input);
    const text = atraSummaryText(input, f, atraStoryScore(f));
    expect(text.split("\n")).toEqual([
      `BMW 530 · 2006 · ${VIN}`,
      "Nobraukums: 2015 362 320 km → LV 2017 254 471 km (kritums ≥ 107 849 km), faktiski ≥ 501 734 km",
      "Izsoles: 2017 Itālija 18 bildes",
      "Valstis: LV · dīlera apkopes 3",
      "TA līdz 02.12.2026",
      "Stāsta potenciāls: augsts (7/10)",
    ]);
  });

  it("augšā tikai kartītes ar rezultātu", () => {
    const f = buildAtraFacts(bmw());
    // Liegumi «Jāpārbauda», Negadījumi bez avota, Cena «Nav sludinājuma» - augšā nerāda.
    expect(atraVisibleFacts(f)).toEqual(["mileage", "auctions", "countries", "dealer", "inspection"]);
    const empty = buildAtraFacts({ ...bmw(), rows: [], dealer: null, csdd: null, hasListing: true });
    expect(atraVisibleFacts(empty)).toEqual([]);
  });

  it("negadījumi augšā tikai, ja avots tiešām atrada negadījumu (bez «nav fiksēti» minējuma)", () => {
    const input = bmw();
    // VIN SCAN rindām `incidents` vienmēr ir masīvs - tukšs masīvs nav «negadījumu nav».
    const empty: AtraFactRow = { id: "lt_itpr", label: "LT policija", country: "LT", status: "found", summary: "Nav", incidents: [] };
    const f0 = buildAtraFacts({ ...input, rows: [...input.rows, empty] });
    expect(atraVisibleFacts(f0)).not.toContain("incidents");
    expect(atraSummaryText(input, f0, atraStoryScore(f0))).not.toContain("Negadījumi");
    const hit = { ...empty, incidents: [{ date: "2024-05-01", summary: "Sadursme" }] };
    const f1 = buildAtraFacts({ ...input, rows: [...input.rows, hit] });
    expect(atraVisibleFacts(f1)).toContain("incidents");
    expect(atraSummaryText(input, f1, atraStoryScore(f1))).toContain("Negadījumi: 1");
  });

  it("sludinājums augšā tikai ar datiem, ne tikai ar saiti", () => {
    const input = bmw();
    expect(atraVisibleFacts(buildAtraFacts({ ...input, hasListing: true }))).not.toContain("listing");
    const listing: AtraFactRow = {
      id: "listing_history",
      label: "Sludinājuma vēsture",
      country: "LV",
      status: "found",
      summary: "1",
      listings: [{ date: "2026-11-01", price: "4 500 €", odometer: "390 000" }],
    };
    expect(atraVisibleFacts(buildAtraFacts({ ...input, rows: [...input.rows, listing] }))).toContain("listing");
  });

  it("priekšskatījumi augšā tikai ar datiem", () => {
    const rows: AtraFactRow[] = [
      { id: "checkcar_vin", label: "CheckCar.vin", country: "EU", status: "browser_only", summary: "" },
      { id: "carfax_eu", label: "CARFAX.eu", country: "EU", status: "found", summary: "10 ieraksti" },
      { id: "autodna_precheck", label: "AutoDNA", country: "EU", status: "none", summary: "Nav" },
    ];
    const f = buildAtraFacts({ ...bmw(), rows });
    expect(f.previews.map((p) => p.id)).toEqual(["autodna_precheck", "checkcar_vin", "carfax_eu"]);
    expect(atraVisiblePreviews(f.previews).map((p) => p.id)).toEqual(["carfax_eu"]);
  });
});
