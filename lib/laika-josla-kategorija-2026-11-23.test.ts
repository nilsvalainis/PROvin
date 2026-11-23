/**
 * Nils 23.11.2026: dīlera / AUDITS PDF laika josla „nav precīzi”.
 * Anonimizēts paraugs (Stellantis furgons, OneAuto DE izdruka → LV), bez VIN un personu datiem.
 */
import { describe, expect, it } from "vitest";
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import { emptyAutoRecordsBlock, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { DEALER_SERVICE_WORKS_LV_SYSTEM } from "@/lib/dealer-service-works-lv";
import { formatDealerGapMonths } from "@/lib/dealer-gap-format";
import { isMajorAssemblyRepairWork } from "@/lib/dealer-major-works";
import {
  classifyDealerVisitKind,
  classifyDealerVisitKinds,
  dealerVisitKindLabel,
} from "@/lib/dealer-visit-kind";
import {
  DEALER_WORK_LV_GLOSSARY,
  DEALER_WORK_LV_STYLE_RULES,
  polishDealerWorkLineLv,
  polishDealerWorkLinesLv,
} from "@/lib/dealer-work-lv-polish";
import { isEngineOilChangeWork, oilClaimCautionHtml } from "@/lib/oil-change-intervals";
import { buildVehicleLifecycleEvents, stripEuSuffix } from "@/lib/vehicle-lifecycle-timeline";
import { buildDealerServiceVisitsHtml, formatDealerServicePlace } from "@/lib/pdf-dealer-service-visits";
import {
  buildDealerGapMarkerHtml,
  buildDealerVisitSummaryHtml,
  dealerVisitMajorMarker,
  formatDealerGapValue,
} from "@/lib/pdf-dealer-timeline";

const row = (date: string, odometer: string, works: string, location = "Germany"): AutoRecordsServiceWorkRow => ({
  date,
  odometer,
  location,
  works,
});

/** 24.10.2023 ieraksts no Nila ekrānšāviņa (LV tulkojums, kā saglabāts). */
const SERVICE_2023 = [
  "Salona filtra maiņa (apkope)",
  "Gaisa filtra elementa maiņa.",
  "Degvielas filtra elementa maiņa (apkope)",
  "Dzesēšanas šķidruma pH pārbaude (apkope)",
  "Bremžu sistēmas iztukšošana un uzpilde.",
  "Sistemātiskie apkopes darbi.",
  "Vienas puses aizmugurējo durvju vadu kūļa maiņa transportlīdzeklim.",
].join("\n");

const SERVICE_2025 = [
  "Kvēpu filtra (DPF) aizsērējuma pārbaude (apkope)",
  "Salona filtra maiņa (apkope)",
  "Degvielas filtra elementa maiņa (apkope)",
  "Gaisa filtra elementa maiņa (apkope)",
  "Dzesēšanas šķidruma pH pārbaude (apkope)",
  "Bremžu sistēmas iztukšošana un uzpilde (apkope)",
  "Zobsiksnas maiņa (apkope)",
  "UVV pārbaudes veikšana.",
  "Sistemātiskie apkopes darbi.",
].join("\n");

const GENERATOR_2026 = [
  "Kļūmju meklēšanas diagnostika 4.",
  "Ģeneratora maiņa.",
  "Augšējā dinamiskā spriegotājrullīša maiņa.",
  "Papildu darbi: dzinēja apakšējais aizsargs.",
  "Apakšējā dinamiskā spriegotājrullīša maiņa.",
  "Aizmugurējās labās riteņa rumbas un gultņa maiņa.",
].join("\n");

const STARTER_2025 = [
  "Papildu akumulatora pārbaude transportlīdzeklī.",
  "Papildu akumulatora maiņa transportlīdzeklim.",
  "Diagnostika - 15 kļūmju meklēšana transportlīdzeklī.",
  "Startera maiņa transportlīdzeklim.",
  "Dzinēja pārsega papildu noņemšana un uzstādīšana.",
].join("\n");

const BRAKES_2023 = [
  "2 Priekšējo bremžu disku maiņa transportlīdzeklim.",
  "Aizmugurējo bremžu disku pārbaude abās pusēs transportlīdzeklim.",
  "Nomaiņa: aizmugurējie bremžu diski abās pusēs (transportlīdzeklim)",
  "Divu riepu nomaiņa.",
].join("\n");

describe("1-2. vizītes veids pēc darbu vairākuma (čips + galvene)", () => {
  it("filtri + šķidrumi + kārtējā apkope = APKOPE, nevis „Virsbūve / stikls” / REMONTS", () => {
    expect(classifyDealerVisitKinds(SERVICE_2023)).toEqual({ primary: "maintenance", secondary: null });
    const rows = [row("24.10.2023", "103150", SERVICE_2023)];
    const marks = dealerVisitMajorMarker(extractDealerFactsFromServiceWorks(rows))(rows[0]!);
    expect(marks).toEqual([]);
  });

  it("apkope ar zobsiksnu: čips APKOPE, galvenē tikai zobsiksna (DPF pārbaude nav lielais darbs)", () => {
    expect(classifyDealerVisitKind(SERVICE_2025)).toBe("maintenance");
    const rows = [row("24.07.2025", "178433", SERVICE_2025)];
    const marks = dealerVisitMajorMarker(extractDealerFactsFromServiceWorks(rows))(rows[0]!);
    expect(marks.map((m) => m.id)).toEqual(["timing_belt"]);
  });

  it("mehāniskas maiņas = REMONTS (ģenerators, starteris, bremžu diski), pārbaude / diagnostika nesver", () => {
    expect(classifyDealerVisitKinds(GENERATOR_2026)).toEqual({ primary: "repair", secondary: null });
    expect(classifyDealerVisitKinds(STARTER_2025)).toEqual({ primary: "repair", secondary: null });
    expect(classifyDealerVisitKinds(BRAKES_2023)).toEqual({ primary: "repair", secondary: null });
  });

  it("„(bez remonta)” neizraisa REMONTS", () => {
    expect(classifyDealerVisitKind("Aukstumaģenta izsūknēšana un uzpilde (bez remonta)")).toBe("maintenance");
  });

  it("apkope + būtisks remonts = divi čipi „APKOPE + REMONTS”", () => {
    const works = "Dzinēja eļļas un eļļas filtra maiņa.\nKarbamīda (AdBlue) iesmidzināšanas sprauslas maiņa transportlīdzeklim.";
    expect(classifyDealerVisitKinds(works)).toEqual({ primary: "maintenance", secondary: "repair" });
    const html = buildDealerServiceVisitsHtml([row("25.02.2026", "196540", works)], { omitSpan: true });
    expect(html).toMatch(/pdf-svc-tag--maintenance">Apkope<\/span><span class="pdf-svc-tag-plus">\+<\/span><span class="pdf-svc-tag pdf-svc-tag--repair">Remonts/);
  });

  it("„Ieraksts bez detaļām” tikai bez darbiem; neatpazīti darbi = „Citi darbi”", () => {
    expect(classifyDealerVisitKind("Servisa piezīme")).toBe("record");
    expect(classifyDealerVisitKind("Nav norādīts.")).toBe("record");
    expect(classifyDealerVisitKind("Apkope")).toBe("record");
    expect(classifyDealerVisitKind("Roadside Recovery.")).toBe("other");
    expect(dealerVisitKindLabel("other")).toBe("Citi darbi");
    expect(classifyDealerVisitKind("Apkope.\nLielā apkope.")).toBe("maintenance");
  });
});

describe("lielie darbi: kļūdaini trāpījumi", () => {
  it("durvju vadu kūlis / slēdzene / stikla pacēlājs nav „Virsbūve / stikls”; bampera maiņa ir", () => {
    for (const w of [
      "Vienas puses aizmugurējo durvju vadu kūļa maiņa transportlīdzeklim.",
      "KABELBAUM TUER HI 1 SEITE AUSTAUSCH AM FAHRZEUG.",
      "Durvju slēdzenes maiņa",
      "Fensterheber Tür vorne links erneuert",
    ]) {
      expect(isMajorAssemblyRepairWork(w, "body_glass"), w).toBe(false);
    }
    expect(isMajorAssemblyRepairWork("Priekšējā bampera maiņa transportlīdzeklim.", "body_glass")).toBe(true);
    expect(isMajorAssemblyRepairWork("Durvju krāsošana", "body_glass")).toBe(true);
  });

  it("dzinēja dekoratīvais pārsegs nav virsbūve", () => {
    expect(isMajorAssemblyRepairWork("Dzinēja pārsega papildu noņemšana un uzstādīšana.", "body_glass")).toBe(false);
    expect(isMajorAssemblyRepairWork("MOTORABDECKUNG AUS- U EINGEBAUT ZUSAETZLICH.", "body_glass")).toBe(false);
  });

  it("DPF: tikai maiņa / tīrīšana / reģenerācija; ne pārbaude, ne Eolys piedevas tvertne", () => {
    expect(isMajorAssemblyRepairWork("Kvēpu filtra (DPF) aizsērējuma pārbaude (apkope)", "dpf")).toBe(false);
    expect(isMajorAssemblyRepairWork("A000923 Eolys piedevas bākas (FAP) maiņa transportlīdzeklim.", "dpf")).toBe(false);
    expect(isMajorAssemblyRepairWork('ADDITIVTANK "EOLYS" (FAP) AUSTAUSCH AM FAHRZEUG.', "dpf")).toBe(false);
    expect(isMajorAssemblyRepairWork("Kvēpu filtra maiņa", "dpf")).toBe(true);
    expect(isMajorAssemblyRepairWork("Kvēpu filtra piespiedu reģenerācija", "dpf")).toBe(true);
  });

  it("vienas rindas „pārbaude” nepiekabina nākamās rindas „maiņa” (LV rindas netiek saplūdinātas)", () => {
    const rows = [row("24.07.2025", "178433", SERVICE_2025)];
    const fact = extractDealerFactsFromServiceWorks(rows).rows[0]!;
    expect(fact.worksLvLines).toContain("\n");
  });
});

describe("3. vieta bez dublēšanas", () => {
  it("„Germany” + valsts → tikai „Vācija”", () => {
    expect(formatDealerServicePlace("Germany")).toEqual({ place: "", country: "Vācija" });
    expect(formatDealerServicePlace("Deutschland")).toEqual({ place: "", country: "Vācija" });
    const html = buildDealerServiceVisitsHtml([row("24.10.2023", "103150", SERVICE_2023)], { omitSpan: true });
    expect(html).toContain('<p class="pdf-svc-place">Vācija</p>');
    expect(html).not.toContain("Germany");
  });

  it("pilsēta / dīleris paliek", () => {
    expect(formatDealerServicePlace("Autohaus Muster, München, Germany").place).toBe("Autohaus Muster, München");
  });
});

describe("4. tulkojuma kvalitāte (glosārijs + rindu tīrīšana)", () => {
  it("Nila piemēri", () => {
    expect(polishDealerWorkLineLv("Bremžu sistēmas iztukšošana un uzpilde.")).toBe("Bremžu šķidruma maiņa");
    expect(polishDealerWorkLineLv("Sistemātiskie apkopes darbi.")).toBe("Kārtējā apkope");
    expect(polishDealerWorkLineLv("Vienas puses aizmugurējo durvju vadu kūļa maiņa transportlīdzeklim.")).toBe(
      "Aizmugurējo durvju vadu kūļa maiņa (vienā pusē)",
    );
  });

  it("apkopes vizītē „(apkope)” noņemts, punkti beigās vienādoti (bez punkta)", () => {
    const lines = polishDealerWorkLinesLv(SERVICE_2023.split("\n"), { maintenanceVisit: true });
    expect(lines).toEqual([
      "Salona filtra maiņa",
      "Gaisa filtra maiņa",
      "Degvielas filtra maiņa",
      "Dzesēšanas šķidruma pH pārbaude",
      "Bremžu šķidruma maiņa",
      "Kārtējā apkope",
      "Aizmugurējo durvju vadu kūļa maiņa (vienā pusē)",
    ]);
    for (const l of lines) expect(l).not.toMatch(/\.$|\(apkope\)|transportlīdzek/);
    // Remonta vizītē „(apkope)” paliek kā precizējums.
    expect(polishDealerWorkLineLv("Salona filtra maiņa (apkope)", { maintenanceVisit: false })).toBe(
      "Salona filtra maiņa (apkope)",
    );
  });

  it("OE kodi, operāciju numuri, saīsinājumi, skaits, saskaņa, dublikāti", () => {
    expect(polishDealerWorkLineLv("Diagnostika - 15 kļūmju meklēšana transportlīdzeklī.")).toBe("Kļūmju meklēšana (diagnostika)");
    expect(polishDealerWorkLineLv("Kļūmju meklēšanas diagnostika 4.")).toBe("Kļūmju meklēšana (diagnostika)");
    expect(polishDealerWorkLineLv("147C0910, īscaurules nostiprināšana.")).toBe("Īscaurules nostiprināšana");
    expect(polishDealerWorkLineLv("2 Priekšējo bremžu disku maiņa transportlīdzeklim.")).toBe("Priekšējo bremžu disku maiņa (2 gab.)");
    expect(polishDealerWorkLineLv("Aizmugurējās labās riteņa rumbas un gultņa maiņa.")).toBe("Aizmugurējā labā riteņa rumbas un gultņa maiņa");
    expect(polishDealerWorkLineLv("ECM programmēšana.")).toBe("Dzinēja vadības bloka programmēšana");
    expect(polishDealerWorkLineLv("Diagnostika ar MDI.")).toBe("Diagnostika ar ražotāja testeri");
    expect(polishDealerWorkLineLv("UVV pārbaudes veikšana.")).toBe("Drošības pārbaude (UVV)");
    expect(polishDealerWorkLineLv("Profilaktisks pasākums (ražotāja kampaņa) 1 darbība transportlīdzeklim.")).toBe(
      "Ražotāja kampaņa (profilaktisks darbs)",
    );
    expect(polishDealerWorkLineLv("A000923 Eolys piedevas bākas (FAP) maiņa transportlīdzeklim.")).toBe(
      "Kvēpu filtra piedevas (Eolys) tvertnes maiņa",
    );
    expect(polishDealerWorkLinesLv(BRAKES_2023.split("\n"))).toEqual([
      "Priekšējo bremžu disku maiņa (2 gab.)",
      "Aizmugurējo bremžu disku maiņa (abās pusēs)",
      "Divu riepu maiņa",
    ]);
    expect(polishDealerWorkLinesLv(STARTER_2025.split("\n"))).not.toContain("Papildu akumulatora pārbaude");
    expect(polishDealerWorkLinesLv(["Würth aprīkojuma iebūvēšana.", "Würth aprīkojuma uzstādīšana."])).toEqual([
      "Würth aprīkojuma uzstādīšana",
    ]);
    // Saīsinājums beigās paliek ar punktu.
    expect(polishDealerWorkLineLv("Bremžu kluči, diski u.c.")).toBe("Bremžu kluči, diski u.c.");
  });

  it("AI tulkošanas prompts saņem stila noteikumus un glosāriju", () => {
    expect(DEALER_SERVICE_WORKS_LV_SYSTEM).toContain(DEALER_WORK_LV_STYLE_RULES);
    expect(DEALER_WORK_LV_STYLE_RULES).toMatch(/transportlīdzeklim/);
    expect(DEALER_WORK_LV_STYLE_RULES).toContain("„SYSTEMATISCHE WARTUNGSARBEITEN” = „Kārtējā apkope”");
    expect(DEALER_WORK_LV_STYLE_RULES).not.toMatch(/—|–/);
    for (const g of DEALER_WORK_LV_GLOSSARY) {
      expect(g.lv).not.toMatch(/transportlīdzek|\.$/);
      expect(polishDealerWorkLineLv(g.lv)).toBe(g.lv);
    }
  });
});

describe("„Periods bez ierakstiem” (ne „robs”), pilni vārdi", () => {
  it("skaitļa saskaņa", () => {
    expect(formatDealerGapMonths(1)).toBe("1 mēnesis");
    expect(formatDealerGapMonths(2)).toBe("2 mēneši");
    expect(formatDealerGapMonths(15)).toBe("15 mēneši");
    expect(formatDealerGapMonths(21)).toBe("21 mēnesis");
    expect(formatDealerGapMonths(27)).toBe("2 gadi 3 mēneši");
    expect(formatDealerGapMonths(36)).toBe("3 gadi");
    expect(formatDealerGapMonths(15, "en")).toBe("15 months");
    expect(formatDealerGapMonths(22, "ru")).toBe("22 месяца");
    expect(formatDealerGapMonths(15, "ru")).toBe("15 месяцев");
    expect(formatDealerGapMonths(25, "de")).toBe("2 Jahre 1 Monat");
  });

  it("laika joslas marķieris un kopsavilkums 4 valodās", () => {
    const gap = { months: 15, km: 51933 };
    expect(formatDealerGapValue(gap)).toBe("15 mēneši, 51 933 km");
    const lv = buildDealerGapMarkerHtml(gap);
    expect(lv).toContain("Periods bez ierakstiem:");
    expect(lv).toContain("15 mēneši, 51 933 km");
    expect(buildDealerGapMarkerHtml(gap, "en")).toContain("Period without records:");
    expect(buildDealerGapMarkerHtml(gap, "ru")).toContain("Период без записей:");
    expect(buildDealerGapMarkerHtml(gap, "de")).toContain("Zeitraum ohne Einträge:");
    for (const lang of ["lv", "en", "ru", "de"] as const) {
      expect(buildDealerGapMarkerHtml(gap, lang).replace(/<[^>]+>/g, "")).not.toMatch(/robs|gap|Lücke|пробел|mēn\./i);
    }
    const summary = buildDealerVisitSummaryHtml(
      [row("01.01.2020", "40000", "Eļļas maiņa"), row("01.04.2021", "91933", "Eļļas maiņa")],
      null,
      "lv",
    );
    expect(summary).toContain("Garākais periods bez ierakstiem");
    expect(summary).toContain("15 mēneši, 51 933 km");
  });
});

describe("hronoloģija = dīlera sadaļa (Business PDF audits 23.11)", () => {
  const block = (rows: AutoRecordsServiceWorkRow[]) => ({ ...emptyAutoRecordsBlock(), serviceWorks: rows });

  it("vizītes virsraksts ir tas pats veids kā dīlera čipam, avots „Dīlera dati”", () => {
    const events = buildVehicleLifecycleEvents({
      autoRecordsBlock: block([
        row("24.10.2023", "103150", SERVICE_2023),
        row("30.06.2022", "49124", "Aizmugurējā kreisā luktura nomaiņa."),
        row("25.07.2022", "49124", "Profilaktisks pasākums (ražotāja kampaņa) 1 darbība transportlīdzeklim."),
        row("25.02.2026", "196540", "Dzinēja eļļas un eļļas filtra maiņa.\nKarbamīda (AdBlue) iesmidzināšanas sprauslas maiņa."),
      ]),
    });
    const title = (km: string) => events.find((e) => e.kind === "service" && e.odometer === km)!.title;
    expect(title("103150")).toBe("Apkope");
    expect(title("49124")).toMatch(/^(Remonts|Kampaņa)$/);
    expect(events.filter((e) => e.kind === "service").map((e) => e.title)).toEqual(
      expect.arrayContaining(["Remonts", "Kampaņa", "Apkope + remonts"]),
    );
    for (const e of events.filter((x) => x.kind === "service")) {
      expect(e.sources).toEqual([SOURCE_BLOCK_LABELS.auto_records]);
    }
  });

  it("„Vācija / Eiropas Savienība” → „Vācija”; tikai „EU” nav valsts", () => {
    expect(stripEuSuffix("Vācija / Eiropas Savienība")).toBe("Vācija");
    expect(stripEuSuffix("Germany, EU")).toBe("Germany");
    expect(stripEuSuffix("Eiropas Savienība")).toBe("");
    expect(stripEuSuffix("Spānija")).toBe("Spānija");
  });
});

describe("eļļas intervālu piezīme", () => {
  it("Stellantis „Sistemātiskie apkopes darbi” = eļļas maiņa", () => {
    expect(isEngineOilChangeWork("Sistemātiskie apkopes darbi.")).toBe(true);
    expect(isEngineOilChangeWork("SYSTEMATISCHE WARTUNGSARBEITEN")).toBe(true);
    expect(isEngineOilChangeWork("Travaux systématiques d'entretien")).toBe(true);
    expect(isEngineOilChangeWork("Salona filtra maiņa (apkope)")).toBe(false);
  });

  it("dīlera / Business variantā bez ieteikumiem; Mercedes piemērs tikai Mercedes; bez „spēkrata”", () => {
    const business = oilClaimCautionHtml({ omitRecommendation: true, makeModel: "Opel Vivaro" });
    expect(business).not.toMatch(/Rekomendācija|ieteicams|Pirmspirkuma/);
    expect(business).not.toContain("Mercedes");
    const audits = oilClaimCautionHtml({ makeModel: "Opel Vivaro" });
    expect(audits).toContain("Rekomendācija pilnīgai pārbaudei.");
    expect(audits).not.toMatch(/spēkrat/);
    expect(oilClaimCautionHtml({ makeModel: "Mercedes-Benz Vito" })).toContain("Mercedes-Benz „Apkope A”");
  });
});
