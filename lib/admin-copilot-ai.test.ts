import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin-ai", () => ({
  CLAUDE_MODEL_EXTRACT: "claude-sonnet-test",
  aiGenerateJsonWithSchema: vi.fn(),
}));

vi.mock("@/lib/admin-copilot-apply", () => ({
  buildCopilotBlocksSummary: vi.fn(() => ""),
}));

const finalizeGeneratedComment = vi.fn(async (text: string) => (text.trim() ? `LV:${text}` : text));

vi.mock("@/lib/admin-ai-polish", () => ({
  finalizeGeneratedComment: (text: string) => finalizeGeneratedComment(text),
}));

import {
  ADMIN_COPILOT_RESPONSE_SCHEMA,
  ADMIN_COPILOT_SYSTEM,
  COPILOT_AUDIT_CONTEXT_MAX_CHARS,
  finalizeCopilotAiResponse,
} from "@/lib/admin-copilot-ai";

describe("ADMIN_COPILOT schema un prompts", () => {
  it("shēmā ir upsert_vehicle_history_timeline_row ar description lauku", () => {
    const items = (ADMIN_COPILOT_RESPONSE_SCHEMA.properties as Record<string, { items?: { properties?: Record<string, { enum?: string[] }> } }>)
      .actions.items!.properties!;
    expect(items.type.enum).toContain("upsert_vehicle_history_timeline_row");
    expect(items.description).toBeDefined();
  });

  it("prompts atļauj atbildes bez darbībām un satur PROVIN likumus", () => {
    expect(ADMIN_COPILOT_SYSTEM).toMatch(/QUESTIONS WITHOUT ACTIONS/);
    expect(ADMIN_COPILOT_SYSTEM).toMatch(/kas trūkst\?/);
    expect(ADMIN_COPILOT_SYSTEM).toMatch(/pirkt” \/ „nepirkt/);
    expect(ADMIN_COPILOT_SYSTEM).toMatch(/nenozīmē, ka maiņa nav veikta/);
    expect(ADMIN_COPILOT_SYSTEM).toMatch(/pozīcija nav darbība/);
    expect(ADMIN_COPILOT_SYSTEM).toMatch(/eksperts/);
    expect(ADMIN_COPILOT_SYSTEM).toMatch(/ALWAYS in Latvian/);
  });

  it("audita konteksta griesti vairs nav 24 000", () => {
    expect(COPILOT_AUDIT_CONTEXT_MAX_CHARS).toBeGreaterThanOrEqual(80_000);
  });
});

describe("finalizeCopilotAiResponse", () => {
  it("reviews operator Latvian prose and leaves structured actions untouched", async () => {
    const parsed = {
      reply: "Ielasīti 3 nobraukuma ieraksti.",
      clarificationNeeded: "Kurš avots?",
      actions: [
        {
          type: "upsert_mileage" as const,
          source: "autodna" as const,
          date: "01.02.2024",
          odometer: "120000",
          country: "Vācija",
          confidence: "high" as const,
        },
      ],
    };
    const out = await finalizeCopilotAiResponse(parsed);
    expect(out.reply).toBe("LV:Ielasīti 3 nobraukuma ieraksti.");
    expect(out.clarificationNeeded).toBe("LV:Kurš avots?");
    expect(out.actions).toEqual(parsed.actions);
    expect(finalizeGeneratedComment).toHaveBeenCalledTimes(2);
  });
});

import { buildCopilotContextText } from "@/lib/admin-copilot-ai";

describe("buildCopilotContextText", () => {
  it("«atcel to, ko tikko ieliki»: vēsturē redzams darbību bloks", () => {
    const out = buildCopilotContextText({
      sourceBlocks: {} as never,
      history: [
        { role: "user", content: "ieliec nobraukumu" },
        { role: "assistant", content: "Gatavs.\n\n[Copilot darbības:\nierakstīts:\n- upsert_mileage | autodna | 12.03.2020 | 123456 km]" },
      ],
      pdfNames: [],
      photoNames: [],
    });
    expect(out).toContain("upsert_mileage | autodna | 12.03.2020");
    expect(out).toContain("atcel / izdzēs to, ko tikko ieliki");
  });
});
