import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const calls: Array<{ fn: string; tier: unknown; prompt: string }> = [];
const MAP_JSON = JSON.stringify({
  identification: {
    platform: { value: "F11", confidence: "A", evidence: "VIN", candidates: [] },
    engine: { value: "N57D30", confidence: "A", evidence: "VIN", candidates: [] },
    gearbox: { value: "ZF 8HP", confidence: "B", evidence: "gads", candidates: [] },
  },
  risks: [
    {
      component: "klaņu gultņi",
      failure_mode: "noberze",
      typical_km_range: [200000, 300000],
      this_car_position: "iekšā",
      already_done_evidence: null,
      probability: "medium",
      impact: "high",
      priority: 1,
      applies_to_this_car: true,
      confidence: "high",
      sources: [{ type: "kb", ref: "KB:N57D30", accessed: "2026-10-17" }],
      cost_band_eur: null,
      inspection_hint: "eļļas spiediens",
    },
  ],
  damage_interpretation: [],
  recalls: [{ id_or_title: "nav atrasts", source: "KBA", status_known: false }],
  strengths: [],
  unknowns: [],
});

vi.mock("@/lib/admin-ai-dispatch", () => ({
  adminGenerateRawTextWithWebSearch: vi.fn(async (o: { modelTier: unknown; userPrompt: string }) => {
    calls.push({ fn: "map", tier: o.modelTier, prompt: o.userPrompt });
    return MAP_JSON;
  }),
  adminGenerateTextWithWebSearch: vi.fn(async (o: { modelTier: unknown; userPrompt: string }) => {
    calls.push({ fn: "v1", tier: o.modelTier, prompt: o.userPrompt });
    return "V1";
  }),
  adminGenerateExpertText: vi.fn(async (o: { modelTier: unknown; userPrompt: string; systemInstruction: string }) => {
    const qa = o.userPrompt.startsWith("RISKA KARTE:");
    calls.push({ fn: qa ? "qa" : "text", tier: o.modelTier, prompt: o.userPrompt });
    return qa
      ? JSON.stringify({ flagged: [], rewritten_text: "" })
      : "Tehnisko risku analīze\nKlaņu gultņi\nN57D30 šajā nobraukumā ieteicams pārbaudīt eļļas spiedienu un klausīties dzinēju.";
  }),
}));

vi.mock("@/lib/admin-ai-order-context", () => ({
  buildFullAiOrderContextText: vi.fn(async () => "PILNS KONTEKSTS ".repeat(50)),
  buildAiCommentGenerationContext: vi.fn(async () => "PILNS KONTEKSTS ".repeat(50)),
}));

async function run(modelTier: string, operatorNotes = "") {
  const { generateTechnicalRiskAnalysisWithAi } = await import("@/lib/admin-ai-technical-risks");
  return generateTechnicalRiskAnalysisWithAi({
    sessionId: "t",
    vin: "WBAMX31050C524401",
    listingUrl: null,
    customerName: null,
    notes: null,
    sourceBlocks: {} as never,
    modelTier: modelTier as never,
    operatorNotes,
  } as never);
}

describe("tech risk v2: Gemini-only pipeline", () => {
  beforeEach(() => {
    calls.length = 0;
    process.env.TECH_RISK_V2 = "1";
  });
  afterEach(() => {
    delete process.env.TECH_RISK_V2;
  });

  it("uses the selected Gemini tier for map, text and QA; no Claude call", async () => {
    const r = await run("gemini-flash");
    expect(r.technicalRiskMap?.risks.length).toBe(1);
    expect(r.text).not.toMatch(/^Tehnisko risku analīze/m);
    expect(r.text).toMatch(/^Klaņu gultņi/m);
    expect(calls.map((c) => c.fn)).toEqual(["map", "text", "qa"]);
    expect(calls.every((c) => c.tier === "gemini-flash")).toBe(true);
  });

  it("text step gets map + source facts, not the full order context", async () => {
    await run("gemini");
    const text = calls.find((c) => c.fn === "text");
    expect(text?.prompt).toContain("RISKA KARTE");
    expect(text?.prompt).not.toContain("PILNS KONTEKSTS");
    expect(calls.find((c) => c.fn === "map")?.prompt).toContain("PILNS KONTEKSTS");
  });

  it("Claude tier without a component command never calls Claude", async () => {
    await run("flash");
    expect(calls.map((c) => c.fn)).toEqual(["map", "text", "qa"]);
    expect(calls.every((c) => c.tier === "gemini-flash")).toBe(true);
  });

  it("Claude tier + `Claude: …` adds one Claude call only for those components", async () => {
    await run("flash", "Claude: klaņu gultņi");
    const claude = calls.filter((c) => c.tier === "flash");
    expect(claude).toHaveLength(1);
    expect(claude[0]?.fn).toBe("map");
    expect(claude[0]?.prompt).toContain("TIKAI šie agregāti: klaņu gultņi");
    expect(calls.filter((c) => c.fn !== "map").every((c) => c.tier === "gemini-flash")).toBe(true);
  });

  it("AVOTU FAKTI un dīlera brīfs tekstā ir latviski, EN darbus nekopē", async () => {
    const { createDefaultSourceBlocks, emptyAutoRecordsBlock } = await import("@/lib/admin-source-blocks");
    const { emptyOneautoIngest } = await import("@/lib/oneauto-to-auto-records");
    const { generateTechnicalRiskAnalysisWithAi } = await import("@/lib/admin-ai-technical-risks");
    const blocks = createDefaultSourceBlocks();
    blocks.auto_records = emptyAutoRecordsBlock();
    blocks.auto_records.serviceWorks = [
      { date: "01.06.2023", odometer: "88000", location: "Volvo", works: "Pneimatiskā atspere aizmugurē" },
    ];
    blocks.auto_records.oneautoIngest = {
      ...emptyOneautoIngest(),
      serviceTimelineOriginal: [
        { date: "01.06.2023", odometer: "88000", place: "Volvo", works: "Pneumatic spring, rear" },
      ],
    };
    blocks.auto_records.comments = "Serviss: Pneumatic spring, rear";
    await generateTechnicalRiskAnalysisWithAi({
      sessionId: "t",
      vin: "YV1TEST",
      listingUrl: null,
      customerName: null,
      notes: null,
      sourceBlocks: blocks,
      modelTier: "gemini" as never,
    } as never);
    const text = calls.find((c) => c.fn === "text")?.prompt ?? "";
    expect(text).toContain("AVOTU FAKTI");
    expect(text).toContain("Pneimatiskā atspere aizmugurē");
    expect(text).not.toMatch(/Pneumatic spring, rear/i);
    expect(calls.find((c) => c.fn === "map")?.prompt ?? "").not.toMatch(/Pneumatic spring, rear/i);
  });
});
