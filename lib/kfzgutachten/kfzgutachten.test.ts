import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import {
  applyKfzAtToCitiAvoti,
  findKfzAtSectionIndex,
  kfzAtPlateChanges,
  parseKfzSearchListText,
  readKfzAtStore,
} from "@/lib/kfzgutachten/apply-citi";
import { resolveKfzFirstRegistration } from "@/lib/kfzgutachten/first-registration";
import {
  KFZ_AT_SECTION_LABEL,
  kfzDateIsPartial,
  kfzExactDateDdMmYyyy,
  kfzgutachtenSearchUrl,
} from "@/lib/kfzgutachten/kfzgutachten";
import { kfzFindingLineLv, parseKfzGutachtenText } from "@/lib/kfzgutachten/parse-gutachten";
import { parseKfzAtProbe } from "@/lib/vin-scan/probe-kfz-at";
import { FAKE_VIN, GUTACHTEN_GLUED, GUTACHTEN_LINES, GUTACHTEN_OLDER } from "@/lib/kfzgutachten/__fixtures__/gutachten";

describe("kfzgutachten.at datumi un saite", () => {
  it("precīzs datums tikai ar dienu", () => {
    expect(kfzExactDateDdMmYyyy("2006-03-15")).toBe("15.03.2006");
    expect(kfzExactDateDdMmYyyy("5.3.2006")).toBe("05.03.2006");
    expect(kfzExactDateDdMmYyyy("31.02.2006")).toBe("");
    expect(kfzExactDateDdMmYyyy("03.2006")).toBe("");
    expect(kfzDateIsPartial("03.2006")).toBe(true);
    expect(kfzDateIsPartial("2006")).toBe(true);
    expect(kfzDateIsPartial("15.03.2006")).toBe(false);
  });

  it("saite aizpilda VIN un datumu; bez datuma - tukšs date=", () => {
    expect(kfzgutachtenSearchUrl(FAKE_VIN.toLowerCase(), "2006-03-15")).toBe(
      `https://kfzgutachten.at/?vin=${FAKE_VIN}&date=15.03.2006`,
    );
    expect(kfzgutachtenSearchUrl(FAKE_VIN)).toBe(`https://kfzgutachten.at/?vin=${FAKE_VIN}&date=`);
  });

  it("VIN SCAN rinda: bez datuma vajag datumu, ar datumu - tikai pārlūkā (reCAPTCHA)", () => {
    expect(parseKfzAtProbe(FAKE_VIN, "").status).toBe("needs_input");
    expect(parseKfzAtProbe(FAKE_VIN, "03.2006").status).toBe("needs_input");
    const ok = parseKfzAtProbe(FAKE_VIN, "15.03.2006");
    expect(ok.status).toBe("browser_only");
    expect(ok.openUrl).toContain("date=15.03.2006");
    expect(ok.summary).toMatch(/1,19 €/);
  });
});

describe("§57a atzinuma PDF parsētājs", () => {
  for (const [name, text] of [
    ["pdfjs rindas", GUTACHTEN_LINES],
    ["pdf-parse salīmēts", GUTACHTEN_GLUED],
  ] as const) {
    it(name, () => {
      const [r] = parseKfzGutachtenText(text);
      expect(r).toBeDefined();
      expect(r!.gutachtenNr).toBe("11112222");
      expect(r!.date).toBe("05.10.2022");
      expect(r!.odometerKm).toBe("163450");
      expect(r!.plate).toBe("GU 123AB");
      expect(r!.vin).toBe(FAKE_VIN);
      expect(r!.firstRegistration).toBe("15.03.2006");
      expect(r!.overall).toBe("major");
      expect(r!.nextInspection).toBe("10.2023");
      expect(r!.previous).toEqual({ gutachtenNr: "10001000", date: "02.10.2021", odometerKm: "151200" });
      const sev = r!.findings.map((f) => [f.code, f.severity]);
      expect(sev).toEqual([
        ["1.1.14", "major"],
        ["5.1.1", null],
        ["5.3.4", "minor"],
      ]);
    });
  }

  it("teksti latviski ar oriģinālu", () => {
    const [r] = parseKfzGutachtenText(GUTACHTEN_LINES);
    expect(kfzFindingLineLv(r!.findings[0]!)).toBe(
      "1.1.14 Bremžu sistēma - būtisks trūkums: Mechanischer Zustand und Funktion / Bremsscheiben - Bremsscheibe hinten stark verschlissen (oriģināls)",
    );
    expect(r!.findings[1]!.titleDe).toBe("Achsen / Achskörper");
  });

  it("vairāki atzinumi vienā tekstā; ne-atzinums -> tukšs", () => {
    const all = parseKfzGutachtenText(`${GUTACHTEN_OLDER}\n${GUTACHTEN_LINES}`);
    expect(all.map((r) => r.gutachtenNr)).toEqual(["10001000", "11112222"]);
    expect(parseKfzGutachtenText("CARFAX Vehicle History Report")).toEqual([]);
  });
});

describe("Citi avoti sadaļa", () => {
  const reports = parseKfzGutachtenText(`${GUTACHTEN_OLDER}\n${GUTACHTEN_LINES}`);

  it("ieliek tukšajā pirmajā sadaļā, nobraukums Austrijā, numurzīmes maiņa kā fakts", () => {
    const base = mergeSourceBlocksWithDefaults({}).citi_avoti;
    const res = applyKfzAtToCitiAvoti(base, { reports }, { vin: FAKE_VIN });
    expect(res.sectionIndex).toBe(0);
    expect(res.addedReports).toBe(2);
    const s = res.block.sections[0]!;
    expect(s.label).toBe(KFZ_AT_SECTION_LABEL);
    expect(s.serviceHistory).toEqual([
      { date: "02.10.2021", odometer: "151200", country: "Austrija" },
      { date: "05.10.2022", odometer: "163450", country: "Austrija" },
    ]);
    expect(s.comments).toContain("Numurzīme mainīta: W 55555X (02.10.2021) -> GU 123AB (05.10.2022).");
    expect(s.comments).toContain("rezultāts: neatbilst - būtiski trūkumi");
    expect(s.comments).toContain("Pirmā reģistrācija (Erstzulassung, atzinumā): 15.03.2006.");
    // Komentāros nav «datums | km | valsts» rindu, ko nobraukuma tabula lasītu otrreiz.
    expect(s.comments).not.toMatch(/\|/);
  });

  it("atkārtots imports nedublē; cits VIN netiek ielikts; esoša sadaļa paliek", () => {
    const base = mergeSourceBlocksWithDefaults({}).citi_avoti;
    base.sections[0] = { ...base.sections[0]!, label: "Cits avots", comments: "piezīme" };
    const one = applyKfzAtToCitiAvoti(base, { reports }, { vin: FAKE_VIN });
    expect(one.sectionIndex).toBe(1);
    expect(one.block.sections[0]!.comments).toBe("piezīme");
    const two = applyKfzAtToCitiAvoti(one.block, { reports: [{ ...reports[1]!, vin: "WVWZZZ1KZ6W999999", gutachtenNr: "9" }] }, { vin: FAKE_VIN });
    expect(two.addedReports).toBe(0);
    expect(two.warnings[0]).toMatch(/citam VIN/);
    const three = applyKfzAtToCitiAvoti(two.block, { reports }, { vin: FAKE_VIN });
    expect(three.addedReports).toBe(0);
    expect(readKfzAtStore(three.block.sections[findKfzAtSectionIndex(three.block)]).reports).toHaveLength(2);
  });

  it("bezmaksas saraksta ielīmēšana", () => {
    const paste = [
      "Marke und Type\tGutachtendatum\tKennzeichen\tFIN",
      `VW 1K\t05.10.2022\tGU 123AB\t${FAKE_VIN}`,
      `Marke und Type: VW 1K Gutachtendatum: 02.10.2021 Kennzeichen: W 55555X FIN: ${FAKE_VIN}`,
      "VW 1K 01.10.2020 W 55555X WVWZZZ1KZ6W999999",
    ].join("\n");
    const rows = parseKfzSearchListText(paste, FAKE_VIN);
    expect(rows.map((r) => [r.date, r.plate])).toEqual([
      ["05.10.2022", "GU 123AB"],
      ["02.10.2021", "W 55555X"],
    ]);
    const base = mergeSourceBlocksWithDefaults({}).citi_avoti;
    const res = applyKfzAtToCitiAvoti(base, { list: rows }, { vin: FAKE_VIN });
    expect(res.addedListRows).toBe(2);
    const store = readKfzAtStore(res.block.sections[0]);
    expect(kfzAtPlateChanges(store)).toHaveLength(1);
    expect(res.block.sections[0]!.comments).toContain("Austrijas §57a apskates (saraksts, 2): 02.10.2021 (W 55555X), 05.10.2022 (GU 123AB).");
  });
});

describe("1. reģistrācijas datuma ķēde", () => {
  it("nav datu -> vajag precīzu datumu; tikai mēnesis -> partial", () => {
    const blocks = mergeSourceBlocksWithDefaults({});
    expect(resolveKfzFirstRegistration(blocks).needsExactDate).toBe(true);
    blocks.csdd.firstRegistration = "03.2006";
    const r = resolveKfzFirstRegistration(blocks);
    expect(r.needsExactDate).toBe(true);
    expect(r.partial).toBe("03.2006");
  });

  it("CSDD datums; importētam auto LV datums ir vājākais", () => {
    const blocks = mergeSourceBlocksWithDefaults({});
    blocks.csdd.firstRegistration = "2006-03-15";
    expect(resolveKfzFirstRegistration(blocks).date).toBe("15.03.2006");

    blocks.csdd.firstRegistration = "2019-05-20";
    blocks.csdd.firstRegistrationLatvia = "2019-05-20";
    blocks.csdd.previousRegistrationCountry = "Austrija";
    blocks.auto_records.outvinReport = {
      ...emptyOutvinDealerReport(),
      vehicleInfo: { ...emptyOutvinDealerReport().vehicleInfo, firstRegistration: "15.03.2006" },
    };
    const r = resolveKfzFirstRegistration(blocks);
    expect(r.date).toBe("15.03.2006");
    expect(r.candidates.find((c) => c.date === "20.05.2019")?.maybeNational).toBe(true);
  });

  it("ielasītā atzinuma Erstzulassung ir stiprākais", () => {
    const blocks = mergeSourceBlocksWithDefaults({});
    blocks.csdd.firstRegistration = "2006-04-01";
    blocks.citi_avoti = applyKfzAtToCitiAvoti(blocks.citi_avoti, { reports: parseKfzGutachtenText(GUTACHTEN_LINES) }).block;
    const r = resolveKfzFirstRegistration(blocks);
    expect(r.date).toBe("15.03.2006");
    expect(r.source).toBe("kfzgutachten.at atzinums");
    expect(r.candidates.map((c) => c.date)).toContain("01.04.2006");
  });
});
