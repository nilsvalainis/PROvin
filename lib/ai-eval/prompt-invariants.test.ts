import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";
import {
  AI_DAMAGE_CLAIM_CONTEXT_RULES,
  AI_EV_BEV_FORENSICS_RULES,
  AI_EXPERT_PARAGRAPH_PRESENTATION,
  HYBRID_COMMENT_RULES,
  PROVIN_COMMENT_BREVITY_RULES,
  PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES,
  PROVIN_REPORT_COPY_VOCABULARY,
  PROVIN_RESTRAINED_TONE_RULES,
} from "@/lib/source-summary-comment-format";

const root = process.cwd();

function readRepo(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("PROVIN AI prompt invariants", () => {
  it("has a non-empty prompt version tag", () => {
    expect(PROVIN_AI_PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it("vocabulary forbids automobīlis", () => {
    expect(PROVIN_REPORT_COPY_VOCABULARY).toMatch(/NEVER "automobīlis"/i);
  });

  it("damage claim rules require contextual EUR interpretation", () => {
    expect(AI_DAMAGE_CLAIM_CONTEXT_RULES).toMatch(/age at incident/i);
    expect(AI_DAMAGE_CLAIM_CONTEXT_RULES).toMatch(/premium/i);
    expect(AI_DAMAGE_CLAIM_CONTEXT_RULES).toMatch(/NEVER treat an insurance payout/i);
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
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toContain("FIELD DIVISION & ANTI-REPETITION");
    expect(prompts).toContain("COMPLEMENTARY SOURCES");
    expect(prompts).toContain("STRICT ROLES");
    expect(prompts).toContain("AI_DAMAGE_CLAIM_CONTEXT_RULES");
    expect(prompts).toContain("AI_EV_BEV_FORENSICS_RULES");
    expect(prompts).toContain("AI_AGGREGATE_KNOWLEDGE_RULES");
    expect(prompts).toContain("PROVIN_AI_PROMPT_VERSION");
    expect(prompts).toMatch(/NOBRAUKUMA VĒSTURES KOMENTĀRS/);
    expect(prompts).toContain("AI_CLIENT_PDF_EXPERT_MARKDOWN_RULES");
    expect(prompts).toMatch(/APPROVED BY IRISS/);
  });

  it("inspection and seller prompts use expert markdown, not hyphen checklists", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /AI_INSPECTION_RECOMMENDATIONS_SYSTEM[\s\S]*?AI_CLIENT_PDF_EXPERT_MARKDOWN_RULES/,
    );
    expect(prompts).toMatch(
      /AI_SELLER_ANALYSIS_SYSTEM[\s\S]*?AI_CLIENT_PDF_EXPERT_MARKDOWN_RULES/,
    );
    expect(prompts).toMatch(/NEKAD nesāc rindu ar "- "/);
  });

  it("summary prompt demands short opinion not section recapitulation", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?profesionālo viedokli/i);
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?NEKĀDĀ GADĪJUMĀ nepārraksti/i);
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?3–5 īsas rindkopas/);
  });

  it("field-agent prompts encode client value density and institutional memory", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(/CLIENT VALUE DENSITY/);
    expect(prompts).toMatch(/institutional memory/i);
    expect(prompts).toMatch(/VISIEM avotu|VISUS avotu/i);
  });

  it("field-agent prompts enforce epistemic hedging for digital-only audits", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(/EPISTEMIC HEDGING/);
    expect(prompts).toMatch(/NOT.*physically inspected|fiziski nav apskatījis/i);
    expect(prompts).toMatch(/visticamāk|ļoti iespējams|teorētiski/);
    expect(prompts).toMatch(/tehniski perfekts/);
    const vocab = readRepo("lib/source-summary-comment-format.ts");
    expect(vocab).toMatch(/EPISTEMIC HEDGING/);
  });

  it("summary and inspection prompts require aggregate-specific technical risk analysis", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(/TEHNISKO RISKU ANALĪZE|TECHNICAL RISK ANALYSIS/i);
    expect(prompts).toMatch(/OPERATORA KOMANDAS/i);
    expect(prompts).toMatch(/klātienes pārbaudes|Agregātu riski|Tehnisko risku/i);
    expect(prompts).toMatch(/NESĀC ar „Sveiki”|NESĀC ar \"Sveiki\"|Bez „Sveiki”/i);
  });

  it("operator notes are prepended with highest priority", () => {
    const notes = readRepo("lib/admin-ai-operator-notes.ts");
    expect(notes).toMatch(/AUGSTĀKĀ PRIORITĀTE/);
    expect(notes).toMatch(/NEDRĪKSTI APGRAIZĪT/);
    expect(notes).toMatch(/aiMaxLenForOperatorNotes/);
    expect(notes).toMatch(/parts\.push\(userPrompt/);
  });

  it("hybrid comment rules waive short length when operator supplies detail", () => {
    expect(HYBRID_COMMENT_RULES).toMatch(/LENGTH OVERRIDE/i);
    expect(HYBRID_COMMENT_RULES).toMatch(/IGNORE the 350–800/i);
  });

  it("restrained tone rules ban hyperbole and absolute claims", () => {
    expect(PROVIN_RESTRAINED_TONE_RULES).toMatch(/RESTRAINED EXPERT VOICE/);
    expect(PROVIN_RESTRAINED_TONE_RULES).toMatch(/„kritisks”/);
    expect(PROVIN_RESTRAINED_TONE_RULES).toMatch(/„anomālija”/);
    expect(PROVIN_RESTRAINED_TONE_RULES).toMatch(/„neatbilstība”/);
    expect(PROVIN_RESTRAINED_TONE_RULES).toMatch(/No exclamation marks/i);
  });

  it("brevity rules keep fields short and move comparison to the summary", () => {
    expect(PROVIN_COMMENT_BREVITY_RULES).toMatch(/BREVITY & FOCUS/);
    expect(PROVIN_COMMENT_BREVITY_RULES).toMatch(/2–4 paragraphs/);
    expect(PROVIN_COMMENT_BREVITY_RULES).toMatch(/ONE short sentence/i);
    expect(PROVIN_COMMENT_BREVITY_RULES).toMatch(/3\. Kopsavilkums/);
  });

  it("expert presentation and field-agent prompts carry restraint and brevity", () => {
    expect(AI_EXPERT_PARAGRAPH_PRESENTATION).toContain("RESTRAINED EXPERT VOICE");
    expect(AI_EXPERT_PARAGRAPH_PRESENTATION).toContain("BREVITY & FOCUS");
    expect(AI_EXPERT_PARAGRAPH_PRESENTATION).not.toMatch(/\*\*Anomālija:\*\*/);
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toContain("PROVIN_RESTRAINED_TONE_RULES");
    expect(prompts).toContain("PROVIN_COMMENT_BREVITY_RULES");
    expect(prompts).toMatch(/2–4 short paragraphs/);
  });

  it("few-shot examples stay free of hyperbole", () => {
    expect(PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES).not.toMatch(
      /kritisk|anomālij|katastrofāl/i,
    );
  });

  it("summary generation uses web search dispatch", () => {
    const summary = readRepo("lib/admin-ai-summary.ts");
    expect(summary).toMatch(/adminGenerateTextWithWebSearch/);
    expect(summary).toMatch(/Tehnisko risku|NEATKĀRTO|nedublē|NEDUBLĒ/i);
    const tech = readRepo("lib/admin-ai-technical-risks.ts");
    expect(tech).toMatch(/adminGenerateTextWithWebSearch/);
    const dispatch = readRepo("lib/admin-ai-dispatch.ts");
    expect(dispatch).toMatch(/aiGenerateTextWithWebSearch/);
    expect(dispatch).toMatch(/geminiGenerateTextWithGoogleSearch/);
  });

  it("avg annual mileage banner is removed from info banners", () => {
    const banners = readRepo("lib/provin-alert-banners.ts");
    expect(banners).not.toMatch(/avg_annual_mileage/);
    expect(banners).not.toMatch(/computeAverageAnnualMileage/);
    expect(banners).toMatch(/lv_registration_tenure/);
  });

  it("polish uses Sonnet, not Haiku or Opus", () => {
    const polish = readRepo("lib/admin-ai-polish.ts");
    expect(polish).toMatch(/CLAUDE_MODEL_SONNET/);
    expect(polish).not.toMatch(/CLAUDE_MODEL_HAIKU/);
    expect(polish).not.toMatch(/CLAUDE_MODEL_OPUS/);
  });

  it("Haiku Latvian prose is post-edited by Sonnet grammar polish", () => {
    const ai = readRepo("lib/admin-ai.ts");
    expect(ai).toMatch(/polishHaikuLatvianProse/);
    expect(ai).toMatch(/AI_LV_POLISH_SYSTEM/);
    expect(ai).toMatch(/model:\s*CLAUDE_MODEL_SONNET/);
  });

  it("comment generation can dispatch to Gemini for light tiers", () => {
    const dispatch = readRepo("lib/admin-ai-dispatch.ts");
    expect(dispatch).toMatch(/geminiGenerateExpertText/);
    expect(dispatch).toMatch(/geminiGenerateTextWithGoogleSearch/);
    expect(dispatch).toMatch(/isGeminiAdminTier/);
    const ui = readRepo("components/admin/AdminAiGenerateWithPrefill.tsx");
    expect(ui).toMatch(/recommendedTier/);
    expect(ui).toMatch(/aiAdminButtonOrder/);
    expect(ui).toMatch(/openDialog\(tier\)/);
  });

  it("Claude requests cache the stable system prompt", () => {
    const ai = readRepo("lib/admin-ai.ts");
    expect(ai).toMatch(/cache_control/);
    expect(ai).toMatch(/ephemeral/);
    expect(ai).toMatch(/cacheReadInputTokens/);
  });

  it("PDF extract and copilot default to Sonnet, not Opus", () => {
    expect(readRepo("lib/source-pdf-ai-extract.ts")).toMatch(/CLAUDE_MODEL_EXTRACT/);
    expect(readRepo("lib/source-pdf-ai-extract.ts")).not.toMatch(/CLAUDE_MODEL_OPUS/);
    expect(readRepo("lib/csdd-ai-structured.ts")).not.toMatch(/CLAUDE_MODEL_OPUS/);
    expect(readRepo("lib/admin-copilot-ai.ts")).not.toMatch(/CLAUDE_MODEL_OPUS/);
    expect(readRepo("lib/copilot-vendor-pdf-agent.ts")).not.toMatch(/CLAUDE_MODEL_OPUS/);
    expect(readRepo("lib/admin-vehicle-reports-ai.ts")).not.toMatch(/CLAUDE_MODEL_OPUS/);
  });

  it("EV forensics rules cover SOH and charging habits", () => {
    expect(AI_EV_BEV_FORENSICS_RULES).toMatch(/SOH/i);
    expect(AI_EV_BEV_FORENSICS_RULES).toMatch(/20.?80/i);
    expect(AI_EV_BEV_FORENSICS_RULES).toMatch(/DC|ātrā/i);
  });

  it("prepare-draft parallelizes source comments", () => {
    const prep = readRepo("lib/admin-prepare-draft.ts");
    expect(prep).toMatch(/Promise\.all/);
    expect(prep).toMatch(/modelTier/);
  });

  it("Gemini 3 uses low thinking with 400 fallback", () => {
    const gemini = readRepo("lib/admin-gemini.ts");
    expect(gemini).toMatch(/thinkingLevel:\s*"low"/);
    expect(gemini).toMatch(/isGeminiThinkingUnsupported/);
    expect(gemini).toMatch(/thoughtsTokenCount/);
  });

  it("admin AI routes attach usage to JSON responses", () => {
    expect(readRepo("app/api/admin/ai/source-comment/route.ts")).toMatch(/nextJsonWithAiUsage/);
    expect(readRepo("app/api/admin/ai/tirgus-market/route.ts")).toMatch(/nextJsonBodyWithAiUsage/);
    expect(readRepo("app/api/admin/prepare-draft/route.ts")).toMatch(/nextJsonBodyWithAiUsage/);
    expect(readRepo("components/admin/OrderDetailWorkspace.tsx")).toMatch(/AdminAiSessionCostBar/);
  });

  it("comment generation awaits AI usage helper so empty/failed calls surface as errors", () => {
    expect(readRepo("app/api/admin/ai/source-comment/route.ts")).toMatch(
      /return await nextJsonWithAiUsage/,
    );
    expect(readRepo("app/api/admin/ai/mileage-comment/route.ts")).toMatch(
      /return await nextJsonWithAiUsage/,
    );
  });

  it("Claude text generation bounds thinking so comments are not billed empty", () => {
    const ai = readRepo("lib/admin-ai.ts");
    expect(ai).toMatch(/effort:\s*"low"/);
    expect(ai).toMatch(/MAX_TOKENS_TEXT = 16_000/);
    expect(ai).toMatch(/shouldAiModelFailover/);
    expect(ai).not.toMatch(/FAILOVER_BACKOFF_MS/);
    expect(readRepo("lib/admin-gemini.ts")).not.toMatch(/FAILOVER_BACKOFF_MS/);
    expect(readRepo("components/admin/OrderDetailWorkspace.tsx")).toMatch(
      /readGeneratedAdminAiText/,
    );
  });
});
