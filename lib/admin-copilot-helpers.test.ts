import { describe, expect, it } from "vitest";

import {
  appendCopilotActionsToContent,
  buildSourceDisabledNotice,
  COPILOT_HISTORY_ACTIONS_MARKER,
  formatCopilotActionsForHistory,
  prioritizeCopilotAuditContext,
  redactCopilotFeedbackText,
  sanitizeCopilotFeedbackInput,
  truncateCopilotHistoryContent,
} from "@/lib/admin-copilot-helpers";
import { parseCopilotAiPayload } from "@/lib/admin-copilot-parse";
import type { CopilotAction } from "@/lib/admin-copilot-types";

const mileage: CopilotAction = {
  type: "upsert_mileage",
  source: "autodna",
  date: "12.03.2020",
  odometer: "123456",
  country: "Vācija",
  confidence: "high",
};
const incident: CopilotAction = {
  type: "upsert_incident",
  source: "carvertical",
  date: "01.05.2019",
  lossAmount: "1200 EUR",
  country: "Polija",
  confidence: "medium",
};

describe("Copilot vēstures darbību kopsavilkums", () => {
  it("ietver tipu, avotu un galvenos laukus, atdala ierakstīto no piedāvātā", () => {
    const block = formatCopilotActionsForHistory({ applied: [mileage], proposed: [incident] });
    expect(block.startsWith(COPILOT_HISTORY_ACTIONS_MARKER)).toBe(true);
    expect(block).toContain("ierakstīts:\n- upsert_mileage | autodna | 12.03.2020 | 123456 km | Vācija");
    expect(block).toContain("piedāvāts, nav ierakstīts");
    expect(block).toContain("upsert_incident | carvertical | 01.05.2019 | 1200 EUR | Polija");
  });

  it("bez darbībām neko nepievieno un nepievieno divreiz", () => {
    expect(appendCopilotActionsToContent("Gatavs.", {})).toBe("Gatavs.");
    const once = appendCopilotActionsToContent("Gatavs.", { proposed: [mileage] });
    expect(appendCopilotActionsToContent(once, { proposed: [mileage] })).toBe(once);
  });

  it("saīsinot garu ziņu, darbību bloks paliek", () => {
    const content = appendCopilotActionsToContent("x".repeat(10_000), { applied: [mileage] });
    const out = truncateCopilotHistoryContent(content, 2_500);
    expect(out.length).toBeLessThanOrEqual(2_600);
    expect(out).toContain("upsert_mileage | autodna | 12.03.2020");
  });
});

describe("buildSourceDisabledNotice", () => {
  it("skaidri latviski nosauc izslēgto avotu", () => {
    const label = (k: string) => ({ autodna: "AutoDNA", ltab: "LTAB" })[k] ?? k;
    expect(buildSourceDisabledNotice(["autodna", "autodna"], label)).toBe(
      "Avots AutoDNA izslēgts - ieslēdz ķeksīti un sūti vēlreiz.",
    );
    expect(buildSourceDisabledNotice(["autodna", "ltab"], label)).toContain("Avoti AutoDNA, LTAB izslēgti");
    expect(buildSourceDisabledNotice([], label)).toBe("");
  });
});

describe("prioritizeCopilotAuditContext", () => {
  const ctx = [
    "### Pasūtījums\nVIN: WBA5R1C0XLFH42873",
    `### AutoDNA\n${"a".repeat(3_000)}`,
    `### Vendor raw logs\n${"r".repeat(5_000)}`,
    "### Apvienotais nobraukums (visi avoti)\n12.03.2020 123456 km",
    "### Audita piezīmes un melnraksti\n### 3. Kopsavilkums (melnraksts)\nTeksts",
  ].join("\n\n");

  it("īsu kontekstu atstāj kā ir", () => {
    expect(prioritizeCopilotAuditContext(ctx, 100_000)).toBe(ctx.trim());
  });

  it("griestos svarīgākais ir pirmais, RAW žurnāls pēdējais", () => {
    const out = prioritizeCopilotAuditContext(ctx, 4_000);
    expect(out.length).toBeLessThanOrEqual(4_200);
    expect(out.indexOf("### Pasūtījums")).toBe(0);
    expect(out.indexOf("Apvienotais nobraukums")).toBeLessThan(out.indexOf("### AutoDNA"));
    expect(out).toContain("Kopsavilkums (melnraksts)");
    // RAW žurnāls ir pēdējais un nogriezts, nevis izspiež svarīgāko.
    expect(out.indexOf("### Vendor raw logs")).toBeGreaterThan(out.indexOf("### AutoDNA"));
    expect(out.endsWith("…")).toBe(true);
  });

  it("ja sadaļa vairs neietilpst, beigās to nosauc", () => {
    const out = prioritizeCopilotAuditContext(ctx, 3_200);
    expect(out).toContain("Neietilpa kontekstā: Vendor raw logs");
    expect(out).toContain("Apvienotais nobraukums");
  });
});

describe("Copilot atgriezeniskā saite bez personas datiem", () => {
  it("noņem e-pastus, telefonus, personas kodus un vārdus", () => {
    const out = redactCopilotFeedbackText(
      "Klients Jānis Bērziņš, janis@example.com, +371 29 123 456, 010190-12345: izdzēs nobraukumu",
    );
    expect(out).not.toMatch(/Jānis|Bērziņš|example\.com|29 123 456|010190/);
    expect(out).toContain("izdzēs nobraukumu");
  });

  it("validē vērtējumu un darbību tipus", () => {
    expect(sanitizeCopilotFeedbackInput({ rating: "meh" }, { sessionHash: "h" })).toBeNull();
    const entry = sanitizeCopilotFeedbackInput(
      { rating: "down", command: "aizpildi", actionTypes: ["upsert_mileage", "upsert_mileage", "<script>"], error: "" },
      { sessionHash: "abc", now: new Date("2026-11-27T10:00:00Z") },
    );
    expect(entry).toEqual({
      rating: "down",
      command: "aizpildi",
      actionTypes: ["upsert_mileage"],
      error: "",
      sessionHash: "abc",
      at: "2026-11-27T10:00:00.000Z",
    });
  });
});

describe("parseCopilotAiPayload - upsert_vehicle_history_timeline_row", () => {
  it("pieņem rindu tikai autodna / carvertical / carfax ar datumu un aprakstu", () => {
    const out = parseCopilotAiPayload(
      JSON.stringify({
        reply: "ok",
        clarificationNeeded: "",
        actions: [
          {
            type: "upsert_vehicle_history_timeline_row",
            source: "carvertical",
            date: "03.2021",
            description: "Sludinājums pārdošanai Vācijā",
            country: "Vācija",
            odometer: "98000",
            confidence: "high",
          },
          { type: "upsert_vehicle_history_timeline_row", source: "ltab", date: "03.2021", description: "x", confidence: "high" },
          { type: "upsert_vehicle_history_timeline_row", source: "autodna", date: "03.2021", description: "", confidence: "high" },
        ],
      }),
    );
    expect(out.actions).toEqual([
      {
        type: "upsert_vehicle_history_timeline_row",
        source: "carvertical",
        date: "03.2021",
        description: "Sludinājums pārdošanai Vācijā",
        country: "Vācija",
        odometer: "98000",
        confidence: "high",
      },
    ]);
  });
});
