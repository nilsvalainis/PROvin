import { describe, expect, it } from "vitest";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { parseCopilotGeminiPayload } from "@/lib/admin-copilot-parse";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import {
  autoRecordsServiceWorkRowsToPlainText,
  formatServiceWorkOdometer,
  mergeAutoRecordsServiceWorkRow,
  normalizeAutoRecordsServiceWorkRows,
  parseAutoRecordsServiceWorkLines,
  parseDealerNarrativeServiceWorks,
} from "@/lib/auto-records-service-works";

describe("servisa darbu rindas", () => {
  it("normalizē datumu, odometru, vietu un darbus", () => {
    const rows = normalizeAutoRecordsServiceWorkRows([
      {
        date: "12.2023",
        odometer: "47 521 km",
        location: "  Niederlassung Bonn BMW AG,  Bonn ",
        works: "  Regulārā apkope:  eļļas maiņa ",
      },
      { date: "", odometer: "", location: "", works: "" },
    ]);
    expect(rows).toEqual([
      {
        date: "01.12.2023",
        odometer: "47521",
        location: "Niederlassung Bonn BMW AG, Bonn",
        works: "Regulārā apkope: eļļas maiņa",
      },
    ]);
  });

  it("tukšai vērtībai atgriež vienu tukšu ievades rindu", () => {
    expect(normalizeAutoRecordsServiceWorkRows(undefined)).toEqual([
      { date: "", odometer: "", location: "", works: "" },
    ]);
  });

  it("kārto jaunāko augšā un aizpilda tukšo slotu", () => {
    let rows = [{ date: "", odometer: "", location: "", works: "" }];
    rows = mergeAutoRecordsServiceWorkRow(rows, {
      date: "01.06.2023",
      odometer: "26276",
      location: "",
      works: "Eļļas maiņa",
    });
    rows = mergeAutoRecordsServiceWorkRow(rows, {
      date: "12.2023",
      odometer: "47 521",
      location: "BMW Bonn",
      works: "Bremžu šķidruma maiņa",
    });
    expect(rows.map((r) => r.date)).toEqual(["01.12.2023", "01.06.2023"]);
    expect(rows[0]!.location).toBe("BMW Bonn");
  });

  it("neaizvieto operatora labotu rindu ar to pašu datumu un odometru", () => {
    const rows = mergeAutoRecordsServiceWorkRow(
      [{ date: "01.12.2023", odometer: "47521", location: "Operatora vieta", works: "Operatora teksts" }],
      {
        date: "01.12.2023",
        odometer: "47521",
        location: "BMW Bonn",
        works: "Regulārā apkope: eļļas maiņa",
      },
    );
    expect(rows).toEqual([
      { date: "01.12.2023", odometer: "47521", location: "Operatora vieta", works: "Operatora teksts" },
    ]);
  });

  it("tukšu vietas kolonnu papildina no jaunās apstrādes", () => {
    const rows = mergeAutoRecordsServiceWorkRow(
      [{ date: "01.12.2023", odometer: "47521", location: "", works: "Operatora teksts" }],
      { date: "01.12.2023", odometer: "47521", location: "BMW Bonn", works: "Eļļas maiņa" },
    );
    expect(rows).toEqual([
      { date: "01.12.2023", odometer: "47521", location: "BMW Bonn", works: "Operatora teksts" },
    ]);
  });

  it("izceļ dīlera punktu no darbu teksta pirms kolona", () => {
    expect(
      normalizeAutoRecordsServiceWorkRows([
        {
          date: "05.09.2019",
          odometer: "198833",
          location: "",
          works: "B&K Deutschland GmbH, Osnabrück: detalizēts darbu saraksts atskaitē nav pieejams",
        },
        {
          date: "12.04.2012",
          odometer: "80000",
          location: "",
          works:
            "BMW Mobiler Service Einsatzleitzentrale, München: detalizēts darbu saraksts atskaitē nav pieejams",
        },
        {
          date: "01.01.2010",
          odometer: "1000",
          location: "",
          works: "Dīlera ID: 00863 - 3: detalizēts darbu saraksts atskaitē nav pieejams",
        },
        {
          date: "23.10.2014",
          odometer: "120475",
          location: "",
          works: "B&K Deutschland GmbH, Osnabrück: Update DVD Road Map Europe Professional",
        },
        {
          date: "01.12.2023",
          odometer: "47521",
          location: "",
          works: "Regulārā apkope: eļļas maiņa",
        },
      ]),
    ).toEqual([
      {
        date: "01.12.2023",
        odometer: "47521",
        location: "",
        works: "Regulārā apkope: eļļas maiņa",
      },
      {
        date: "05.09.2019",
        odometer: "198833",
        location: "B&K Deutschland GmbH, Osnabrück",
        works: "detalizēts darbu saraksts atskaitē nav pieejams",
      },
      {
        date: "23.10.2014",
        odometer: "120475",
        location: "B&K Deutschland GmbH, Osnabrück",
        works: "Update DVD Road Map Europe Professional",
      },
      {
        date: "12.04.2012",
        odometer: "80000",
        location: "BMW Mobiler Service Einsatzleitzentrale, München",
        works: "detalizēts darbu saraksts atskaitē nav pieejams",
      },
      {
        date: "01.01.2010",
        odometer: "1000",
        location: "Dīlera ID: 00863 - 3",
        works: "detalizēts darbu saraksts atskaitē nav pieejams",
      },
    ]);
  });

  it("pārnes teksta rindas uz tabulu, atdalot vietu", () => {
    const rows = parseAutoRecordsServiceWorkLines(
      [
        "01.12.2023 | 47 521 km | Regulārā apkope: eļļas maiņa | Vieta: BMW Bonn",
        "06.2023 | 26 276 km | Eļļas maiņa",
        "Nav servisa rinda",
      ].join("\n"),
    );
    expect(rows).toEqual([
      {
        date: "01.12.2023",
        odometer: "47521",
        location: "BMW Bonn",
        works: "Regulārā apkope: eļļas maiņa",
      },
      { date: "01.06.2023", odometer: "26276", location: "", works: "Eļļas maiņa" },
    ]);
  });

  it("dīlera narratīva ielīmē saglabā veiktos darbus", () => {
    const rows = parseDealerNarrativeServiceWorks(
      [
        "02.2026. (278 484 km | Vācija): Veikta regulārā apkope, eļļas maiņa;",
        "08.2025. (265 100 km | Vācija): Bremžu disku maiņa",
        "Nav rinda",
      ].join("\n"),
    );
    expect(rows).toEqual([
      {
        date: "01.02.2026",
        odometer: "278484",
        location: "",
        works: "Veikta regulārā apkope, eļļas maiņa",
      },
      { date: "01.08.2025", odometer: "265100", location: "", works: "Bremžu disku maiņa" },
    ]);
  });

  it("formatē odometru ar tūkstošu atstarpi", () => {
    expect(formatServiceWorkOdometer("47521")).toBe("47 521 km");
    expect(formatServiceWorkOdometer("")).toBe("");
  });

  it("saglabājas caur mergeSourceBlocksWithDefaults", () => {
    const merged = mergeSourceBlocksWithDefaults({
      auto_records: {
        serviceHistory: [],
        serviceWorks: [
          { date: "12.2023", odometer: "47521", location: "BMW Bonn", works: "Eļļas maiņa" },
        ],
      },
    });
    expect(merged.auto_records.serviceWorks).toEqual([
      { date: "01.12.2023", odometer: "47521", location: "BMW Bonn", works: "Eļļas maiņa" },
    ]);
  });

  it("Copilot upsert_service_work → tabula ar vietas kolonnu", () => {
    const payload = parseCopilotGeminiPayload(
      JSON.stringify({
        reply: "ok",
        actions: [
          {
            type: "upsert_service_work",
            source: "auto_records",
            date: "12.2023",
            odometer: "47 521",
            location: "Niederlassung Bonn BMW AG, Bonn",
            works: "Regulārā apkope: eļļas maiņa",
            confidence: "high",
          },
        ],
      }),
    );
    const result = applyCopilotActions(createDefaultSourceBlocks(), payload.actions, {
      onlyAuto: true,
    });
    expect(result.sourceBlocks.auto_records.serviceWorks).toEqual([
      {
        date: "01.12.2023",
        odometer: "47521",
        location: "Niederlassung Bonn BMW AG, Bonn",
        works: "Regulārā apkope: eļļas maiņa",
      },
    ]);
    expect(autoRecordsServiceWorkRowsToPlainText(result.sourceBlocks.auto_records.serviceWorks)).toBe(
      "01.12.2023 | 47 521 km | Regulārā apkope: eļļas maiņa | Vieta: Niederlassung Bonn BMW AG, Bonn",
    );
  });

  it("Copilot rindu bez darbiem atmet", () => {
    const payload = parseCopilotGeminiPayload(
      JSON.stringify({
        reply: "ok",
        actions: [
          {
            type: "upsert_service_work",
            source: "auto_records",
            date: "01.12.2023",
            odometer: "47521",
            location: "BMW Bonn",
            works: "",
            confidence: "high",
          },
        ],
      }),
    );
    expect(payload.actions).toHaveLength(0);
  });
});
