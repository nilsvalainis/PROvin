import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { mergeAutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { repairDealerImportText } from "@/lib/dealer-text-repair";
import { oneautoWorksNeedLvTranslation } from "@/lib/dealer-works-language";
import { countUntranslatedDealerWorkRows } from "@/lib/dealer-admin-service-rows";
import { applyOneautoToAutoRecords, emptyOneautoIngest } from "@/lib/oneauto-to-auto-records";

const R = "\uFFFD";

describe("vispārīga „�” atjaunošana vācu vārdos", () => {
  it.each([
    [`DURCHF${R}HREN`, "DURCHFÜHREN"],
    [`PR${R}FUNG`, "PRÜFUNG"],
    [`GEPR${R}FT`, "GEPRÜFT"],
    [`${R}BERPR${R}FEN`, "ÜBERPRÜFEN"],
    [`F${R}R`, "FÜR"],
    [`${R}NDERUNG`, "ÄNDERUNG"],
    [`Durchf${R}hrung der Pr${R}fung`, "Durchführung der Prüfung"],
    [`GEM${R}SS HERSTELLERVORGABE`, "GEMÄSS HERSTELLERVORGABE"],
    [`VERSCHLEI${R}TEILE`, "VERSCHLEISSTEILE"],
    [`BREMSFL${R}SSIGKEIT AUFGEF${R}LLT`, "BREMSFLÜSSIGKEIT AUFGEFÜLLT"],
    [`L${R}FTUNG GEPR${R}FT`, "LÜFTUNG GEPRÜFT"],
  ])("%s → %s", (input, expected) => {
    expect(repairDealerImportText(input)).toBe(expected);
  });

  it("nezināmu vārdu neizdomā", () => {
    expect(repairDealerImportText(`W${R}-AE`)).toBe(`W${R}-AE`);
    expect(repairDealerImportText(`X${R}Q`)).toBe(`X${R}Q`);
  });

  it("vecie Opel gadījumi joprojām strādā", () => {
    expect(repairDealerImportText(`MOTOR${R}L, ${R}LFILTER, R${R}DERWECHSEL, SICHERHEITSPRFG ${R} 57`)).toBe(
      "MOTORÖL, ÖLFILTER, RÄDERWECHSEL, SICHERHEITSPRÜFG § 57",
    );
  });
});

describe("LV tulkojuma atpazīšana", () => {
  it("LV tulkojums ar vienu svešu terminu skaitās pārtulkots", () => {
    expect(oneautoWorksNeedLvTranslation("Sistemātiskā apkope (Opel Service)")).toBe(false);
    expect(oneautoWorksNeedLvTranslation("ECM software atjaunināšana")).toBe(false);
  });

  it("jaukts teksts ar angļu teikumu joprojām jātulko", () => {
    expect(oneautoWorksNeedLvTranslation("Eļļas maiņa. Software update performed")).toBe(true);
  });

  it("vāciski Opel darbi jātulko", () => {
    expect(oneautoWorksNeedLvTranslation("Systematische Wartungsarbeiten")).toBe(true);
    expect(oneautoWorksNeedLvTranslation("DURCHFÜHREN")).toBe(true);
  });
});

describe("atkārtota OneAuto ielāde aizstāj vāciskās rindas ar LV", () => {
  const germanRows = [
    { date: "18.05.2026", odometer: "84310", location: "Germany", works: "Systematische Wartungsarbeiten" },
    { date: "12.05.2025", odometer: "61200", location: "Germany", works: "RÄDERWECHSEL" },
  ];

  it("merge: LV rinda ar to pašu datumu un km aizstāj vāciskās", () => {
    const merged = mergeAutoRecordsServiceWorkRow(germanRows, {
      date: "18.05.2026",
      odometer: "84310",
      location: "",
      works: "Sistemātiskie apkopes darbi",
    });
    const hit = merged.find((r) => r.date === "18.05.2026");
    expect(hit?.works).toBe("Sistemātiskie apkopes darbi");
    expect(hit?.location).toBe("Germany");
    expect(merged).toHaveLength(2);
  });

  it("merge: LV rinda neaizstāj operatora latvisko tekstu", () => {
    const merged = mergeAutoRecordsServiceWorkRow(
      [{ date: "18.05.2026", odometer: "84310", location: "Opel", works: "Apkope, eļļas maiņa" }],
      { date: "18.05.2026", odometer: "84310", location: "", works: "Sistemātiskie apkopes darbi" },
    );
    expect(merged[0]!.works).toBe("Apkope\nEļļas maiņa");
  });

  it("applyOneautoToAutoRecords ar tulkotu display: badge nav, Opel kļūda vairs neatkārtojas", () => {
    const current = { ...createDefaultSourceBlocks().auto_records, serviceWorks: germanRows };
    expect(countUntranslatedDealerWorkRows(current.serviceWorks)).toBe(2);
    const next = applyOneautoToAutoRecords(current, {
      display: {
        equipment: [],
        powertrain: [],
        serviceTimeline: [
          { date: "18.05.2026", odometer: "84310", place: "Germany", works: "Sistemātiskie apkopes darbi" },
          { date: "12.05.2025", odometer: "61200", place: "Germany", works: "Riteņu maiņa" },
        ],
      },
      ingest: { ...emptyOneautoIngest(), lastFetchedVin: "W0VZCYHZXN6843259" },
      vehicleOverride: true,
    });
    expect(countUntranslatedDealerWorkRows(next.serviceWorks ?? [])).toBe(0);
    expect((next.serviceWorks ?? []).map((r) => r.works)).toEqual([
      "Sistemātiskie apkopes darbi",
      "Riteņu maiņa",
    ]);
  });
});
