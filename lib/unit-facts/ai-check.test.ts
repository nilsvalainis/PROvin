import { describe, expect, it } from "vitest";
import { parseAiFactCheck } from "@/lib/unit-facts/ai-check";
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
});
