/**
 * Audits 22.11.2026 (zurnals/dilera-atskaite-audits-2026-11-22.md): dīlera datu atskaites pareizība.
 * Fiksācijas no audita VIN piemēriem (bez personas datiem).
 */
import { describe, expect, it } from "vitest";
import { extractDealerFactsFromServiceWorks, isDealerCampaignText } from "@/lib/admin-ai-dealer-facts";
import {
  mergeAutoRecordsServiceWorkRow,
  mergeAutoRecordsServiceWorksByOdometer,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { looksLikeNonWorkshopServiceProvider } from "@/lib/dealer-code-facts-prompt";
import { dropDealerRecommendationSentences } from "@/lib/dealer-comments-review-core";
import {
  hasAnyMajorAssemblyRepair,
  isGearboxOilChangeWork,
  isMajorAssemblyRepairWork,
  isRoutineMaintenanceWork,
} from "@/lib/dealer-major-works";
import { findDealerOdometerDrops, findDealerOdometerOutliers } from "@/lib/dealer-odometer-checks";
import { oilRatioTone, oilIntervalKmTolerance } from "@/lib/oem-oil-interval";
import {
  buildOilChangeIntervalPdfHtml,
  buildOilChangeIntervalSeries,
  isEngineOilChangeWork,
} from "@/lib/oil-change-intervals";
import { buildDealerServiceVisitsHtml, formatDealerServicePlace } from "@/lib/pdf-dealer-service-visits";
import {
  buildDealerMajorWorksHtml,
  buildDealerVisitSummary,
  buildDealerVisitSummaryHtml,
  classifyDealerVisitKind,
} from "@/lib/pdf-dealer-timeline";
import { serviceWorkTermLv } from "@/lib/service-work-term-lv";
import { formatServiceWorksLines } from "@/lib/service-works-lines";
import { DEALER_FACTS_ONLY_DIRECTIVE, DEALER_COMMENTS_NO_TABLE_REPEAT_DIRECTIVE } from "@/lib/admin-ai-source-comment";

const r = (date: string, odometer: string, works: string, location = ""): AutoRecordsServiceWorkRow => ({
  date,
  odometer,
  location,
  works,
});
const NOW = Date.UTC(2026, 10, 22);

describe("1. vizīšu sapludināšana pēc km tikai, ja datumi tuvu", () => {
  it("WBAUY11040F054037: 8 514 km 23.05.2013 (spogulis) un 01.10.2015 (apkope) ir divas vizītes", () => {
    const rows = mergeAutoRecordsServiceWorksByOdometer([
      r("01.10.2015", "8514", "Apkope", "MINI AUTOMAG Trudering"),
      r("23.05.2013", "8514", "Kreisais apsildāmais platleņķa spoguļa stikls (51167252893)", "BMW Automag GmbH"),
    ]);
    expect(rows.map((x) => x.date)).toEqual(["01.10.2015", "23.05.2013"]);
    expect(rows[1]!.works).toMatch(/spoguļa stikls/);
    expect(rows[0]!.works).not.toMatch(/spoguļa/);
  });

  it("WBAMZ71040DM71041: 140 740 km 09.11.2022 un 11.11.2025 - 4 vizītes, darbi pie saviem datumiem (ingest ceļš)", () => {
    let rows: AutoRecordsServiceWorkRow[] = [];
    for (const row of [
      r("11.11.2025", "140740", "Apsildes elements (11617550466)", "Autohaus Hoyer GmbH"),
      r("09.11.2022", "140740", "Aizdedzes spole (12137559842)\nPneimobalons (aizmugurē) (37106784379)", "Autohaus Hoyer GmbH"),
      r("29.07.2018", "109818", "Apkope"),
      r("21.07.2014", "37274", "Gumijas ventilis (FT100 TR 41)", "Auto Center Weiterstadt GmbH"),
    ]) {
      rows = mergeAutoRecordsServiceWorkRow(rows, row);
    }
    expect(rows).toHaveLength(4);
    const nov2025 = rows.find((x) => x.date === "11.11.2025")!;
    const nov2022 = rows.find((x) => x.date === "09.11.2022")!;
    expect(nov2025.works).not.toMatch(/Aizdedzes spole|Pneimobalons/);
    expect(nov2022.works).toMatch(/Aizdedzes spole/);
  });

  it("W0LJ7BJBSBV658020: 329 671 km 10.07.2019 (eļļa) un 20.08.2019 (galvas balsts) paliek atsevišķi", () => {
    const rows = mergeAutoRecordsServiceWorksByOdometer([
      r("20.08.2019", "329671", "Galvas balsta vadotne"),
      r("10.07.2019", "329671", "Dzinēja eļļas un filtra maiņa"),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((x) => x.date === "10.07.2019")!.works).toMatch(/eļļas/);
  });

  it("tā pati vizīte (vienāds km, 4 dienas, tas pats serviss) joprojām ir viena rinda", () => {
    const rows = mergeAutoRecordsServiceWorksByOdometer([
      r("05.02.2025", "199228", "Sveces", "Zenter Autohaus"),
      r("01.02.2025", "199228", "Eļļas maiņa", "Zenter Autohaus"),
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe("2. garākais robs un «Kopš pēdējā ieraksta»", () => {
  it("WBAMW91010DV11581: 179 979 km starp ~318 000 km ierakstiem nav robs 138 221 km", () => {
    const rows = [
      r("16.05.2025", "318023", "Vējstiklu mazgāšanas šķidrums"),
      r("20.05.2025", "179979", "Pusass putekļusarga remkomplekts"),
      r("20.05.2025", "318200", "Apkope"),
      r("19.06.2025", "321956", "Apkope"),
    ];
    expect([...findDealerOdometerOutliers(rows)].map((x) => x.odometer)).toEqual(["179979"]);
    const s = buildDealerVisitSummary(rows, null, null, NOW);
    expect(s?.longestGap?.km ?? 0).toBeLessThan(10_000);
  });

  it("WDD2122231A338701: pēdējais ieraksts 12.10.2015 - kopš tā 133 mēn., atsevišķa šūna esošajā režģī", () => {
    const rows = [r("20.01.2015", "141431", "Apkope"), r("12.10.2015", "167866", "Eļļas maiņa")];
    expect(buildDealerVisitSummary(rows, null, null, NOW)?.monthsSinceLast).toBe(133);
    const html = buildDealerVisitSummaryHtml(rows, null, "lv", null, NOW);
    expect(html).toContain("<span>Kopš pēdējā ieraksta</span><b>133 mēn.</b>");
    expect(html.match(/pdf-svc-summary__cell/g)?.length).toBeGreaterThanOrEqual(8);
  });
});

describe("3. eļļas intervāli: pielaide un segums līdz šodienai", () => {
  it("WDD2122231A338701: 25 005 km pret 25 000 km nav «virs intervāla» (±3 % / 750 km)", () => {
    expect(oilIntervalKmTolerance(25_000)).toBe(750);
    expect(oilRatioTone(25_005, 25_000, oilIntervalKmTolerance(25_000))).toBe("ok");
    expect(oilRatioTone(26_000, 25_000, oilIntervalKmTolerance(25_000))).toBe("stretch");
    const series = buildOilChangeIntervalSeries(
      [r("01.01.2014", "100000", "Eļļas maiņa"), r("01.11.2014", "125005", "Eļļas maiņa")],
      { km: 25_000, kmMin: null, months: 12 },
    );
    expect(series.points[1]!.tone).toBe("ok");
  });

  it("WBAWY51000L877520: veci ieraksti - nav «100 %», posms pēc pēdējās maiņas ir «nav dīlera datu» (pēc laika)", () => {
    const series = buildOilChangeIntervalSeries(
      [r("29.08.2013", "26052", "Eļļas filtra komplekts"), r("14.08.2012", "9534", "Motoreļļa")],
      { km: 30_000, kmMin: null, months: 24 },
      { nowMs: NOW },
    );
    expect(series.coverage?.basis).toBe("time");
    const html = buildOilChangeIntervalPdfHtml(series);
    expect(html).not.toMatch(/apliecina 100%/);
    expect(html).toContain("Dīlera eļļas maiņu ieraksti aptver 9 534-26 052 km · 14.08.2012-29.08.2013");
    expect(html).toMatch(/Dīlera datos eļļas maiņas ierakstu nav pēc 29\.08\.2013 \(159 mēn\.\)/);
    const nav = html.match(/<b>(\d+)%<\/b> nav dīlera datu/);
    expect(Number(nav?.[1])).toBeGreaterThan(80);
  });

  it("ar aktuālu nobraukumu no cita avota segumu rēķina pēc km", () => {
    const series = buildOilChangeIntervalSeries(
      [r("01.01.2020", "50000", "Eļļas maiņa"), r("01.01.2021", "70000", "Eļļas maiņa")],
      { km: 30_000, kmMin: null, months: 24 },
      { nowMs: NOW, current: { km: 110_000, dateMs: NOW - 10 * 86_400_000 } },
    );
    expect(series.coverage).toMatchObject({ basis: "km", tail: 40_000, total: 60_000 });
    expect(buildOilChangeIntervalPdfHtml(series)).toContain("Procenti rēķināti pēc nobraukuma līdz 110 000 km.");
  });
});

describe("4. vizītes veids - noklusējums NAV remonts", () => {
  it("SJNFFAJ11U2507806 / WBA5K11000D942446 / WBAWY51000L877520", () => {
    expect(classifyDealerVisitKind("Nissan Customer Maintenance Plan.")).toBe("maintenance");
    expect(classifyDealerVisitKind("Plānotā apkope (ražotāja apkopes plāns)")).toBe("maintenance");
    expect(classifyDealerVisitKind("Apkope")).toBe("record");
    expect(classifyDealerVisitKind("Detalizēts darbu saraksts atskaitē nav pieejams.")).toBe("record");
    expect(classifyDealerVisitKind("Sērijas atslēgu piekariņš (80272287778)")).toBe("accessories");
    expect(classifyDealerVisitKind("Bagāžnieka vāka emblēma (51147057794)")).toBe("accessories");
    expect(classifyDealerVisitKind("Radwechsel inkl. Einlagerung Räder / Reifen (Saison).")).toBe("accessories");
    expect(classifyDealerVisitKind("Beide Bremsscheiben hinten ersetzen.")).toBe("repair");
    expect(classifyDealerVisitKind("Sadales ķēdes komplekta maiņa")).toBe("repair");
  });
});

describe("5. eļļas maiņu skaitīšana - nesašaurināt, izslēgt tikai nepārprotamas ne-maiņas", () => {
  it("W0LJ7BJBSBV658020 13.10.2021 «Ölfiltergehäuse ersetzen» paliek skaitā (dīleris to dara ar eļļas maiņu)", () => {
    expect(isEngineOilChangeWork("Ölfiltergehäuse  ersetzen.")).toBe(true);
    expect(isEngineOilChangeWork("Eļļas filtra korpusa maiņa")).toBe(true);
  });
  it("līmeņa pārbaude, noplūdes diagnostika un spiediena devējs nav maiņa", () => {
    expect(isEngineOilChangeWork("Eļļas līmeņa pārbaude")).toBe(false);
    expect(isEngineOilChangeWork("Motorölstand prüfen")).toBe(false);
    expect(isEngineOilChangeWork("Motoröl Leckage / Ölverlust diagnostiziert")).toBe(false);
    expect(isEngineOilChangeWork("Öldruckschalter ersetzen")).toBe(false);
    expect(isEngineOilChangeWork("Motoröl und Ölfilter wechseln.")).toBe(true);
    expect(isEngineOilChangeWork("Ölwechsel, Ölstand geprüft")).toBe(true);
  });
  it("vienāds km divos datumos ir viena eļļas maiņa (WBAUY11040F054037 18.11. un 27.11.2015, 36 707 km)", () => {
    const series = buildOilChangeIntervalSeries([
      r("18.11.2015", "36707", "BMW Engine Oil LL04 5W30"),
      r("27.11.2015", "36707", "BMW motoreļļa LL04 5W30"),
    ]);
    expect(series.changeCount).toBe(1);
  });
});

describe("6. lielie mezgli", () => {
  it("W0LJ7BJBSBV658020 31.01.2020: tilta bukse nav «Diferenciālis / reduktors»", () => {
    expect(isMajorAssemblyRepairWork("Hinterachsbuchse rechts ersetzen.", "differential")).toBe(false);
    expect(isMajorAssemblyRepairWork("Aizmugurējā tilta bukses maiņa labajā pusē.", "differential")).toBe(false);
    expect(isMajorAssemblyRepairWork("Differential ersetzt", "differential")).toBe(true);
  });

  it("zobsiksna 13.04.2015 un 09.10.2018: rāda pēdējo reizi un skaitu", () => {
    const rows = [
      r("13.04.2015", "152676", "Zahnriemen ersetzen."),
      r("09.10.2018", "316938", "Zahnriemen ersetzen."),
    ];
    const facts = extractDealerFactsFromServiceWorks(rows);
    const hit = buildDealerVisitSummary(rows, facts)!.majorWorks.find((w) => w.id === "timing_belt")!;
    expect(hit.date).toBe("09.10.2018");
    expect(hit.count).toBe(2);
    expect(buildDealerMajorWorksHtml(facts)).toContain("09.10.2018 · 316 938 km · 2×");
  });

  it("jaunie mezgli DE/EN/DA/NL/LV", () => {
    const yes: [string, Parameters<typeof isMajorAssemblyRepairWork>[1]][] = [
      ["Exhaust gas radiator high temperature (11717822350).", "egr"],
      ["exhaust cooler (11718476993).", "egr"],
      ["AGR-Ventil ersetzt", "egr"],
      ["EGR-klep vervangen", "egr"],
      ["Dieselpartikelfilter ersetzt", "dpf"],
      ["Kvēpu filtra maiņa", "dpf"],
      ["AdBlue-Pumpe ersetzt", "adblue"],
      ["NOx-Sensor ersetzt", "adblue"],
      ["Wasserpumpe ersetzen", "water_pump"],
      ["Vandpumpe udskiftet", "water_pump"],
      ["Pneumatic spring, rear (37106784379).", "air_suspension"],
      ["Luchtveer achter vervangen", "air_suspension"],
      ["Kompressor Klimaanlage ersetzen.", "ac_compressor"],
      ["Austausch Klimaanlagenkompressor.", "ac_compressor"],
      ["Kupplungssatz ersetzt", "clutch"],
      ["Zweimassenschwungrad ersetzt", "dual_mass_flywheel"],
      ["Steuerkette ersetzt", "timing_chain"],
      ["1K Multi-Grundierfüller dunkelgrau 400ML TU-Nr.", "body_glass"],
      ["Panel, bumper, primed, front (51117285961).", "body_glass"],
      ["Stoßfänger lackiert", "body_glass"],
    ];
    for (const [works, id] of yes) expect(isMajorAssemblyRepairWork(works, id), `${id}: ${works}`).toBe(true);
    const no: [string, Parameters<typeof isMajorAssemblyRepairWork>[1]][] = [
      ["Austausch Schlauch Klimaanlagenkompressor.", "ac_compressor"],
      ["AdBlue nachfüllen", "adblue"],
      ["Kupplungsgeberzylinder ersetzen.", "clutch"],
      ["Particulate filter.", "dpf"],
      ["Lackpflege", "body_glass"],
      ["Durvju iekšējais rokturis\nKreisais (51417261929)", "body_glass"],
    ];
    for (const [works, id] of no) expect(isMajorAssemblyRepairWork(works, id), `${id}: ${works}`).toBe(false);
    expect(isGearboxOilChangeWork("Getriebeölwechsel")).toBe(true);
    expect(isGearboxOilChangeWork("Automātiskās kārbas eļļas maiņa")).toBe(true);
    expect(isGearboxOilChangeWork("Getriebeölstand prüfen")).toBe(false);
  });
});

describe("7. odometra nesakritības - neitrāli, sarkans tikai būtiskam kritumam", () => {
  it("SJNFFAJ11U2507806 52 235 -> 51 000 km un WBA5K11000D942446 96 533 -> 90 205 km = iespējama ievades kļūda", () => {
    const nissan = findDealerOdometerDrops([
      r("08.11.2023", "52235", "Palīdzība uz ceļa (evakuācija)"),
      r("24.11.2023", "51100", "Palīdzība uz ceļa (evakuācija)"),
      r("03.07.2024", "63310", "Plānotā apkope"),
    ]);
    expect(nissan.map((d) => d.severity)).toEqual(["input_error"]);
    const bmw = findDealerOdometerDrops([
      r("12.11.2018", "74155", "Apkope"),
      r("20.11.2019", "96533", "Bremžu šķidrums"),
      r("30.01.2020", "90205", "Apkope"),
      r("20.05.2020", "92737", "Bremzes"),
    ]);
    expect(bmw.map((d) => d.severity)).toEqual(["input_error"]);
  });

  it("būtisks kritums, kas neatgūstas, ir sarkanā; mazs - neitrāla piezīme", () => {
    const html = buildDealerServiceVisitsHtml(
      [
        r("01.01.2018", "100000", "Eļļas maiņa"),
        r("01.01.2019", "60000", "Eļļas maiņa"),
        r("01.01.2020", "70000", "Eļļas maiņa"),
      ],
      { omitSpan: true },
    );
    expect(html).toContain("pdf-svc-km--nodata");
    expect(html).toContain("Nobraukums mazāks nekā iepriekšējā ierakstā (100 000 km, 01.01.2018)");
    const minor = buildDealerServiceVisitsHtml(
      [r("08.11.2023", "52235", "Apkope"), r("24.11.2023", "51100", "Apkope"), r("03.07.2024", "63310", "Apkope")],
      { omitSpan: true },
    );
    expect(minor).not.toContain("nodata");
    expect(minor).toContain("Iespējama nobraukuma ievades kļūda: iepriekšējā ierakstā 52 235 km, 08.11.2023");
  });
});

describe("8. tulkojumi un rindu dalīšana", () => {
  it("terminu vārdnīca", () => {
    expect(serviceWorkTermLv("Sommerreifenrückrüstung mit Winter-.")).toBe(
      "Vasaras riepu uzlikšana (maiņa uz vasaras riepām)",
    );
    expect(serviceWorkTermLv("Winterreifenrüstung")).toBe("Ziemas riepu uzlikšana (maiņa uz ziemas riepām)");
    expect(serviceWorkTermLv("GEPRUEFT PRAEVENTIVMASSNAHME AM FAHRZEUG.")).toBe(
      "Profilaktisks pasākums (ražotāja kampaņa)",
    );
    expect(serviceWorkTermLv("Pneumatic spring, rear")).toBe("Pneimobalons (aizmugurē)");
    expect(serviceWorkTermLv("Roadside Recovery.")).toBe("Palīdzība uz ceļa (evakuācija)");
  });

  it("W0VZCYHZ9KS019224: Präventivmaßnahme skaitās kampaņa", () => {
    expect(isDealerCampaignText("EINGRIFF VORSORGEMASSNAHME MIT FERNLADEN.")).toBe(true);
    expect(isDealerCampaignText("Pārbaudīti un veikti transportlīdzekļa profilaktiskie pasākumi")).toBe(true);
    expect(classifyDealerVisitKind("Profilaktisks pasākums (ražotāja kampaņa)")).toBe("campaign");
  });

  it("rindu nedala pie komata iekavās un pie precizējuma (WBAWY51000L877520, W0LJ7BJBSBV658020)", () => {
    expect(formatServiceWorksLines("Bremžu šķidrums DOT4, zemas viskozitātes (83130143435)").split("\n")).toHaveLength(1);
    expect(
      formatServiceWorksLines("Riepu montāža ar riteņu maiņu un balansēšanu (4 gab., no 18 collām / komerctransportam).").split("\n"),
    ).toEqual(["Riepu montāža ar riteņu maiņu un balansēšanu (4 gab., no 18 collām / komerctransportam)"]);
    expect(
      formatServiceWorksLines("Salona filtra korpusa tīrīšanas līdzeklis (83192180509), priekšējā reste, kreisā (51117237421)").split("\n"),
    ).toEqual(["Salona filtra korpusa tīrīšanas līdzeklis (83192180509)", "Priekšējā reste, kreisā (51117237421)"]);
    expect(formatServiceWorksLines("Regulārā apkope: eļļas maiņa, salona gaisa filtrs").split("\n")).toHaveLength(3);
  });
});

describe("9. servisa vieta un AI noteikumi", () => {
  it("masāžas prakse / ķegļu klubs nav autoserviss; dīleris ar uzvārdu un KFZ darbnīca ir", () => {
    expect(
      looksLikeNonWorkshopServiceProvider(
        "Ammann Therapie Spezialpraxis für Bindegewebsmassage Massagepraxis, Max-Josef-Metzger-Straße 15, 86157 Augsburg, Germany",
      ),
    ).toBe(true);
    expect(looksLikeNonWorkshopServiceProvider("1.SKK Gut Holz Zeil e.V.")).toBe(true);
    expect(looksLikeNonWorkshopServiceProvider("Albert Bauer GmbH, Schleswiger Straße 65, 24941 Flensburg, Germany")).toBe(false);
    expect(looksLikeNonWorkshopServiceProvider("Weigand Thomas KFZ Werkstatt")).toBe(false);
  });

  it("tukšu / «Nezināmā» vietu nerāda", () => {
    expect(formatDealerServicePlace("Nezināmā")).toEqual({ place: "", country: "" });
    const html = buildDealerServiceVisitsHtml([r("01.02.2020", "12000", "Apkope", "Nezināmā")], {
      omitSpan: true,
      countryEvidence: [{ date: "01.02.2020", country: "Nezināmā" }],
    });
    expect(html).not.toMatch(/Nezināmā/);
    expect(html).not.toContain("pdf-svc-place");
  });

  it("prompts: tikai fakti, pozīcija nav darbība, nekādu ieteikumu", () => {
    expect(DEALER_FACTS_ONLY_DIRECTIVE).toMatch(/NEKĀDU IETEIKUMU/);
    expect(DEALER_FACTS_ONLY_DIRECTIVE).toMatch(/kvēpu filtrs \(darbība nav norādīta\)/);
    expect(DEALER_FACTS_ONLY_DIRECTIVE).toMatch(/nav autoserviss/);
    expect(DEALER_COMMENTS_NO_TABLE_REPEAT_DIRECTIVE).not.toMatch(/1-2 teikumi, ko pārbaudīt|pēc tam jāprasa dokumenti/);
    expect(DEALER_FACTS_ONLY_DIRECTIVE).not.toMatch(/—|–/);
  });

  it("deterministisks tīkls izmet ieteikumu teikumus, faktus un eļļas pirmo rindu atstāj", () => {
    const text =
      "Ražotāja intervāls: 30 000 km / 24 mēn. (N57)\n\nLielie mezgli\nEGR dzesētājs mainīts 09.06.2020 (94 269 km). Ieteicams pārbaudīt dzesēšanas šķidruma līmeni. Pārdevējam jālūdz rēķini.";
    const out = dropDealerRecommendationSentences(text);
    expect(out).toContain("Ražotāja intervāls: 30 000 km / 24 mēn.");
    expect(out).toContain("EGR dzesētājs mainīts 09.06.2020");
    expect(out).not.toMatch(/Ieteicams|jālūdz/);
  });
});

describe("6b. kārbas eļļas maiņa = Lielie darbi (Nila lēmums 22.11.2026), bet joprojām apkope", () => {
  // WDD2122231A338701 RAW (OneAuto), vizītes ap 14.03.2014.
  const mbRows = [
    r("06.08.2013", "103058", "Service B.\nEngine: oil and filter change."),
    r("14.03.2014", "127829", "Service A.\nEngine: oil and filter change.\nAutomatic transmission: oil and filter change."),
    r(
      "10.10.2014",
      "150538",
      "Service B.\nEngine: oil and filter change.\nAir filter element replaced.\nBreakpads front axle replaced.\nFuel filter replaced.",
    ),
  ];

  it("WDD2122231A338701 14.03.2014: «Ātrumkārbas eļļas maiņa» Lielajos darbos ar datumu un km", () => {
    const facts = extractDealerFactsFromServiceWorks(mbRows);
    const summary = buildDealerVisitSummary(mbRows, facts, null, NOW)!;
    expect(summary.majorWorks.map((w) => [w.id, w.date, w.km, w.count])).toEqual([
      ["gearbox_oil", "14.03.2014", "127 829 km", undefined],
    ]);
    const html = buildDealerMajorWorksHtml(facts);
    expect(html).toContain("<b>Ātrumkārbas eļļas maiņa</b>");
    expect(html).toContain("pdf-svc-major__item--mechanical");
    expect(html).toContain("14.03.2014 · 127 829 km");
    expect(buildDealerVisitSummaryHtml(mbRows, facts, "lv", null, NOW)).toContain("Ātrumkārbas eļļas maiņa");
  });

  it("WDD2122231A338701: vizīte paliek «Apkope», dzinēja eļļas skaits nemainās", () => {
    const works = mbRows[1]!.works;
    expect(classifyDealerVisitKind(works)).toBe("maintenance");
    expect(hasAnyMajorAssemblyRepair(works)).toBe(false);
    expect(isRoutineMaintenanceWork(works)).toBe(true);
    expect(isMajorAssemblyRepairWork(works, "gearbox")).toBe(false);
    expect(isEngineOilChangeWork("Automatic transmission: oil and filter change.")).toBe(false);
    expect(isEngineOilChangeWork("Automātiskā pārnesumkārba: eļļas un filtra maiņa.")).toBe(false);
    expect(buildOilChangeIntervalSeries(mbRows).changeCount).toBe(3);
  });

  it("WDD2042031G061877 23.11.2017 (80 927 km): kola teikums «Automatic transmission: oil and filter change.» tiek atpazīts", () => {
    const works =
      "Engine: oil and filter change.\nAir filter element replaced.\nAutomatic transmission: oil and filter change.\nBrake fluid replaced.";
    expect(isGearboxOilChangeWork(works)).toBe(true);
    expect(isGearboxOilChangeWork("Automātiskā pārnesumkārba: eļļas un filtra maiņa.")).toBe(true);
    expect(isGearboxOilChangeWork("Engine: oil and filter change.")).toBe(false);
  });

  it("vairākas reizes: pēdējā reize + «N×», kā citiem mezgliem", () => {
    const rows = [
      r("14.03.2014", "127829", "Automatic transmission: oil and filter change."),
      r("02.05.2019", "201300", "Getriebeöl und Filter wechseln (ATF)"),
    ];
    const facts = extractDealerFactsFromServiceWorks(rows);
    const hit = buildDealerVisitSummary(rows, facts, null, NOW)!.majorWorks.find((w) => w.id === "gearbox_oil")!;
    expect(hit.date).toBe("02.05.2019");
    expect(hit.count).toBe(2);
    expect(buildDealerMajorWorksHtml(facts)).toContain("02.05.2019 · 201 300 km · 2×");
  });

  it("W0LJ7BJBSBV658020 (manuāla M73, kārbas eļļas maiņas nav): nav viltus kārbas / diferenciāļa eļļas", () => {
    for (const works of ["Ölfiltergehäuse  ersetzen.", "Hinterachsbuchse rechts ersetzen.", "Motoröl und Filter wechseln."]) {
      expect(isMajorAssemblyRepairWork(works, "gearbox_oil"), works).toBe(false);
      expect(isMajorAssemblyRepairWork(works, "differential_oil"), works).toBe(false);
    }
  });

  it("WBAMW91010DV11581 23.04.2018 «Hypoid axle oil G2» (LV «transmisijas eļļa») nav ātrumkārbas eļļa", () => {
    const works =
      "Hypoid axle oil G2 (83222413511).\nHipoīdais transmisijas eļļa G2 (83222413511)\nRepair kit bellows, exterior (31607606091).";
    expect(isGearboxOilChangeWork(works)).toBe(false);
    expect(isMajorAssemblyRepairWork(works, "gearbox_oil")).toBe(false);
    // Detaļu rinda bez maiņas vārda nav arī diferenciāļa eļļas maiņa.
    expect(isMajorAssemblyRepairWork(works, "differential_oil")).toBe(false);
  });

  it("diferenciāļa / sadales kārbas eļļa ir atsevišķi punkti, ne ātrumkārbas eļļa", () => {
    const cases: [string, "gearbox_oil" | "differential_oil" | "transfer_case_oil"][] = [
      ["Hinterachsgetriebeöl wechseln", "differential_oil"],
      ["Ölwechsel Hinterachsgetriebe", "differential_oil"],
      ["Rear axle oil change", "differential_oil"],
      ["Diferenciāļa eļļas maiņa", "differential_oil"],
      ["Verteilergetriebeöl erneuert", "transfer_case_oil"],
      ["Transfer case fluid change", "transfer_case_oil"],
      ["Sadales kārbas eļļas maiņa", "transfer_case_oil"],
    ];
    for (const [works, id] of cases) {
      for (const other of ["gearbox_oil", "differential_oil", "transfer_case_oil"] as const) {
        expect(isMajorAssemblyRepairWork(works, other), `${works} -> ${other}`).toBe(other === id);
      }
      expect(isGearboxOilChangeWork(works), works).toBe(false);
      expect(classifyDealerVisitKind(works), works).toBe("maintenance");
    }
    const rows = [r("01.06.2020", "90000", "Hinterachsgetriebeöl wechseln"), r("01.06.2021", "110000", "Getriebeölwechsel")];
    const ids = buildDealerVisitSummary(rows, extractDealerFactsFromServiceWorks(rows), null, NOW)!.majorWorks.map((w) => w.id);
    expect(ids).toEqual(["gearbox_oil", "differential_oil"]);
  });

  it("DSG / S tronic / ZF / ATF / RU: maiņa jā; uzpilde, līmenis, noplūde nē", () => {
    for (const works of [
      "DSG Öl- und Filterwechsel",
      "S tronic Getriebeöl wechseln",
      "ZF Getriebeölservice",
      "ATF flush",
      "Kārbas eļļas maiņa",
      "Автоматическая коробка передач: замена масла и фильтра",
    ]) {
      expect(isMajorAssemblyRepairWork(works, "gearbox_oil"), works).toBe(true);
    }
    for (const works of ["Getriebeöl nachfüllen", "Gearbox oil top-up", "Getriebeölstand prüfen", "Getriebeölverlust diagnostiziert"]) {
      expect(isMajorAssemblyRepairWork(works, "gearbox_oil"), works).toBe(false);
    }
  });

  it("ātrumkārbas nomaiņa ar eļļas uzpildi: tikai «Ātrumkārba», bez atsevišķas eļļas maiņas", () => {
    const works = "Getriebe getauscht\nGetriebeöl erneuert";
    expect(isMajorAssemblyRepairWork(works, "gearbox")).toBe(true);
    expect(isMajorAssemblyRepairWork(works, "gearbox_oil")).toBe(false);
  });
});
