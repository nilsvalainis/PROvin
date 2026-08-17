import { describe, expect, it } from "vitest";
import { applyCopilotActions, buildCopilotBlocksSummary } from "@/lib/admin-copilot-apply";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import type { CopilotAction } from "@/lib/admin-copilot-types";
import { parseCopilotAiPayload } from "@/lib/admin-copilot-parse";

describe("applyCopilotActions", () => {
  it("auto-applies high-confidence AutoDNA incident", () => {
    const blocks = createDefaultSourceBlocks();
    const actions: CopilotAction[] = [
      {
        type: "upsert_incident",
        source: "autodna",
        date: "2020-11-17",
        lossAmount: "5000 eiro",
        country: "Vācija",
        confidence: "high",
      },
    ];
    const result = applyCopilotActions(blocks, actions, { onlyAuto: true });
    expect(result.applied).toHaveLength(1);
    expect(result.changedKeys).toContain("autodna");
    const row = result.sourceBlocks.autodna.incidents.find((r) => r.lossAmount.includes("5") || r.lossAmount.includes("5000"));
    expect(row?.csngDate).toMatch(/17\.11\.2020|2020/);
    expect(row?.lossAmount).toMatch(/5\s*000|5000/);
  });

  it("fills car.info registry tables from Copilot actions", () => {
    const blocks = createDefaultSourceBlocks();
    const result = applyCopilotActions(
      blocks,
      [
        {
          type: "upsert_mileage",
          source: "carinfo",
          date: "2023-06-09",
          odometer: "298540",
          country: "Zviedrija",
          confidence: "high",
          note: "car.info · Subsequent inspection",
        },
        {
          type: "set_registry_fields",
          source: "carinfo",
          ownersSummary: "Īpašnieku skaits: 6",
          statusRecords: "Satiksmē: nē\n2023-10-11: eksportēts no Zviedrijas",
          autoNotes: "⚠ RED FLAG: auto iepriekš eksportēts no Zviedrijas (2023-10-11).",
          confidence: "high",
        },
      ],
      { onlyAuto: true },
    );
    expect(result.changedKeys).toContain("carinfo");
    expect(result.sourceBlocks.carinfo.mileage.some((r) => r.odometer === "298540")).toBe(true);
    expect(result.sourceBlocks.carinfo.ownersSummary).toMatch(/6/);
    expect(result.sourceBlocks.carinfo.autoNotes).toMatch(/RED FLAG/);
  });

  it("skips medium confidence when onlyAuto", () => {
    const blocks = createDefaultSourceBlocks();
    const actions: CopilotAction[] = [
      {
        type: "upsert_mileage",
        source: "citi_avoti",
        date: "26.06.2023",
        odometer: "478760",
        country: "Latvija",
        confidence: "medium",
      },
    ];
    const result = applyCopilotActions(blocks, actions, { onlyAuto: true });
    expect(result.applied).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe("needs_confirm");
  });

  it("applies mileage on confirm", () => {
    const blocks = createDefaultSourceBlocks();
    const actions: CopilotAction[] = [
      {
        type: "upsert_mileage",
        source: "carvertical",
        date: "15.06.2020",
        odometer: "317900",
        country: "LV",
        confidence: "medium",
      },
    ];
    const result = applyCopilotActions(blocks, actions, { onlyAuto: false });
    expect(result.applied).toHaveLength(1);
    expect(result.sourceBlocks.carvertical.serviceHistory.some((r) => r.odometer.includes("317900") || r.odometer === "317900")).toBe(
      true,
    );
  });

  it("rejects incident on auto_records", () => {
    const blocks = createDefaultSourceBlocks();
    const actions: CopilotAction[] = [
      {
        type: "upsert_incident",
        source: "auto_records",
        date: "01.01.2020",
        lossAmount: "1000",
        country: "LV",
        confidence: "high",
      },
    ];
    const result = applyCopilotActions(blocks, actions, { onlyAuto: false });
    expect(result.skipped[0]?.reason).toBe("auto_records_has_no_incidents");
  });

  it("sets Servisa vēsture on auto_records", () => {
    const blocks = createDefaultSourceBlocks();
    const actions: CopilotAction[] = [
      {
        type: "set_service_history",
        source: "auto_records",
        text: "12.03.2019 | 87450 km | Eļļas maiņa\n01.06.2020 | 102300 km | Bremžu kluči",
        confidence: "high",
      },
    ];
    const result = applyCopilotActions(blocks, actions, { onlyAuto: true });
    expect(result.applied).toHaveLength(1);
    expect(result.sourceBlocks.auto_records.serviceHistoryNotes).toContain("Eļļas maiņa");
    expect(result.sourceBlocks.auto_records.serviceHistoryNotes).toContain("102300");
  });

  it("appends significant facts to source RAW", () => {
    const blocks = createDefaultSourceBlocks();
    const actions: CopilotAction[] = [
      {
        type: "append_raw",
        source: "autodna",
        text: "Type code: 8V\nTaxi: nē",
        confidence: "high",
      },
    ];
    const result = applyCopilotActions(blocks, actions, { onlyAuto: true });
    expect(result.applied).toHaveLength(1);
    expect(result.sourceBlocks.autodna.aiContextRaw).toContain("Type code: 8V");
  });
});

describe("buildCopilotBlocksSummary", () => {
  it("mentions empty sources", () => {
    const s = buildCopilotBlocksSummary(createDefaultSourceBlocks());
    expect(s).toContain("autodna");
    expect(s).toContain("empty");
  });

  it("includes CSDD country timeline fields", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd.previousRegistrationCountry = "Vācija";
    blocks.csdd.firstRegistration = "15.03.2018";
    const s = buildCopilotBlocksSummary(blocks);
    expect(s).toContain("Iepriekšējās reģistrācijas valsts");
    expect(s).toContain("Vācija");
    expect(s).toContain("COUNTRY HINT");
  });
});

describe("enrichCopilotActionCountries / apply country cross-fill", () => {
  it("fills empty incident country from another source with same date+loss", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.incidents = [
      { csngDate: "17.11.2020", lossAmount: "5 000 €", incidentNo: "Vācija" },
    ];
    const actions: CopilotAction[] = [
      {
        type: "upsert_incident",
        source: "carvertical",
        date: "17.11.2020",
        lossAmount: "5000 eiro",
        country: "",
        confidence: "high",
      },
    ];
    const result = applyCopilotActions(blocks, actions, { onlyAuto: true });
    expect(result.applied).toHaveLength(1);
    const row = result.sourceBlocks.carvertical.incidents.find((r) => r.csngDate.includes("17.11.2020"));
    expect(row?.incidentNo).toBe("Vācija");
  });

  it("fills empty mileage country from sibling action in the same batch", () => {
    const blocks = createDefaultSourceBlocks();
    const actions: CopilotAction[] = [
      {
        type: "upsert_mileage",
        source: "autodna",
        date: "01.06.2020",
        odometer: "120000",
        country: "Vācija",
        confidence: "high",
      },
      {
        type: "upsert_mileage",
        source: "carvertical",
        date: "01.06.2020",
        odometer: "120000",
        country: "",
        confidence: "high",
      },
    ];
    const result = applyCopilotActions(blocks, actions, { onlyAuto: true });
    expect(result.applied).toHaveLength(2);
    const cv = result.sourceBlocks.carvertical.serviceHistory.find((r) => r.odometer === "120000");
    expect(cv?.country).toBe("Vācija");
  });

  it("leaves country empty when sources disagree", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna.incidents = [
      { csngDate: "01.02.2021", lossAmount: "1 200 €", incidentNo: "Vācija" },
    ];
    blocks.ltab.rows = [{ csngDate: "01.02.2021", lossAmount: "1 200 €", incidentNo: "Latvija" }];
    const actions: CopilotAction[] = [
      {
        type: "upsert_incident",
        source: "carvertical",
        date: "01.02.2021",
        lossAmount: "1200 €",
        country: "",
        confidence: "high",
      },
    ];
    const result = applyCopilotActions(blocks, actions, { onlyAuto: true });
    const row = result.sourceBlocks.carvertical.incidents.find((r) => r.csngDate.includes("01.02.2021"));
    expect(row?.incidentNo ?? "").toBe("");
  });
});

describe("parseCopilotAiPayload", () => {
  it("parses actions", () => {
    const r = parseCopilotAiPayload(
      JSON.stringify({
        reply: "Pievienoju.",
        clarificationNeeded: "",
        actions: [
          {
            type: "upsert_incident",
            source: "ltab",
            date: "01.02.2021",
            lossAmount: "1200 €",
            country: "Latvija",
            confidence: "high",
          },
          {
            type: "set_service_history",
            source: "autodna",
            text: "01.01.2020 | 10000 km | Apkope",
            confidence: "high",
          },
          {
            type: "append_raw",
            source: "carvertical",
            text: "Stolen check: clear",
            confidence: "medium",
          },
        ],
      }),
    );
    expect(r.actions).toHaveLength(3);
    expect(r.actions[0]?.type).toBe("upsert_incident");
    expect(r.actions[1]?.type).toBe("set_service_history");
    if (r.actions[1]?.type === "set_service_history") {
      expect(r.actions[1].source).toBe("auto_records");
    }
    expect(r.actions[2]?.type).toBe("append_raw");
  });

  it("parses VIN registry fields for car.info", () => {
    const r = parseCopilotAiPayload(
      JSON.stringify({
        reply: "car.info ielasīts.",
        clarificationNeeded: "",
        actions: [
          {
            type: "upsert_mileage",
            source: "carinfo",
            date: "2023-06-09",
            odometer: "298540",
            country: "Zviedrija",
            confidence: "high",
            note: "car.info · Subsequent inspection",
          },
          {
            type: "set_registry_fields",
            source: "carinfo",
            ownersSummary: "Īpašnieku skaits: 6",
            statusRecords: "Satiksmē: nē",
            autoNotes: "⚠ RED FLAG: auto iepriekš eksportēts no Zviedrijas (2023-10-11).",
            confidence: "high",
          },
        ],
      }),
    );
    expect(r.actions).toHaveLength(2);
    expect(r.actions[1]?.type).toBe("set_registry_fields");
  });
});
