import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts, LISTING_BELOW_RECORDED_LINE_PREFIX } from "@/lib/canonical-facts-sheet";
import { classifyOdometerAnomalies } from "@/lib/odometer-anomaly-classify";
import {
  analyzeUnifiedMileageAnomalies,
  differsBySingleDigit,
  findSameDaySourceEntryErrors,
  isMileageCountryChange,
  parseOdometerKm,
  sortMileageChronological,
  singleDigitTypoFitsBetween,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";
import { isVendorTimelineListingRecord } from "@/lib/vendor-timeline-listing";

/**
 * 19.11 (Nils): nobraukuma datu ievades kļūdas un sludinājumi. Rindas anonimizētas pēc reālām BMW lietām
 * (/_PROv): tikai datumi, km, avots un valsts.
 */

const DEALER = "OFICIĀLĀ DĪLERA DATI";

let order = 0;
const row = (
  date: string,
  km: number,
  sourceLabel = DEALER,
  country = "Vācija",
  datePrecision: "day" | "month" = "day",
): UnifiedMileageRow => {
  const [d, m, y] = date.split(".").map(Number);
  return {
    date,
    odometer: String(km),
    country,
    sortableTime: Date.UTC(y!, m! - 1, d!),
    sourceOrder: order++,
    sourceLabel,
    datePrecision,
  };
};

const pts = (rows: UnifiedMileageRow[]) =>
  sortMileageChronological(rows).map((r) => ({
    sourceOrder: r.sourceOrder,
    km: parseOdometerKm(r.odometer)!,
    time: r.sortableTime,
    row: r,
  }));
const classes = (rows: UnifiedMileageRow[]) =>
  classifyOdometerAnomalies(rows).map((c) => `${c.class}:${c.toDate}:${c.toKm}`);
const redRows = (rows: UnifiedMileageRow[]) => {
  const a = analyzeUnifiedMileageAnomalies(rows);
  return rows.filter((r) => a.anomalyBySourceOrder.get(r.sourceOrder)).map((r) => `${r.date}:${r.odometer}`);
};

describe("kļūdains pirmais rādījums ar mēneša precizitāti (BMW 320d Touring 2012)", () => {
  it("CV 11.2012 89 960 -> dīleris 04.12.2012 2 954: kļūda ir CV rādījums, dīleris nav sarkans", () => {
    const rows = [
      row("01.11.2012", 89_960, "CarVertical", "Nezināmā", "month"),
      row("04.12.2012", 2_954),
      row("01.01.2013", 8_990, "CarVertical", "Vācija", "month"),
      row("30.01.2013", 9_000),
      row("30.04.2013", 17_813),
    ];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect([...a.dataEntryErrorSourceOrders]).toEqual([rows[0]!.sourceOrder]);
    expect(redRows(rows)).toEqual([]);
    expect(classes(rows)).toEqual(["typo_outlier:01.11.2012:89960"]);
  });

  it("dienas precizitātes pirmais rādījums ar 33 dienu atstarpi - kā līdz šim netiek aiztikts", () => {
    const rows = [row("01.11.2012", 89_960), row("04.12.2012", 2_954), row("01.01.2013", 8_990), row("30.01.2013", 9_000)];
    expect(analyzeUnifiedMileageAnomalies(rows).dataEntryErrorSourceOrders.size).toBe(0);
  });

  it("'Nezināmā' valsts nav valsts maiņa", () => {
    expect(isMileageCountryChange({ country: "Nezināmā" }, { country: "Vācija" })).toBe(false);
    expect(isMileageCountryChange({ country: "Zviedrija" }, { country: "Latvija" })).toBe(true);
  });
});

describe("sludinājums nav novecojis dokuments", () => {
  it("noapaļots sludinājuma km, kas sakrīt ar agrāku līmeni, ir 'sludinājumā mazāk', ne dokuments", () => {
    const rows = [
      row("04.12.2012", 2_954),
      row("01.04.2013", 89_900, "CarVertical", "Vācija", "month"),
      row("18.08.2015", 103_880),
      row("27.09.2015", 90_000, "AutoDNA (sludinājums)"),
      row("12.10.2015", 107_993),
    ];
    // Pirmie divi: mākslīgs piemērs, lai 90 000 "atkārtotu" agrāku līmeni (kā kļūdainais 89 960 īstajā lietā).
    const a = analyzeUnifiedMileageAnomalies(rows);
    const listing = rows[3]!.sourceOrder;
    expect(a.listingBelowRecordedSourceOrders.has(listing)).toBe(true);
    expect(a.staleDocumentSourceOrders.has(listing)).toBe(false);
    expect(a.chartExcludeSourceOrders.has(listing)).toBe(true);
    expect(a.anomalyBySourceOrder.get(listing)).toBe(false);
  });

  it("AutoDNA formulējums 'Automašīna tiek piedāvāta pārdošanai' ir sludinājums", () => {
    expect(isVendorTimelineListingRecord("Automašīna tiek piedāvāta pārdošanai")).toBe(true);
    expect(isVendorTimelineListingRecord("Pārdošanai piedāvātas automašīnas (30800 EUR)")).toBe(true);
    expect(isVendorTimelineListingRecord("Izlikts pārdošanā")).toBe(true);
    expect(isVendorTimelineListingRecord("Veikta periodiska tehniskā apskate: Izgāja")).toBe(false);
  });
});

describe("viena cipara izlēcējs uz augšu (BMW 5er dīlera dati)", () => {
  it("85 886 -> 96 533 -> 90 205 ... 96 649: kļūda ir 96 533, nākamie nav sarkani", () => {
    const rows = [
      row("13.11.2018", 74_155),
      row("04.11.2019", 85_886),
      row("20.11.2019", 96_533),
      row("30.01.2020", 90_205),
      row("20.05.2020", 92_737),
      row("09.06.2020", 94_269),
      row("30.07.2020", 96_649),
      row("10.09.2020", 98_494),
    ];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect(a.chartExcludeSourceOrders.has(rows[2]!.sourceOrder)).toBe(true);
    expect(redRows(rows)).toEqual(["20.11.2019:96533"]);
    expect(classes(rows)).toEqual(["typo_outlier:20.11.2019:96533"]);
  });

  it("singleDigitTypoFitsBetween", () => {
    expect(singleDigitTypoFitsBetween(96_533, 85_886, 90_205)).toBe(true);
    expect(singleDigitTypoFitsBetween(97_000, 93_100, 93_900)).toBe(false);
  });

  it("īsta korekcija paliek: kāpums, tad visi turpmākie zem tā (līmenis gada laikā netiek sasniegts)", () => {
    const rows = [
      row("01.01.2019", 85_000),
      row("01.02.2019", 96_000),
      row("01.06.2019", 90_000),
      row("01.06.2020", 94_000),
      row("01.06.2021", 99_000),
    ];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect(a.typoSpikeSourceOrders?.size ?? 0).toBe(0);
    expect(a.chartExcludeSourceOrders.has(rows[1]!.sourceOrder)).toBe(false);
    expect(redRows(rows)).toEqual(["01.06.2019:90000"]);
  });

  it("īsta korekcija paliek: kritums zem iepriekšējā (next < prev) nav izlēcējs", () => {
    const rows = [row("01.01.2019", 85_000), row("01.03.2019", 96_000), row("01.04.2019", 80_000), row("01.05.2019", 97_000)];
    expect(analyzeUnifiedMileageAnomalies(rows).typoSpikeSourceOrders?.size ?? 0).toBe(0);
  });

  it("lēns kāpums (normāls temps) nav izlēcējs pat ar viena cipara atbilstību", () => {
    const rows = [row("01.01.2019", 85_000), row("01.01.2020", 96_000), row("01.03.2020", 90_500), row("01.06.2020", 97_000)];
    expect(analyzeUnifiedMileageAnomalies(rows).typoSpikeSourceOrders?.size ?? 0).toBe(0);
  });
});

describe("AI faktu lapa: sludinājums nav ievades kļūda", () => {
  it("AutoDNA sludinājuma rādījums zem fiksētā - atsevišķa sludinājuma rinda", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna = {
      ...blocks.autodna,
      serviceHistory: [
        { date: "18.08.2015", odometer: "103880", country: "Vācija" },
        { date: "27.09.2015", odometer: "90000", country: "Vācija" },
        { date: "12.10.2015", odometer: "107993", country: "Vācija" },
      ],
      vehicleHistoryTimeline: [
        { date: "27.09.2015", country: "Vācija", description: "Pārdošanai piedāvātas automašīnas (30800 EUR)", odometer: "90000" },
      ],
    } as typeof blocks.autodna;
    const facts = buildCanonicalFacts({ sourceBlocks: blocks });
    expect(facts.suspectedEntryErrors).toEqual([]);
    expect(facts.listingBelowRecorded?.map((e) => `${e.date} ${e.km}`)).toEqual(["27.09.2015 90000"]);
    expect(facts.sheet).toContain(LISTING_BELOW_RECORDED_LINE_PREFIX);
    expect(facts.rollbacks).toEqual([]);
  });
});

describe("viena avota divi rādījumi vienā dienā ar starpību > 1000 km", () => {
  it("16.03.2018 90 044 un 99 044: kļūda ir 99 044 (neiekļaujas līknē), nekas nav sarkans", () => {
    const rows = [
      row("10.03.2017", 76_120),
      row("16.03.2018", 90_044),
      row("16.03.2018", 99_044),
      row("20.09.2018", 96_310),
      row("02.04.2019", 103_870),
    ];
    const a = analyzeUnifiedMileageAnomalies(rows);
    const bad = rows[2]!.sourceOrder;
    expect([...a.dataEntryErrorSourceOrders]).toEqual([bad]);
    expect(a.chartExcludeSourceOrders.has(bad)).toBe(true);
    expect(a.chartExcludeSourceOrders.has(rows[1]!.sourceOrder)).toBe(false);
    expect(redRows(rows)).toEqual([]);
    expect(classes(rows)).toEqual(["typo_outlier:16.03.2018:99044"]);
  });

  it("zemākais vienas dienas rādījums ir kļūda, ja tas neiekļaujas līknē", () => {
    const rows = [
      row("10.03.2017", 92_000),
      row("16.03.2018", 90_044),
      row("16.03.2018", 99_044),
      row("20.09.2018", 104_310),
    ];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect([...a.dataEntryErrorSourceOrders]).toEqual([rows[1]!.sourceOrder]);
    expect(redRows(rows)).toEqual([]);
    expect(classes(rows)).toEqual(["typo_outlier:16.03.2018:90044"]);
  });

  it("ja abi iekļaujas līknē - nemarķē", () => {
    const rows = [
      row("10.03.2017", 80_000),
      row("16.03.2018", 90_044),
      row("16.03.2018", 99_044),
      row("20.09.2018", 120_000),
    ];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect(a.dataEntryErrorSourceOrders.size).toBe(0);
    expect(classes(rows)).toEqual([]);
  });

  it("dažādi avoti tajā pašā dienā - šis noteikums neattiecas", () => {
    const rows = [
      row("10.03.2017", 76_120),
      row("16.03.2018", 90_044),
      row("16.03.2018", 99_044, "AutoDNA"),
      row("20.09.2018", 96_310),
      row("02.04.2019", 103_870),
    ];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect(a.dataEntryErrorSourceOrders.has(rows[2]!.sourceOrder)).toBe(false);
  });

  it("īsta manipulācija paliek sarkana: tajā pašā dienā 150 000 un 90 000, turpmāk no 90 000", () => {
    const rows = [
      row("10.03.2017", 140_000),
      row("16.03.2018", 150_000),
      row("16.03.2018", 90_000),
      row("20.09.2018", 95_000),
      row("02.04.2019", 101_000),
    ];
    // Pāra noteikums nemarķē nevienu (neviens neiekļaujas līknē); kritums paliek sarkans.
    expect(findSameDaySourceEntryErrors(pts(rows)).size).toBe(0);
    expect(redRows(rows).length).toBeGreaterThan(0);
    expect(classes(rows).some((c) => c.startsWith("rollback:"))).toBe(true);
  });

  it("pēdējais pāris bez nākamā kaimiņa: marķē tikai, ja atšķiras vienā ciparā", () => {
    const typo = [row("10.03.2017", 76_120), row("16.03.2018", 90_044), row("16.03.2018", 60_044)];
    expect([...findSameDaySourceEntryErrors(pts(typo))]).toEqual([typo[2]!.sourceOrder]);
    const notTypo = [row("10.03.2017", 76_120), row("16.03.2018", 90_000), row("16.03.2018", 51_300)];
    expect(findSameDaySourceEntryErrors(pts(notTypo)).size).toBe(0);
  });
});

describe("sērijas pēdējais vienas dienas pāris (drošības princips: šaubās kritumu rāda)", () => {
  it("90 000 / 51 300 pēdējie -> 51 300 ir sarkans kritums, nevis ievades kļūda", () => {
    const rows = [row("10.03.2017", 76_120), row("16.03.2018", 90_000), row("16.03.2018", 51_300)];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect(a.dataEntryErrorSourceOrders.size).toBe(0);
    expect(redRows(rows)).toEqual(["16.03.2018:51300"]);
    expect(classes(rows)).toEqual(["rollback:16.03.2018:51300"]);
  });

  it("90 044 / 99 044 pēdējie (iepriekšējais 95 000) -> 90 044 ir ievades kļūda, nekas nav sarkans", () => {
    const rows = [row("10.03.2017", 95_000), row("16.03.2018", 90_044), row("16.03.2018", 99_044)];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect([...a.dataEntryErrorSourceOrders]).toEqual([rows[1]!.sourceOrder]);
    expect(a.chartExcludeSourceOrders.has(rows[1]!.sourceOrder)).toBe(true);
    expect(redRows(rows)).toEqual([]);
    expect(classes(rows)).toEqual(["typo_outlier:16.03.2018:90044"]);
  });

  it("pāris ar nākamo rādījumu - izolēta krituma loģika kā līdz šim", () => {
    const rows = [
      row("10.03.2017", 76_120),
      row("16.03.2018", 90_000),
      row("16.03.2018", 51_300),
      row("20.04.2018", 91_000),
    ];
    expect(analyzeUnifiedMileageAnomalies(rows).dataEntryErrorSourceOrders.has(rows[2]!.sourceOrder)).toBe(true);
  });
});

describe("differsBySingleDigit", () => {
  it("90 044 / 99 044 - viens cipars; 90 000 / 51 300 - nē", () => {
    expect(differsBySingleDigit(90_044, 99_044)).toBe(true);
    expect(differsBySingleDigit(90_000, 51_300)).toBe(false);
    expect(differsBySingleDigit(9_044, 90_044)).toBe(false);
  });
});
