import { describe, expect, it } from "vitest";

import {
  applyDealerCoverageOutcome,
  dealerCoverageKey,
  dealerForecastMakeFromText,
  dealerForecastNextAfterOneautoNoData,
  dealerForecastPrior,
  dealerForecastYearFromVin,
  dealerForecastYearGroup,
  emptyDealerCoverageAggregate,
  forecast,
  forecastDealerCoverage,
  parseDealerCoverageAggregate,
  dealerForecastInputFromBlocks,
  type DealerForecast,
} from "@/lib/dealer-coverage-forecast";

const NOW = new Date("2026-11-27T12:00:00Z");
const row = (fc: DealerForecast, s: string) => fc.rows.find((r) => r.source === s)!;

describe("dīlera datu pārklājuma prognoze - statiskā bāze (izpēte 27.11)", () => {
  it("p₀ = avota kopējais trāpījums", () => {
    expect(dealerForecastPrior("oneauto")).toBeCloseTo(0.657, 3);
    expect(dealerForecastPrior("checkthisreg")).toBeCloseTo(0.729, 3);
    expect(dealerForecastPrior("autorecords")).toBeCloseTo(0.783, 3);
  });

  it("markas p sakrīt ar CSV (BMW, Audi, Mercedes, Volvo)", () => {
    const bmw = forecast("BMW");
    expect(row(bmw, "oneauto")).toMatchObject({ level: "augsta", hits: 66, n: 68, scope: "make" });
    expect(row(bmw, "oneauto").p).toBeCloseTo(0.953, 3);
    expect(row(bmw, "checkthisreg").p).toBeCloseTo(0.955, 3);
    expect(row(bmw, "autorecords").p).toBeCloseTo(0.969, 3);
    expect(row(forecast("Audi"), "oneauto").p).toBeCloseTo(0.406, 3);
    expect(row(forecast("Audi"), "oneauto").level).toBe("zema");
    // 0.746 - zem 75% sliekšņa
    expect(row(forecast("Mercedes-Benz"), "oneauto").level).toBe("vidēja");
    expect(row(forecast("Volvo"), "autorecords").p).toBeCloseTo(0.844, 3);
  });

  it("marka + gadu grupa: p₀ = markas p (CSV vērtības)", () => {
    expect(row(forecast("BMW", 2010), "oneauto").p).toBeCloseTo(0.993, 3);
    expect(row(forecast("BMW", 2010), "oneauto").scope).toBe("year");
    expect(row(forecast("Audi", 2011), "oneauto").p).toBeCloseTo(0.101, 3);
    expect(row(forecast("Volkswagen", 2018), "oneauto").p).toBeCloseTo(0.802, 3);
    expect(row(forecast("Volvo", 2021), "oneauto").p).toBeCloseTo(0.133, 3);
  });

  it("gadu grupā <2 novērojumi - ņem markas līmeni", () => {
    // BMW ≤2012 CheckThisReg: 1/1 -> markas 20/20
    const r = row(forecast("BMW", 2010), "checkthisreg");
    expect(r).toMatchObject({ scope: "make", hits: 20, n: 20, level: "augsta" });
  });

  it("<2 novērojumi markai - «nav zināms»; nezināma marka - p₀", () => {
    expect(row(forecast("Volvo"), "checkthisreg").level).toBe("nav zināms");
    expect(row(forecast("Mazda"), "oneauto").level).toBe("nav zināms");
    const lada = forecast("Lada");
    expect(lada.make).toBeNull();
    expect(lada.rows.every((r) => r.level === "nav zināms" && r.scope === "prior")).toBe(true);
    expect(lada.order[0]).toBe("oneauto");
  });

  it("sliekšņi: zema Tesla / Ford", () => {
    expect(row(forecast("Tesla"), "oneauto").level).toBe("zema");
    expect(row(forecast("Ford"), "oneauto").level).toBe("zema");
  });
});

describe("ieteicamā secība (.md tabula)", () => {
  it("BMW, Mercedes, Audi, VW, Skoda, Opel, Renault - OneAuto pirmais, 2. pēc tabulas", () => {
    expect(forecast("BMW", 2015).order[0]).toBe("oneauto");
    expect(forecast("Mercedes-Benz", 2010).order.slice(0, 2)).toEqual(["oneauto", "autorecords"]);
    expect(forecast("Audi", 2011).order.slice(0, 2)).toEqual(["oneauto", "checkthisreg"]);
    expect(forecast("Audi", 2015).order.slice(0, 2)).toEqual(["oneauto", "checkthisreg"]);
    expect(forecast("Audi", 2018).order.slice(0, 2)).toEqual(["oneauto", "checkthisreg"]);
    expect(forecast("Volkswagen", 2010).order[0]).toBe("oneauto");
    expect(forecast("Volkswagen", 2021).order.slice(0, 2)).toEqual(["oneauto", "checkthisreg"]);
    expect(forecast("Skoda", 2021).order.slice(0, 2)).toEqual(["oneauto", "checkthisreg"]);
    expect(forecast("Opel", 2018).order.slice(0, 2)).toEqual(["oneauto", "autorecords"]);
    expect(forecast("Renault").order.slice(0, 2)).toEqual(["oneauto", "checkthisreg"]);
  });

  it("Volvo - auto-records pirmais, tad OneAuto (visi gadi)", () => {
    for (const y of [2010, 2015, 2018, 2022, null]) {
      expect(forecast("Volvo", y).order.slice(0, 2)).toEqual(["autorecords", "oneauto"]);
    }
  });

  it("rindas ieteicamajā secībā; nākamais pēc OneAuto «datu nav»", () => {
    const fc = forecast("Mercedes-Benz", 2010);
    expect(fc.rows.map((r) => r.source)).toEqual(fc.order);
    expect(dealerForecastNextAfterOneautoNoData(fc)).toBe("autorecords");
    expect(dealerForecastNextAfterOneautoNoData(forecast("Volvo"))).toBe("autorecords");
  });
});

describe("marka un gads", () => {
  it("normalizācija: VW, Mercedes, Škoda, Range Rover", () => {
    expect(dealerForecastMakeFromText("VW Golf")).toBe("Volkswagen");
    expect(dealerForecastMakeFromText("MERCEDES-BENZ E 220")).toBe("Mercedes-Benz");
    expect(dealerForecastMakeFromText("Mercedes C 200")).toBe("Mercedes-Benz");
    expect(dealerForecastMakeFromText("ŠKODA OCTAVIA")).toBe("Skoda");
    expect(dealerForecastMakeFromText("LAND ROVER RANGE ROVER")).toBe("Land Rover");
    expect(dealerForecastMakeFromText("BMW MINI COOPER")).toBe("BMW");
    expect(dealerForecastMakeFromText("")).toBeNull();
  });

  it("MINI -> BMW grupa (nav savas statistikas)", () => {
    const fc = forecast("MINI Cooper S", 2016);
    expect(fc.make).toBe("MINI");
    expect(fc.statsMake).toBe("BMW");
    expect(row(fc, "oneauto").level).toBe("augsta");
  });

  it("VIN: WMI marka tikai bez teksta; 10. zīme tikai drošām markām", () => {
    const vw = forecastDealerCoverage({ vin: "WVWZZZ3CZKE000000", now: NOW });
    expect(vw.make).toBe("Volkswagen");
    expect(vw.year).toBe(2019);
    expect(vw.yearGroup).toBe("2017-2019");
    // BMW EU VIN gadu nekodē
    expect(dealerForecastYearFromVin("WBA8A71070K000000", "BMW", NOW)).toBeNull();
    const bmw = forecastDealerCoverage({ vin: "WBA8A71070K000000", now: NOW });
    expect(bmw.make).toBe("BMW");
    expect(bmw.year).toBeNull();
    // Teksta marka noteicošā, VIN WMI netiek lietots
    expect(forecastDealerCoverage({ makeTexts: ["Lada Niva"], vin: "WVWZZZ3CZKE000000" }).make).toBeNull();
  });

  it("CSDD gads ir pirms VIN", () => {
    const fc = forecastDealerCoverage({ make: "Volkswagen", year: "2011-05-03", vin: "WVWZZZ3CZKE000000", now: NOW });
    expect(fc.year).toBe(2011);
    expect(fc.yearGroup).toBe("le2012");
  });

  it("gadu grupas robežas", () => {
    expect(dealerForecastYearGroup(2012)).toBe("le2012");
    expect(dealerForecastYearGroup(2013)).toBe("2013-2016");
    expect(dealerForecastYearGroup(2019)).toBe("2017-2019");
    expect(dealerForecastYearGroup(2020)).toBe("2020+");
    expect(dealerForecastYearGroup(null)).toBeNull();
  });

  it("ievade no pasūtījuma blokiem (CSDD API marka + izlaiduma gads)", () => {
    const input = dealerForecastInputFromBlocks(
      { csdd: { makeModel: "AUDI A6", firstRegistration: "12.03.2015", registry: { data: { make: "AUDI", year: "2014" } } } },
      "WAUZZZ4G0EN000000",
    );
    expect(input.year).toBe(2014);
    const fc = forecastDealerCoverage(input);
    expect(fc.make).toBe("Audi");
    expect(fc.yearGroup).toBe("2013-2016");
    expect(row(fc, "oneauto").level).toBe("zema");
  });
});

describe("dinamiskais agregāts (Blob)", () => {
  it("pieskaita markai un gadu grupai, idempotenti pēc seenId", () => {
    let agg = emptyDealerCoverageAggregate();
    const o = { seenId: "0123456789abcdef", source: "oneauto" as const, make: "Volvo", yearGroup: "2020+" as const, hasData: true };
    const first = applyDealerCoverageOutcome(agg, o);
    expect(first.changed).toBe(true);
    agg = first.next;
    expect(agg.counts[dealerCoverageKey("Volvo", "all", "oneauto")]).toEqual([1, 1]);
    expect(agg.counts[dealerCoverageKey("Volvo", "2020+", "oneauto")]).toEqual([1, 1]);
    expect(applyDealerCoverageOutcome(agg, o).changed).toBe(false);
  });

  it("nezināma marka - tikai avota kopsummā", () => {
    const { next } = applyDealerCoverageOutcome(emptyDealerCoverageAggregate(), {
      seenId: "fedcba9876543210",
      source: "checkthisreg",
      make: null,
      yearGroup: "2020+",
      hasData: false,
    });
    expect(Object.keys(next.counts)).toEqual(["?|all|checkthisreg"]);
    expect(dealerForecastPrior("checkthisreg", next.counts)).toBeCloseTo(43 / 60, 4);
  });

  it("forecast apvieno statisko bāzi ar agregātu", () => {
    const counts = {
      [dealerCoverageKey("Volvo", "all", "oneauto")]: [20, 20],
      [dealerCoverageKey("Volvo", "2020+", "oneauto")]: [20, 20],
    } as const;
    const base = forecast("Volvo", 2022);
    const merged = forecast("Volvo", 2022, counts);
    expect(row(merged, "oneauto").n).toBe(26);
    expect(row(merged, "oneauto").p).toBeGreaterThan(row(base, "oneauto").p);
    // Marka bez statiskiem datiem kļūst zināma no agregāta
    const citroen = forecast("Citroen", null, { [dealerCoverageKey("Citroen", "all", "oneauto")]: [3, 3] });
    expect(citroen.statsMake).toBe("Citroen");
    expect(row(citroen, "oneauto").level).toBe("augsta");
  });

  it("parse noraida bojātus ierakstus un VIN-līdzīgas atslēgas", () => {
    const agg = parseDealerCoverageAggregate({
      counts: { "BMW|all|oneauto": [2, 3], bad: [1, 1], "BMW|all|checkthisreg": [5, 2] },
      seen: ["0123456789abcdef", "WBA8A71070K000000"],
    });
    expect(agg.counts).toEqual({ "BMW|all|oneauto": [2, 3] });
    expect(agg.seen).toEqual(["0123456789abcdef"]);
  });
});
