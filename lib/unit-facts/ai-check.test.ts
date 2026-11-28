import { describe, expect, it } from "vitest";
import { buildUnitFactAiPrompt, CANONICAL_AI_FACT_ID, parseAiFactCheck } from "@/lib/unit-facts/ai-check";
import { UNIT_FACTS } from "@/lib/unit-facts/facts";

describe("parseAiFactCheck", () => {
  const text = "Kārba ir ZF ražojums. Viss pārējais kārtībā.";
  it("keeps only real sentences and known facts", () => {
    const flags = parseAiFactCheck(
      {
        contradictions: [
          { fact_id: "audi_q7_4l_gearbox_aisin", sentence: "Kārba ir ZF ražojums.", why: "Q7 4L ir Aisin" },
          { fact_id: "audi_q7_4l_gearbox_aisin", sentence: "Izdomāts teikums.", why: "x" },
          { fact_id: "nav_tada", sentence: "Kārba ir ZF ražojums.", why: "x" },
        ],
      },
      text,
      UNIT_FACTS,
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]!.level).toBe("W");
  });
  it("handles garbage", () => {
    expect(parseAiFactCheck(null, text, UNIT_FACTS)).toEqual([]);
    expect(parseAiFactCheck({ contradictions: "x" }, text, UNIT_FACTS)).toEqual([]);
  });
  it("28.11: kanoniskās lapas atradumi tikai ar canonical=true un tikai reāliem teikumiem", () => {
    const raw = {
      contradictions: [
        { fact_id: CANONICAL_AI_FACT_ID, sentence: "Viss pārējais kārtībā.", why: "lapā 3 negadījumi" },
        { fact_id: CANONICAL_AI_FACT_ID, sentence: "Halucinēts.", why: "x" },
      ],
    };
    expect(parseAiFactCheck(raw, text, UNIT_FACTS)).toEqual([]);
    const flags = parseAiFactCheck(raw, text, UNIT_FACTS, { canonical: true });
    expect(flags.map((f) => [f.id, f.level])).toEqual([["ai:canonical", "W"]]);
  });
  it("hipotētisks teikums no AI tiek atmests", () => {
    const t = "Tas nenozīmē, ka eļļas maiņa nav veikta.";
    const flags = parseAiFactCheck(
      { contradictions: [{ fact_id: CANONICAL_AI_FACT_ID, sentence: t, why: "x" }] },
      t,
      UNIT_FACTS,
      { canonical: true },
    );
    expect(flags).toEqual([]);
  });
  it("prompts satur kanonisko lapu", () => {
    const p = buildUnitFactAiPrompt([], "Teksts.", "Īpašnieki: 3");
    expect(p).toContain("KANONISKIE FAKTI [canonical]");
    expect(p).toContain("Īpašnieki: 3");
  });
});
