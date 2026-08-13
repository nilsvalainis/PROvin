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
  it("normalizē datumu, odometru un darbus", () => {
    const rows = normalizeAutoRecordsServiceWorkRows([
      { date: "12.2023", odometer: "47 521 km", works: "  Regulārā apkope:  eļļas maiņa " },
      { date: "", odometer: "", works: "" },
    ]);
    expect(rows).toEqual([
      { date: "01.12.2023", odometer: "47521", works: "Regulārā apkope: eļļas maiņa" },
    ]);
  });

  it("tukšai vērtībai atgriež vienu tukšu ievades rindu", () => {
    expect(normalizeAutoRecordsServiceWorkRows(undefined)).toEqual([
      { date: "", odometer: "", works: "" },
    ]);
  });

  it("kārto jaunāko augšā un aizpilda tukšo slotu", () => {
    let rows = [{ date: "", odometer: "", works: "" }];
    rows = mergeAutoRecordsServiceWorkRow(rows, {
      date: "01.06.2023",
      odometer: "26276",
      works: "Eļļas maiņa",
    });
    rows = mergeAutoRecordsServiceWorkRow(rows, {
      date: "12.2023",
      odometer: "47 521",
      works: "Bremžu šķidruma maiņa",
    });
    expect(rows.map((r) => r.date)).toEqual(["01.12.2023", "01.06.2023"]);
  });

  it("neaizvieto operatora labotu rindu ar to pašu datumu un odometru", () => {
    const rows = mergeAutoRecordsServiceWorkRow(
      [{ date: "01.12.2023", odometer: "47521", works: "Operatora teksts" }],
      { date: "01.12.2023", odometer: "47521", works: "Regulārā apkope: eļļas maiņa" },
    );
    expect(rows).toEqual([{ date: "01.12.2023", odometer: "47521", works: "Operatora teksts" }]);
  });

  it("pārnes teksta rindas uz tabulu", () => {
    const rows = parseAutoRecordsServiceWorkLines(
      [
        "01.12.2023 | 47 521 km | Regulārā apkope: eļļas maiņa",
        "06.2023 | 26 276 km | Eļļas maiņa",
        "Nav servisa rinda",
      ].join("\n"),
    );
    expect(rows).toEqual([
      { date: "01.12.2023", odometer: "47521", works: "Regulārā apkope: eļļas maiņa" },
      { date: "01.06.2023", odometer: "26276", works: "Eļļas maiņa" },
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
      { date: "01.02.2026", odometer: "278484", works: "Veikta regulārā apkope, eļļas maiņa" },
      { date: "01.08.2025", odometer: "265100", works: "Bremžu disku maiņa" },
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
        serviceWorks: [{ date: "12.2023", odometer: "47521", works: "Eļļas maiņa" }],
      },
    });
    expect(merged.auto_records.serviceWorks).toEqual([
      { date: "01.12.2023", odometer: "47521", works: "Eļļas maiņa" },
    ]);
  });

  it("Copilot upsert_service_work → tabula", () => {
    const payload = parseCopilotGeminiPayload(
      JSON.stringify({
        reply: "ok",
        actions: [
          {
            type: "upsert_service_work",
            source: "auto_records",
            date: "12.2023",
            odometer: "47 521",
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
      { date: "01.12.2023", odometer: "47521", works: "Regulārā apkope: eļļas maiņa" },
    ]);
    expect(autoRecordsServiceWorkRowsToPlainText(result.sourceBlocks.auto_records.serviceWorks)).toBe(
      "01.12.2023 | 47 521 km | Regulārā apkope: eļļas maiņa",
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
            works: "",
            confidence: "high",
          },
        ],
      }),
    );
    expect(payload.actions).toHaveLength(0);
  });
});
