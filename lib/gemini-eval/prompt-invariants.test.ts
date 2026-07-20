import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROVIN_GEMINI_PROMPT_VERSION } from "@/lib/gemini-prompt-version";
import {
  GEMINI_DAMAGE_CLAIM_CONTEXT_RULES,
  HYBRID_COMMENT_RULES,
  PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES,
  PROVIN_REPORT_COPY_VOCABULARY,
} from "@/lib/source-summary-comment-format";

const root = process.cwd();

function readRepo(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("PROVIN Gemini prompt invariants", () => {
  it("has a non-empty prompt version tag", () => {
    expect(PROVIN_GEMINI_PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it("vocabulary forbids automobīlis", () => {
    expect(PROVIN_REPORT_COPY_VOCABULARY).toMatch(/NEVER "automobīlis"/i);
  });

  it("damage claim rules require contextual EUR interpretation", () => {
    expect(GEMINI_DAMAGE_CLAIM_CONTEXT_RULES).toMatch(/age at incident/i);
    expect(GEMINI_DAMAGE_CLAIM_CONTEXT_RULES).toMatch(/premium/i);
    expect(GEMINI_DAMAGE_CLAIM_CONTEXT_RULES).toMatch(/NEVER treat an insurance payout/i);
  });

  it("hybrid rules keep anti-repetition + claim context", () => {
    expect(HYBRID_COMMENT_RULES).toContain("ANTI-REPETITION");
    expect(HYBRID_COMMENT_RULES).toContain("NOBRAUKUMA VĒSTURES KOMENTĀRS");
    expect(HYBRID_COMMENT_RULES).toContain("DAMAGE & CLAIM AMOUNT CONTEXT");
  });

  it("few-shots include claim-context and mileage-only synthesis examples", () => {
    expect(PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES).toMatch(/Zaudējumu apjoms kontekstā/i);
    expect(PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES).toMatch(
      /NOBRAUKUMA VĒSTURES KOMENTĀRS — vienīgā vieta/i,
    );
  });

  it("field-agent prompts file encodes field division and claim context", () => {
    const prompts = readRepo("lib/admin-gemini-prompts.ts");
    expect(prompts).toContain("FIELD DIVISION & ANTI-REPETITION");
    expect(prompts).toContain("GEMINI_DAMAGE_CLAIM_CONTEXT_RULES");
    expect(prompts).toContain("PROVIN_GEMINI_PROMPT_VERSION");
    expect(prompts).toMatch(/NOBRAUKUMA VĒSTURES KOMENTĀRS/);
  });

  it("polish uses Flash model", () => {
    const polish = readRepo("lib/admin-gemini-polish.ts");
    expect(polish).toMatch(/GEMINI_MODEL_FLASH/);
    expect(polish).not.toMatch(/model:\s*GEMINI_MODEL_PRO/);
  });

  it("prepare-draft parallelizes source comments", () => {
    const prep = readRepo("lib/admin-prepare-draft.ts");
    expect(prep).toMatch(/Promise\.all/);
    expect(prep).toMatch(/modelTier/);
  });
});
