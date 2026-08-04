import { describe, expect, it } from "vitest";
import { applyCopilotActions, buildCopilotBlocksSummary } from "@/lib/admin-copilot-apply";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import type { CopilotAction } from "@/lib/admin-copilot-types";
import { parseCopilotGeminiPayload } from "@/lib/admin-copilot-parse";

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
});

describe("buildCopilotBlocksSummary", () => {
  it("mentions empty sources", () => {
    const s = buildCopilotBlocksSummary(createDefaultSourceBlocks());
    expect(s).toContain("autodna");
    expect(s).toContain("empty");
  });
});

describe("parseCopilotGeminiPayload", () => {
  it("parses actions", () => {
    const r = parseCopilotGeminiPayload(
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
        ],
      }),
    );
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]?.type).toBe("upsert_incident");
  });
});
