import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROVIN_GEMINI_PROMPT_VERSION } from "@/lib/gemini-prompt-version";
import {
  GEMINI_DAMAGE_CLAIM_CONTEXT_RULES,
  GEMINI_EV_BEV_FORENSICS_RULES,
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

  it("field-agent prompts encode field division and claim context", () => {
    const prompts = readRepo("lib/admin-gemini-prompts.ts");
    expect(prompts).toContain("FIELD DIVISION & ANTI-REPETITION");
    expect(prompts).toContain("COMPLEMENTARY SOURCES");
    expect(prompts).toContain("STRICT ROLES");
    expect(prompts).toContain("GEMINI_DAMAGE_CLAIM_CONTEXT_RULES");
    expect(prompts).toContain("GEMINI_EV_BEV_FORENSICS_RULES");
    expect(prompts).toContain("GEMINI_AGGREGATE_KNOWLEDGE_RULES");
    expect(prompts).toContain("PROVIN_GEMINI_PROMPT_VERSION");
    expect(prompts).toMatch(/NOBRAUKUMA VĒSTURES KOMENTĀRS/);
    expect(prompts).toContain("GEMINI_CLIENT_PDF_EXPERT_MARKDOWN_RULES");
    expect(prompts).toMatch(/APPROVED BY IRISS/);
  });

  it("inspection and seller prompts use expert markdown, not hyphen checklists", () => {
    const prompts = readRepo("lib/admin-gemini-prompts.ts");
    expect(prompts).toMatch(
      /GEMINI_INSPECTION_RECOMMENDATIONS_SYSTEM[\s\S]*?GEMINI_CLIENT_PDF_EXPERT_MARKDOWN_RULES/,
    );
    expect(prompts).toMatch(
      /GEMINI_SELLER_ANALYSIS_SYSTEM[\s\S]*?GEMINI_CLIENT_PDF_EXPERT_MARKDOWN_RULES/,
    );
    expect(prompts).toMatch(/NEKAD nesāc rindu ar "- "/);
  });

  it("summary prompt demands short opinion not section recapitulation", () => {
    const prompts = readRepo("lib/admin-gemini-prompts.ts");
    expect(prompts).toMatch(/GEMINI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?profesionālo viedokli/i);
    expect(prompts).toMatch(/GEMINI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?NEKĀDĀ GADĪJUMĀ nepārraksti/i);
    expect(prompts).toMatch(/GEMINI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?3–5 īsas rindkopas/);
  });

  it("field-agent prompts encode client value density and institutional memory", () => {
    const prompts = readRepo("lib/admin-gemini-prompts.ts");
    expect(prompts).toMatch(/CLIENT VALUE DENSITY/);
    expect(prompts).toMatch(/institutional memory/i);
    expect(prompts).toMatch(/VISIEM avotu|VISUS avotu/i);
  });

  it("field-agent prompts enforce epistemic hedging for digital-only audits", () => {
    const prompts = readRepo("lib/admin-gemini-prompts.ts");
    expect(prompts).toMatch(/EPISTEMIC HEDGING/);
    expect(prompts).toMatch(/NOT.*physically inspected|fiziski nav apskatījis/i);
    expect(prompts).toMatch(/visticamāk|ļoti iespējams|teorētiski/);
    expect(prompts).toMatch(/tehniski perfekts/);
    const vocab = readRepo("lib/source-summary-comment-format.ts");
    expect(vocab).toMatch(/EPISTEMIC HEDGING/);
  });

  it("summary and inspection prompts require aggregate-specific technical risk analysis", () => {
    const prompts = readRepo("lib/admin-gemini-prompts.ts");
    expect(prompts).toMatch(/TEHNISKO RISKU ANALĪZE|TECHNICAL RISK ANALYSIS/i);
    expect(prompts).toMatch(/OPERATORA KOMANDAS/i);
    expect(prompts).toMatch(/klātienes pārbaudes|Agregātu riski|Tehnisko risku/i);
    expect(prompts).toMatch(/NESĀC ar „Sveiki”|NESĀC ar \"Sveiki\"|Bez „Sveiki”/i);
  });

  it("operator notes are prepended with highest priority", () => {
    const notes = readRepo("lib/admin-gemini-operator-notes.ts");
    expect(notes).toMatch(/AUGSTĀKĀ PRIORITĀTE/);
    expect(notes).toMatch(/NEDRĪKSTI APGRAIZĪT/);
    expect(notes).toMatch(/geminiMaxLenForOperatorNotes/);
    expect(notes).toMatch(/parts\.push\(userPrompt/);
  });

  it("hybrid comment rules waive short length when operator supplies detail", () => {
    expect(HYBRID_COMMENT_RULES).toMatch(/LENGTH OVERRIDE/i);
    expect(HYBRID_COMMENT_RULES).toMatch(/IGNORE the 600–1100/i);
  });

  it("summary generation uses Google Search grounding", () => {
    const summary = readRepo("lib/admin-gemini-summary.ts");
    expect(summary).toMatch(/geminiGenerateTextWithGoogleSearch/);
    expect(summary).toMatch(/Tehnisko risku|NEDUBLĒ|nedublē/i);
    const tech = readRepo("lib/admin-gemini-technical-risks.ts");
    expect(tech).toMatch(/geminiGenerateTextWithGoogleSearch/);
  });

  it("avg annual mileage banner is removed from info banners", () => {
    const banners = readRepo("lib/provin-alert-banners.ts");
    expect(banners).not.toMatch(/avg_annual_mileage/);
    expect(banners).not.toMatch(/computeAverageAnnualMileage/);
    expect(banners).toMatch(/lv_registration_tenure/);
  });

  it("polish uses Flash model", () => {
    const polish = readRepo("lib/admin-gemini-polish.ts");
    expect(polish).toMatch(/GEMINI_MODEL_FLASH/);
    expect(polish).not.toMatch(/model:\s*GEMINI_MODEL_PRO/);
  });

  it("EV forensics rules cover SOH and charging habits", () => {
    expect(GEMINI_EV_BEV_FORENSICS_RULES).toMatch(/SOH/i);
    expect(GEMINI_EV_BEV_FORENSICS_RULES).toMatch(/20.?80/i);
    expect(GEMINI_EV_BEV_FORENSICS_RULES).toMatch(/DC|ātrā/i);
  });

  it("prepare-draft parallelizes source comments", () => {
    const prep = readRepo("lib/admin-prepare-draft.ts");
    expect(prep).toMatch(/Promise\.all/);
    expect(prep).toMatch(/modelTier/);
  });
});
