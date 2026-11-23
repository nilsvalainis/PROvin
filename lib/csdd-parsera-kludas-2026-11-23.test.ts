/**
 * CSDD datu audits 23.11.2026 - parsera kļūdu regresijas testi.
 * Fiksācijas ir sintētiskas pēc reālo e.csdd tekstu formas: numurzīmes, VIN un polišu numuri ir izdomāti,
 * personas datu nav.
 */
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, emptyCsddFields, type CsddFormFields } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts, buildCanonicalFactsSheet } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions, extractCanonicalFactsFromPrompt } from "@/lib/comment-contradiction-check";
import { normalizeEcsddPdfText } from "@/lib/csdd-ecsdd-pdf-normalize";
import { parseTechnicalInspectionHistory } from "@/lib/csdd-extended-parse";
import { buildTechnicalInspectionHistoryTableHtml } from "@/lib/csdd-inspection-history-html";
import { applyCsddPasteToForm, backfillCsddExtendedFromRaw, parseCsddPaste } from "@/lib/csdd-paste-parse";
import {
  analyzeCsddInspectionDefects,
  buildCsddRegistrySignalFactLines,
  CSDD_RESTRICTIONS_NOT_CHECKED_LINE,
  parseCsddOctaFromRaw,
  parseCsddRegistrySignals,
} from "@/lib/csdd-registry-signals";
import { computeLatviaRegistrationTenure } from "@/lib/latvia-registration-tenure";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";

const NOW = Date.UTC(2026, 10, 23);

/** Vecais formāts (tab), nereģistrēts auto - pēc YV1CZ694681459156 parauga. */
const OLD_UNREGISTERED = [
  "Tehniskie dati",
  "Reģistrācijas statuss:\tnav reģistrēts",
  "Marka, modelis:\tVOLVO XC90",
  "Izgatavošanas gads:\t2008",
  "Emisiju standarts:\tEuro 4",
  "Odometra rādījums:\t212360",
  "CO2:\t239",
  "Degvielas veids:\tDīzeļdegviela",
  "Degvielas patēriņš:\t9.0",
  "Motora maksimālā jauda (kW):\t120",
  "Motora tilpums (cm3):\t2400",
  "Pilna masa (kg):\t2750",
  "Pašmasa (kg):\t2144",
  "",
  "Nobraukums ārvalstīs",
  "Datums:\tNobraukums\tValsts",
  "28.04.2026\t211330 km\tBEĻĢIJA",
  "15.07.2025\t207819 km\tBEĻĢIJA",
].join("\n");

/** Jaunais e.csdd formāts (PDF teksts) - pēc WDC1671191A002835 parauga. */
function newFormat(opts: { octa: string[]; status?: string; tax?: string; bans?: string[]; extra?: string[] }): string {
  return [
    "Aizliegumi",
    ...(opts.bans ?? ["Nav"]),
    "Būtiski bojājumi CSNg",
    "Informācija no policijas:Nav",
    "Informācija no apdrošinātājiem:Nav",
    "Reģistrācijas dati",
    "Reģistrācijas numurs AA1111",
    `Statuss ${opts.status ?? "Uzskaitē"}`,
    "Marka Modelis MERCEDES BENZ GLE 300 D 4MATIC",
    "Pilna masa (kg) 2950",
    "Pašmasa (kg) 2330",
    "Transportlīdzekļa veids Vieglais plašlietojuma",
    "Sēdvietu skaits 5",
    "Degviela Dīzeļdegviela",
    "VIN WDC00000000000001",
    "Izlaiduma gads 2019",
    "Iepriekšējās reģistrācijas valsts IGAUNIJA",
    ...(opts.extra ?? []),
    "Transportlīdzekļa reģistrācija",
    " No 01/03/2023 2 īpašnieki",
    "01.03.2023 - Pirmā reģistrācija Latvijā",
    "06.02.2024 - Īpašnieka maiņa",
    "Transportlīdzekļa ekspluatācijas nodoklis",
    opts.tax ?? "Par tekošo gadu samaksāti 159 Euro",
    "159,00 EUR - uz gadu (pilnā apmērā)",
    "Civiltiesiskā apdrošināšana",
    ...opts.octa,
    "Pēdējā tehniskā apskate",
    "TA datums 10.07.2026",
    "Nākošā TA 10.07.2028",
    "Odometra rādījums 158759",
    "Novērtējums 0 - Teicamā tehniskā stāvoklī",
    "Informācija sagatavota elektroniski 05.11.202619:31:30. Šobrīd dati var būt mainījušies.",
  ].join("\n");
}

const POLICY = ["Polise XX000000", "Spēkā stāšanās datums 07.03.2026", "Beigu datums 06.03.2027"];

function paste(raw: string, current: CsddFormFields = emptyCsddFields()): CsddFormFields {
  return applyCsddPasteToForm(current, raw, parseCsddPaste(raw));
}

describe("1. degvielas veids no e.csdd teksta", () => {
  it("normalizācija nesadala „Degvielas veids” un „Degvielas patēriņš”", () => {
    const out = normalizeEcsddPdfText("Degvielas veids:\tBenzīns\nDegvielas patēriņš:\t7.1");
    expect(out).toContain("Degvielas veids:");
    expect(out).toContain("Degvielas patēriņš:");
    expect(out).not.toContain("Degviela s ");
  });

  it("salipusi PDF etiķete joprojām tiek atdalīta", () => {
    expect(normalizeEcsddPdfText("DegvielaDīzeļdegviela")).toBe("Degviela Dīzeļdegviela");
  });

  it("vecais tab formāts dod degvielu", () => {
    expect(paste(OLD_UNREGISTERED).fuelType).toBe("Dīzeļdegviela");
  });

  it("jau sabojāts saglabātais teksts („Degviela s veids”) arī tiek nolasīts", () => {
    const broken = OLD_UNREGISTERED.replace("Degvielas veids:", "Degviela s veids:");
    expect(paste(broken).fuelType).toBe("Dīzeļdegviela");
  });

  it("jaunais formāts dod degvielu", () => {
    expect(paste(newFormat({ octa: POLICY })).fuelType).toBe("Dīzeļdegviela");
  });

  it("vecs melnraksts: tukšs lauks tiek aizpildīts no saglabātā RAW, aizpildīts paliek", () => {
    const old = { ...emptyCsddFields(), rawUnprocessedData: OLD_UNREGISTERED };
    expect(backfillCsddExtendedFromRaw(old).fuelType).toBe("Dīzeļdegviela");
    expect(backfillCsddExtendedFromRaw({ ...old, fuelType: "Benzīns" }).fuelType).toBe("Benzīns");
  });
});

describe("2. „Izgatavošanas gads”", () => {
  it("tiek nolasīts kā izlaiduma gads", () => {
    expect(paste(OLD_UNREGISTERED).modelYear).toBe("2008");
    expect(backfillCsddExtendedFromRaw({ ...emptyCsddFields(), rawUnprocessedData: OLD_UNREGISTERED }).modelYear).toBe("2008");
  });
});

describe("3. OCTA no e.csdd teksta", () => {
  it("polises beigu datums nonāk laukā (ISO)", () => {
    expect(paste(newFormat({ octa: POLICY })).insuranceValidUntil).toBe("2027-03-06");
  });

  it("salipis PDF teksts („Beigu datums06.03.2027”)", () => {
    const glued = newFormat({ octa: ["PoliseXX000000", "Spēkā stāšanās datums07.03.2026", "Beigu datums06.03.2027"] });
    expect(paste(glued).insuranceValidUntil).toBe("2027-03-06");
  });

  it("„Nav” nonāk laukā kā „Nav”", () => {
    expect(paste(newFormat({ octa: ["Nav"] })).insuranceValidUntil).toBe("Nav");
  });

  it("bez sadaļas lauks paliek tukšs un esošo vērtību neiztukšo", () => {
    expect(paste(OLD_UNREGISTERED).insuranceValidUntil).toBe("");
    expect(paste(OLD_UNREGISTERED, { ...emptyCsddFields(), insuranceValidUntil: "2027-01-01" }).insuranceValidUntil).toBe(
      "2027-01-01",
    );
  });

  it("polises numurs netiek atgriezts", () => {
    expect(JSON.stringify(parseCsddOctaFromRaw(newFormat({ octa: POLICY })))).not.toContain("XX000000");
  });

  it("vecs melnraksts: tukšs OCTA lauks tiek aizpildīts no saglabātā RAW", () => {
    const old = { ...emptyCsddFields(), rawUnprocessedData: newFormat({ octa: ["Nav"] }) };
    expect(backfillCsddExtendedFromRaw(old).insuranceValidUntil).toBe("Nav");
    expect(backfillCsddExtendedFromRaw({ ...old, insuranceValidUntil: "2027-01-01" }).insuranceValidUntil).toBe("2027-01-01");
  });
});

describe("4. laika josla: divas īpašnieka maiņas vienā mēnesī", () => {
  it("abas maiņas paliek un numerācija nelec (WBAGE81090DB82240: 09.12.2025 un 16.12.2025)", () => {
    const csdd: CsddFormFields = {
      ...emptyCsddFields(),
      firstRegistration: "2000-01-12",
      previousRegistrationCountry: "VĀCIJA",
      ownerRegistrationEvents: [
        { date: "03.02.2007", label: "Pirmā reģistrācija Latvijā" },
        { date: "16.02.2007", label: "Īpašnieka maiņa" },
        { date: "16.03.2021", label: "Īpašnieka maiņa" },
        { date: "09.12.2025", label: "Īpašnieka maiņa" },
        { date: "16.12.2025", label: "Īpašnieka maiņa" },
        { date: "10.07.2026", label: "Īpašnieka maiņa" },
      ],
    };
    const owners = buildVehicleLifecycleEvents({ csddForm: csdd })
      .filter((e) => e.title === "Īpašnieka maiņa")
      .map((e) => `${e.date} ${e.detail}`);
    expect(owners).toEqual([
      "16.02.2007 2. īpašnieks Latvijā",
      "16.03.2021 3. īpašnieks Latvijā",
      "09.12.2025 4. īpašnieks Latvijā",
      "16.12.2025 5. īpašnieks Latvijā",
      "10.07.2026 6. īpašnieks Latvijā",
    ]);
  });

  it("tas pats datums divreiz joprojām ir viens notikums", () => {
    const csdd: CsddFormFields = {
      ...emptyCsddFields(),
      ownerRegistrationEvents: [
        { date: "03.02.2007", label: "Pirmā reģistrācija Latvijā" },
        { date: "09.12.2025", label: "Īpašnieka maiņa" },
        { date: "09.12.2025", label: "Īpašnieka maiņa" },
      ],
    };
    const owners = buildVehicleLifecycleEvents({ csddForm: csdd }).filter((e) => e.title === "Īpašnieka maiņa");
    expect(owners).toHaveLength(1);
  });
});

describe("5. salipis defekta kods e.csdd PDF formātā", () => {
  const TA = [
    "Tehnisko apskašu vēsture",
    "Apskates datums 15.06.2026",
    "Apskates tips pamatpārbaude",
    "Novērtējums 2 - Ar mēneša laikā labojamiem defektiem",
    "Kods Novērtējums Trūkumi vai bojājumi",
    "2.1.3.2Priekšējais tilts. Palielināta kreisā ārējā stūres",
    "šarnīra brīvkustība.",
    "5.3.3.12. tilts. Funkcionalitāti",
    "neietekmējošas balstrāmja deformācijas vai virspusēja korozija.",
    "1.1.14.22.tilts. Bremžu diska darba virsmas",
    "nodilums.",
    "Informācija sagatavota elektroniski 05.11.202619:31:30. Šobrīd dati var būt mainījušies.",
  ].join("\n");

  it("kods ar ass numuru ir atsevišķs defekts", () => {
    const defects = parseTechnicalInspectionHistory(TA)[0]!.defects;
    expect(defects.map((d) => `${d.code}|${d.rating}|${d.description}`)).toEqual([
      "2.1.3.|2|Priekšējais tilts. Palielināta kreisā ārējā stūres šarnīra brīvkustība.",
      "5.3.3.|1|2. tilts. Funkcionalitāti neietekmējošas balstrāmja deformācijas vai virspusēja korozija.",
      "1.1.14.|2|2.tilts. Bremžu diska darba virsmas nodilums.",
    ]);
  });

  it("normalizācija ir idempotenta", () => {
    const once = normalizeEcsddPdfText(TA);
    expect(normalizeEcsddPdfText(once)).toBe(once);
  });

  it("vecs melnraksts ar salipušo defektu tiek pārlasīts no RAW; citādi TA vēsturi neaiztiek", () => {
    const stored: CsddFormFields = {
      ...emptyCsddFields(),
      rawUnprocessedData: TA,
      technicalInspectionHistory: [
        {
          date: "15.06.2026",
          inspectionType: "pamatpārbaude",
          ratingLabel: "2 - Ar mēneša laikā labojamiem defektiem",
          ratingLevel: 2,
          maxDefectLevel: 2,
          smokeCoefficient: "",
          notes: "",
          defects: [
            {
              code: "2.1.3.",
              rating: "2",
              description:
                "Priekšējais tilts. Palielināta kreisā ārējā stūres šarnīra brīvkustība. 5.3.3.12. tilts. Funkcionalitāti neietekmējošas balstrāmja deformācijas vai virspusēja korozija. 1.1.14.22.tilts. Bremžu diska darba virsmas nodilums.",
            },
          ],
        },
      ],
    };
    expect(backfillCsddExtendedFromRaw(stored).technicalInspectionHistory[0]!.defects).toHaveLength(3);

    const edited: CsddFormFields = {
      ...stored,
      technicalInspectionHistory: [
        { ...stored.technicalInspectionHistory[0]!, defects: [{ code: "2.1.3.", rating: "2", description: "Operatora labots." }] },
      ],
    };
    expect(backfillCsddExtendedFromRaw(edited).technicalInspectionHistory[0]!.defects).toHaveLength(1);
  });
});

describe("6. AI fakti: liegumi tikai ar avotu", () => {
  it("sadaļas „Aizliegumi” nav - „nav pārbaudīts” un aizliegums rakstīt „liegumu nav”", () => {
    const lines = buildCsddRegistrySignalFactLines(paste(OLD_UNREGISTERED), NOW);
    expect(lines).toContain(CSDD_RESTRICTIONS_NOT_CHECKED_LINE);
    expect(lines.join("\n")).not.toMatch(/aizliegumu nav/);
  });

  it("sadaļa ir ar „Nav” - drīkst „e.csdd: aizliegumu nav (datums)”", () => {
    const lines = buildCsddRegistrySignalFactLines(paste(newFormat({ octa: POLICY })), NOW);
    expect(lines[0]).toContain("e.csdd: aizliegumu nav (05.11.2026)");
    expect(lines.join("\n")).toContain("informācija no policijas: nav");
    expect(lines.join("\n")).toContain("informācija no apdrošinātājiem: nav");
    expect(lines).not.toContain(CSDD_RESTRICTIONS_NOT_CHECKED_LINE);
  });

  it("sadaļā ir ieraksti - nodod kā faktu", () => {
    const raw = newFormat({ octa: POLICY, bans: ["Atsavināšanas aizliegums 01.02.2026", "Reģistrācijas aizliegums 03.02.2026"] });
    const s = parseCsddRegistrySignals(paste(raw), NOW);
    expect(s.restrictions.state).toBe("present");
    expect(s.restrictions.text).toBe("Atsavināšanas aizliegums 01.02.2026; Reģistrācijas aizliegums 03.02.2026");
    expect(buildCsddRegistrySignalFactLines(paste(raw), NOW)[0]).toContain("AIZLIEGUMI IR");
  });

  it("faktu lapā ir AUDITS/PRO komentāriem, dīlera datu komentāriem nav", () => {
    const sourceBlocks = { ...createDefaultSourceBlocks(), csdd: paste(OLD_UNREGISTERED) };
    expect(buildCanonicalFactsSheet({ sourceBlocks })).toContain("Liegumi / aizliegumi: NAV PĀRBAUDĪTS");
    expect(buildCanonicalFactsSheet({ sourceBlocks, omitCsddRegistrySignals: true })).not.toContain("Liegumi / aizliegumi");
  });

  it("tukšam CSDD blokam faktu nav", () => {
    expect(buildCsddRegistrySignalFactLines(emptyCsddFields(), NOW)).toEqual([]);
  });
});

describe("7. nereģistrēts auto: nav „Reģistrācija Latvijā 0 dienas”", () => {
  it("statuss „nav reģistrēts” - reģistrācijas ilgumu nerēķina", () => {
    const csdd = paste(OLD_UNREGISTERED);
    expect(csdd.registrationStatus).toBe("nav reģistrēts");
    const withLvRow: CsddFormFields = {
      ...csdd,
      mileageHistory: [...csdd.mileageHistory, { date: "02.11.2026", odometer: "212360", country: "Latvija" }],
    };
    expect(computeLatviaRegistrationTenure({ csddForm: withLvRow, referenceDate: new Date(NOW) })).toBeNull();
    expect(
      computeLatviaRegistrationTenure({
        csddForm: { ...withLvRow, registrationStatus: "Uzskaitē" },
        referenceDate: new Date(NOW),
      }),
    ).not.toBeNull();
  });
});

describe("8. ārvalstu TA atļauja: „Novērtējums **” vietā teksts", () => {
  const row = {
    date: "20.05.2026",
    inspectionType:
      "Atļauja piedalīties ceļu satiksmē bez kontroles veikšanas, ja derīga ārvalstī izsniegtā atļauja piedalīties ceļu satiksmē",
    ratingLabel: "**",
    ratingLevel: null,
    maxDefectLevel: null,
    smokeCoefficient: "",
    notes: "",
    defects: [],
  };

  it("PDF rāda „Latvijā TA vēl nav veikta”", () => {
    const html = buildTechnicalInspectionHistoryTableHtml([row]);
    expect(html).toContain("Latvijā TA vēl nav veikta");
    expect(html).not.toContain("**");
    expect(html).not.toContain("Novērtējums");
  });

  it("parasta apskate nemainās", () => {
    const html = buildTechnicalInspectionHistoryTableHtml([
      { ...row, inspectionType: "pamatpārbaude", ratingLabel: "0 - Teicamā tehniskā stāvoklī" },
    ]);
    expect(html).toContain("Novērtējums 0 - Teicamā tehniskā stāvoklī");
  });
});

describe("9. AI fakti no e.csdd teksta", () => {
  it("noņemts no uzskaites, atļauja beigusies / vēl spēkā", () => {
    const raw = OLD_UNREGISTERED.replace(
      "nav reģistrēts",
      "Noņemts no uzskaites, atļauts piedalīties ceļu satiksmē līdz 01.08.2026",
    );
    const s = parseCsddRegistrySignals(paste(raw), NOW);
    expect(s.status).toMatchObject({ removedFromRegister: true, allowedUntil: "01.08.2026", permitExpired: true });
    expect(buildCsddRegistrySignalFactLines(paste(raw), NOW).join("\n")).toContain("BEIGUSIES 01.08.2026");
    expect(parseCsddRegistrySignals(paste(raw), Date.UTC(2026, 6, 1)).status.permitExpired).toBe(false);
  });

  it("nereģistrēts auto", () => {
    expect(buildCsddRegistrySignalFactLines(paste(OLD_UNREGISTERED), NOW).join("\n")).toContain("nav reģistrēts Latvijā");
  });

  it("OCTA nav; īstermiņa polise; polise beidzas drīz; gara polise bez rindas", () => {
    const text = (octa: string[]) => buildCsddRegistrySignalFactLines(paste(newFormat({ octa })), NOW).join("\n");
    expect(text(["Nav"])).toContain("OCTA: nav spēkā esošas polises");
    expect(text(["Polise XX000000", "Spēkā stāšanās datums 06.11.2026", "Beigu datums 06.12.2026"])).toContain(
      "īstermiņa polise 06.11.2026-06.12.2026 (31 dienas)",
    );
    expect(text(["Polise XX000000", "Spēkā stāšanās datums 01.12.2025", "Beigu datums 30.11.2026"])).toContain(
      "polise beidzas 30.11.2026 (atlikušas 7 dienas)",
    );
    expect(text(POLICY)).not.toContain("OCTA");
  });

  it("nodoklis nav samaksāts; samaksātam rindas nav", () => {
    const unpaid = newFormat({ octa: POLICY, tax: "Maksājums par tekošo gadu nav veikts" });
    expect(buildCsddRegistrySignalFactLines(paste(unpaid), NOW).join("\n")).toContain("NAV samaksāts");
    expect(buildCsddRegistrySignalFactLines(paste(newFormat({ octa: POLICY })), NOW).join("\n")).not.toContain("nodoklis");
  });

  it("tirdzniecības reģistrs un pilnvara atsavināt (bez personas datiem)", () => {
    const raw = `${OLD_UNREGISTERED}\nCSDD Tirdzniecības reģistra statuss:\tIr ievietots (apskatīt)\n${newFormat({
      octa: POLICY,
      extra: ["PilnvaraAtsavin āt TL (MKL) citai personai 29.01.2020"],
    })}`;
    const text = buildCsddRegistrySignalFactLines(paste(raw), NOW).join("\n");
    expect(text).toContain("Tirdzniecības reģistrs: auto IR ievietots");
    expect(text).toContain("Pilnvara reģistrā: atsavināt transportlīdzekli citai personai (29.01.2020)");
  });

  it("ārvalstu TA atļauja - Latvijā TA nav veikta", () => {
    const raw = OLD_UNREGISTERED.replace(
      "Reģistrācijas statuss:\tnav reģistrēts",
      "Pārbaudes veids:\tAtļauja piedalīties ceļu satiksmē bez kontroles veikšanas, ja derīga ārvalstī izsniegtā atļauja piedalīties ceļu satiksmē\nReģistrācijas statuss:\tUzskaitē\nNovērtējums:\t**",
    );
    expect(buildCsddRegistrySignalFactLines(paste(raw), NOW).join("\n")).toContain("Latvijā TA vēl nav veikta");
  });

  it("atkārtoti TA defekti (tas pats mezgls 3 gados) un apskašu ar vērtējumu 2/3 skaits", () => {
    const mk = (date: string, level: 0 | 1 | 2 | 3, defects: [string, string, string][]) => ({
      date,
      inspectionType: "pamatpārbaude",
      ratingLabel: `${level} - x`,
      ratingLevel: level === 0 ? null : level,
      maxDefectLevel: null,
      smokeCoefficient: "",
      notes: "",
      defects: defects.map(([code, rating, description]) => ({ code, rating, description })),
    });
    const rows = [
      mk("10.06.2026", 2, [["8.4.1.", "2", "Sūcas eļļa no motora."], ["5.3.4.", "2", "Priekšējais tilts."]]),
      mk("10.06.2026", 2, [["8.4.1.", "2", "Sūcas eļļa no motora."]]), // dublikāts (teksts divreiz)
      mk("11.06.2025", 1, [["8.4.1.", "1", "Sūcas eļļa no motora."]]),
      mk("12.06.2024", 3, [["8.4.2.", "3", "Pil eļļa."], ["5.3.1.", "2", "Atspere."]]),
      mk("13.06.2023", 0, []),
    ];
    const a = analyzeCsddInspectionDefects(rows);
    expect(a).toMatchObject({ inspectionCount: 4, failedCount: 2, rating3Count: 1 });
    expect(a.repeated).toEqual([{ node: "8.4", years: [2024, 2025, 2026], sample: "Sūcas eļļa no motora." }]);
    const text = buildCsddRegistrySignalFactLines({ ...paste(OLD_UNREGISTERED), technicalInspectionHistory: rows }, NOW).join("\n");
    expect(text).toContain("TA ar vērtējumu 2 vai 3: 2 no 4 apskatēm (no tām ar vērtējumu 3: 1)");
    expect(text).toContain("Atkārtots TA defekts, mezgls 8.4 (3 gados: 2024-2026): Sūcas eļļa no motora.");
  });
});

describe("6b. deterministiska pārbaude: „liegumu nav” bez avota", () => {
  const facts = (raw: string) =>
    buildCanonicalFacts({ sourceBlocks: { ...createDefaultSourceBlocks(), csdd: paste(raw) } });

  it("karodziņš, ja sadaļas „Aizliegumi” nav un teksts apgalvo, ka liegumu nav", () => {
    const f = facts(OLD_UNREGISTERED);
    for (const text of [
      "Transportlīdzeklim nav atzīmēti atsavināšanas aizliegumi vai citi juridiski apgrūtinājumi.",
      "Auto ir bez atsavināšanas aizliegumiem.",
      "Liegumu reģistrā nav.",
    ]) {
      expect(checkCommentContradictions({ text, facts: f }).map((x) => x.id)).toContain("unsourced_no_restrictions");
    }
    expect(
      checkCommentContradictions({ text: "Liegumi nav pārbaudīti - e.csdd izdrukā šīs sadaļas nav.", facts: f }).map((x) => x.id),
    ).not.toContain("unsourced_no_restrictions");
  });

  it("nav karodziņa, ja e.csdd sadaļa ir ar „Nav”", () => {
    const f = facts(newFormat({ octa: POLICY }));
    expect(
      checkCommentContradictions({ text: "e.csdd: aizliegumu nav (05.11.2026).", facts: f }).map((x) => x.id),
    ).not.toContain("unsourced_no_restrictions");
  });

  it("pārbaude strādā arī no prompta izvilktas faktu lapas", () => {
    const sheet = facts(OLD_UNREGISTERED).sheet;
    const fromPrompt = extractCanonicalFactsFromPrompt(`x\n${sheet}\ny`);
    expect(fromPrompt?.csddSignalLines).toEqual([CSDD_RESTRICTIONS_NOT_CHECKED_LINE]);
  });
});
