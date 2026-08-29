import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";
import { PROVIN_BANNED_VOCABULARY } from "@/lib/provin-banned-vocabulary";
import {
  AI_DAMAGE_CLAIM_CONTEXT_RULES,
  AI_EV_BEV_FORENSICS_RULES,
  AI_EXPERT_PARAGRAPH_PRESENTATION,
  AI_HISTORICAL_REPORTS_CONTEXT_RULES,
  AI_MILEAGE_BAND_RISK_RULES,
  AI_NO_ESTIMATED_REPAIR_EUR_RULES,
  AI_OPERATOR_NOTES_EXECUTION_RULES,
  AI_PLAIN_LANGUAGE_TERMS,
  AI_POWERTRAIN_IDENTIFICATION_RULES,
  AI_RESOLVED_HISTORICAL_FINDINGS_RULES,
  AI_TA_COVERED_WEAR_RULES,
  AI_TECHNICAL_RISKS_FEW_SHOTS,
  AI_TECHNICAL_RISKS_FLAGSHIP_RULES,
  AI_TECHNICAL_RISKS_RESEARCH_RULES,
  AI_UNKNOWN_IS_NOT_A_RISK_RULES,
  AI_WRAP_FILM_RULES,
  AI_WINTER_SALT_RUST_RULES,
  AI_PAINT_GAUGE_INSPECTION_RULES,
  AI_OIL_CHANGE_INTERVAL_RULES,
  HYBRID_COMMENT_RULES,
  PROVIN_COMMENT_BREVITY_RULES,
  PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES,
  PROVIN_REPORT_COPY_VOCABULARY,
  PROVIN_RESTRAINED_TONE_RULES,
  stripUnauthorizedEuroAmounts,
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
    expect(PROVIN_REPORT_COPY_VOCABULARY).toMatch(/HUMAN DASHES|ASCII hyphen/i);
    expect(PROVIN_REPORT_COPY_VOCABULARY).toMatch(/em dash/i);
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
    expect(prompts).toMatch(/Ja pievienoto foto nav/);
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

  it("listing peek email forbids markdown bold leftover from field-agent hooks", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /AI_LISTING_PEEK_COMMENT_SYSTEM[\s\S]*?AI_CLIENT_EMAIL_FORMAT_RULES/,
    );
    expect(prompts).toMatch(
      /AI_LISTING_PEEK_COMMENT_SYSTEM[\s\S]*?Field-agent .*bold.*NEDER/,
    );
    expect(prompts).toMatch(
      /AI_LISTING_PEEK_COMMENT_SYSTEM[\s\S]*?VIENA rindkopa/,
    );
  });

  it("summary prompt demands short opinion not section recapitulation", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?profesionālo viedokli/i);
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?NEKĀDĀ GADĪJUMĀ nepārraksti/i);
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?3–5 īsas rindkopas/);
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?NERAKSTI sludinājuma cenu/);
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?ĪPAŠNIEKU SKAITS/);
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?nesummē/i);
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

  it("powertrain identification rules demand hypotheses, not invented engine codes", () => {
    expect(AI_POWERTRAIN_IDENTIFICATION_RULES).toMatch(/AGREGĀTU IDENTIFIKĀCIJA/);
    expect(AI_POWERTRAIN_IDENTIFICATION_RULES).toMatch(/1–2 visticamākos/);
    expect(AI_POWERTRAIN_IDENTIFICATION_RULES).toMatch(/kā to apstiprināt/);
    expect(AI_POWERTRAIN_IDENTIFICATION_RULES).toMatch(/Neizdomā kodu/);
    expect(AI_POWERTRAIN_IDENTIFICATION_RULES).toMatch(/vispārīgā, modeļa līmenī/);
  });

  it("mileage-band rules calibrate risk without exaggeration", () => {
    expect(AI_MILEAGE_BAND_RISK_RULES).toMatch(/Nepārspīlē/);
    expect(AI_MILEAGE_BAND_RISK_RULES).toMatch(/maksimāli 1–2|tikai 1–2/);
    expect(AI_MILEAGE_BAND_RISK_RULES).toMatch(/20 000–40 000 km/);
    expect(AI_MILEAGE_BAND_RISK_RULES).toMatch(/nepierādītu/);
    expect(AI_MILEAGE_BAND_RISK_RULES).toMatch(/Vecums nav tas pats/);
  });

  it("both base system prompts train aggregate identification and mileage calibration", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toContain("AI_POWERTRAIN_IDENTIFICATION_RULES");
    expect(prompts).toContain("AI_MILEAGE_BAND_RISK_RULES");
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_POWERTRAIN_IDENTIFICATION_RULES\}/,
    );
    expect(prompts).toMatch(
      /PROVIN_EXPERT_SYSTEM_PROMPT[\s\S]*?\$\{AI_MILEAGE_BAND_RISK_RULES\}/,
    );
  });

  it("technical risks flagship rules demand detail and equipment-absent analysis", () => {
    expect(AI_TECHNICAL_RISKS_FLAGSHIP_RULES).toMatch(/8–12 rindkopas/);
    expect(AI_TECHNICAL_RISKS_FLAGSHIP_RULES).toMatch(/Active Steering/);
    expect(AI_TECHNICAL_RISKS_FLAGSHIP_RULES).toMatch(/M57/);
    expect(AI_TECHNICAL_RISKS_FLAGSHIP_RULES).toMatch(/\*\*NAV\*\* dārgs risks/);
  });

  it("technical risks research rules require European forum search when packs are thin", () => {
    expect(AI_TECHNICAL_RISKS_RESEARCH_RULES).toMatch(/WEB RESEARCH/);
    expect(AI_TECHNICAL_RISKS_RESEARCH_RULES).toMatch(/Motor-Talk/);
    expect(AI_TECHNICAL_RISKS_RESEARCH_RULES).toMatch(/Neizdomā/);
    expect(AI_TECHNICAL_RISKS_FEW_SHOTS).toMatch(/Paraugs C/);
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    const block = prompts.slice(
      prompts.indexOf("AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM"),
      prompts.indexOf("AI_INSPECTION_RECOMMENDATIONS_SYSTEM"),
    );
    expect(block).toMatch(/AI_TECHNICAL_RISKS_RESEARCH_RULES/);
    expect(block).toMatch(/AI_TECHNICAL_RISKS_FEW_SHOTS/);
    const tech = readRepo("lib/admin-ai-technical-risks.ts");
    expect(tech).toMatch(/maxSearches:\s*6/);
    expect(tech).toMatch(/16_000/);
  });

  it("technical risk analysis starts with risk facts, not a car-identity intro", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    const block = prompts.slice(
      prompts.indexOf("AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM"),
      prompts.indexOf("AI_INSPECTION_RECOMMENDATIONS_SYSTEM"),
    );
    expect(block).toMatch(/Īsāka analīze nav kļūda/);
    expect(block).toMatch(/AI_TECHNICAL_RISKS_FLAGSHIP_RULES/);
    expect(block).toMatch(/NAV risks/);
    expect(AI_TECHNICAL_RISKS_FLAGSHIP_RULES).toMatch(/iekšēja/);
    expect(AI_TECHNICAL_RISKS_FLAGSHIP_RULES).toMatch(/Pirmā rindkopa/);
    expect(AI_TECHNICAL_RISKS_FLAGSHIP_RULES).toMatch(/maksimāli 1–2/);
    expect(AI_TECHNICAL_RISKS_FLAGSHIP_RULES).toMatch(/NOSACĪTA/);
    const tech = readRepo("lib/admin-ai-technical-risks.ts");
    expect(tech).toMatch(/buildAggregateIdentificationBrief/);
    expect(tech).toMatch(/Pirmā sadaļa/);
    expect(tech).toMatch(/Nepārspīlē/);
    expect(tech).toMatch(/20–40 tūkst\. km/);
    expect(tech).toMatch(/varbūtības × izmaksām/);
    expect(tech).toMatch(/Īsāka analīze nav kļūda/);
  });

  it("inspection recommendations convert remaining uncertainty into buyer actions", () => {
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    const block = prompts.slice(
      prompts.indexOf("AI_INSPECTION_RECOMMENDATIONS_SYSTEM"),
      prompts.indexOf("AI_SELLER_ANALYSIS_SYSTEM"),
    );
    expect(block).toMatch(/NE pa vienai rindkopai katram risku blokam/);
    expect(block).toMatch(/350–800 šim laukam NEATTIECAS/);
    const insp = readRepo("lib/admin-ai-inspection.ts");
    expect(insp).toMatch(/NE pa vienai rindkopai katram risku blokam/);
  });

  it("operator notes are prepended with highest priority", () => {
    const notes = readRepo("lib/admin-ai-operator-notes.ts");
    expect(notes).toMatch(/SAISTOŠS DARBA UZDEVUMS/);
    expect(notes).toMatch(/NEDRĪKSTI izmest faktus|NEDRĪKSTI APGRAIZĪT/);
    expect(notes).toMatch(/AI_OPERATOR_NOTES_EXECUTION_RULES/);
    expect(notes).toMatch(/aiMaxLenForOperatorNotes/);
    expect(notes).toMatch(/parts\.push\(userPrompt/);
  });

  it("operator notes execution forbids cherry-picking and padding", () => {
    expect(AI_OPERATOR_NOTES_EXECUTION_RULES).toMatch(/BINDING WORK ORDER/);
    expect(AI_OPERATOR_NOTES_EXECUTION_RULES).toMatch(/never cherry-pick/);
    expect(AI_OPERATOR_NOTES_EXECUTION_RULES).toMatch(/tikai par/);
    expect(AI_OPERATOR_NOTES_EXECUTION_RULES).toMatch(/No extra paragraphs/);
    expect(HYBRID_COMMENT_RULES).toMatch(/BINDING WORK ORDER/);
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_OPERATOR_NOTES_EXECUTION_RULES\}/,
    );
    expect(prompts).toMatch(
      /PROVIN_EXPERT_SYSTEM_PROMPT[\s\S]*?\$\{AI_OPERATOR_NOTES_EXECUTION_RULES\}/,
    );
    expect(PROVIN_COMMENT_BREVITY_RULES).toMatch(/OPERATOR NOTES OVERRIDE/);
  });

  it("TA covered wear, unknown-is-not-risk, and workshop terms apply to every field agent", () => {
    expect(AI_TA_COVERED_WEAR_RULES).toMatch(/CSDD TA COVERED WEAR/);
    expect(AI_TA_COVERED_WEAR_RULES).toMatch(/SVAIGA/);
    expect(AI_TA_COVERED_WEAR_RULES).toMatch(/MK 295/);
    expect(AI_UNKNOWN_IS_NOT_A_RISK_RULES).toMatch(/UNKNOWN IS NOT A RISK/);
    expect(AI_UNKNOWN_IS_NOT_A_RISK_RULES).toMatch(/15\+/);
    expect(AI_PLAIN_LANGUAGE_TERMS).toMatch(/divmasu spararats/);
    expect(AI_PLAIN_LANGUAGE_TERMS).toMatch(/ieplūdes kolektors/);
    expect(AI_HISTORICAL_REPORTS_CONTEXT_RULES).toMatch(/ADAPT \/ SUPPLEMENT \/ CONNECT/);
    expect(AI_HISTORICAL_REPORTS_CONTEXT_RULES).toMatch(/STYLE MEMORY|instance facts|NEVER take instance/i);
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_TA_COVERED_WEAR_RULES\}/,
    );
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_UNKNOWN_IS_NOT_A_RISK_RULES\}/,
    );
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_PLAIN_LANGUAGE_TERMS\}/,
    );
    expect(readRepo("lib/admin-ai-order-context.ts")).toMatch(/buildTechnicalInspectionCoverageBrief/);
    expect(readRepo("lib/admin-ai-order-context.ts")).toMatch(/buildStyleCorpusAiContext/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).toMatch(/code\.startsWith\("vocabulary_"\)/);
    expect(readRepo("lib/admin-ai-historical-context.ts")).toMatch(/listNewestOrderDraftSessionIds/);
  });

  it("oil-change interval math lives only in the dealer field", () => {
    expect(AI_OIL_CHANGE_INTERVAL_RULES).toMatch(/Eļļas maiņas intervāli/);
    expect(AI_OIL_CHANGE_INTERVAL_RULES).toMatch(/manufacturer interval|ražotāja/i);
    expect(AI_OIL_CHANGE_INTERVAL_RULES).toMatch(/10 000 km/);
    expect(HYBRID_COMMENT_RULES).toMatch(/Eļļas maiņas intervāli/);
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_OIL_CHANGE_INTERVAL_RULES\}/,
    );
    expect(prompts).toMatch(/aiAutoRecordsOilIntervalSystemPrompt/);
    expect(prompts).toMatch(/ACTIVE FIELD: OFICIĀLĀ DĪLERA DATI — Eļļas maiņas intervāli/);
    expect(readRepo("lib/admin-ai-source-comment.ts")).toMatch(/oilChangeIntervalNotes/);
  });

  it("winter salt rust is mandatory in risks and inspection when the exposure brief says so", () => {
    expect(AI_WINTER_SALT_RUST_RULES).toMatch(/WINTER SALT RUST/);
    expect(AI_WINTER_SALT_RUST_RULES).toMatch(/riteņu arkas/);
    expect(AI_WINTER_SALT_RUST_RULES).toMatch(/sliekš/);
    expect(AI_WINTER_SALT_RUST_RULES).toMatch(/numura zīmes/);
    expect(AI_UNKNOWN_IS_NOT_A_RISK_RULES).toMatch(/WINTER SALT RUST/);
    expect(AI_TA_COVERED_WEAR_RULES).toMatch(/WINTER SALT RUST|Climate rust/);
    expect(AI_RESOLVED_HISTORICAL_FINDINGS_RULES).toMatch(/WINTER SALT RUST/);
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_WINTER_SALT_RUST_RULES\}/,
    );
    expect(prompts).toMatch(/AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM[\s\S]*?ZIEMAS SĀLS/);
    expect(prompts).toMatch(/AI_INSPECTION_RECOMMENDATIONS_SYSTEM[\s\S]*?Ziemas sāls/);
    expect(readRepo("lib/admin-ai-order-context.ts")).toMatch(/buildWinterSaltRustBrief/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).toMatch(/winter_salt_rust_missing/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).toMatch(/winterSaltRustRequiredInPrompt/);
  });

  it("paint-gauge inspection is mandatory for every car in ieteikumi", () => {
    expect(AI_PAINT_GAUGE_INSPECTION_RULES).toMatch(/PAINT THICKNESS/);
    expect(AI_PAINT_GAUGE_INSPECTION_RULES).toMatch(/150-170/);
    expect(AI_PAINT_GAUGE_INSPECTION_RULES).toMatch(/50-100/);
    expect(AI_PAINT_GAUGE_INSPECTION_RULES).toMatch(/iekšējās ailes/i);
    expect(AI_PAINT_GAUGE_INSPECTION_RULES).toMatch(/krāsas biezuma mērītāj/);
    expect(HYBRID_COMMENT_RULES).toMatch(/PAINT THICKNESS/);
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_PAINT_GAUGE_INSPECTION_RULES\}/,
    );
    expect(prompts).toMatch(/PROVIN_EXPERT_SYSTEM_PROMPT[\s\S]*?\$\{AI_PAINT_GAUGE_INSPECTION_RULES\}/);
    expect(prompts).toMatch(/AI_INSPECTION_RECOMMENDATIONS_SYSTEM[\s\S]*?Virsbūves stāvoklis un krāsas biezums/);
    expect(prompts).toMatch(/AI_INSPECTION_RECOMMENDATIONS_SYSTEM[\s\S]*?tipiski 6–12/);
    expect(readRepo("lib/admin-ai-inspection.ts")).toMatch(/Virsbūves stāvoklis un krāsas biezums/);
    expect(readRepo("lib/admin-ai-inspection.ts")).toMatch(/tipiski 6–12/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).toMatch(/paint_gauge_missing/);
    expect(readRepo("lib/ai-eval/comment-quality.ts")).toMatch(/inspection: 14_000/);
  });

  it("wrap / film rules force a mention in risks and summary when any field has a wrap", () => {
    expect(AI_WRAP_FILM_RULES).toMatch(/WRAP \/ FILM/);
    expect(AI_WRAP_FILM_RULES).toMatch(/aplīm/);
    expect(AI_WRAP_FILM_RULES).toMatch(/zem (?:the )?film|zem plēves|without removing/i);
    expect(AI_UNKNOWN_IS_NOT_A_RISK_RULES).toMatch(/WRAP \/ FILM/);
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_WRAP_FILM_RULES\}/,
    );
    expect(prompts).toMatch(/AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM[\s\S]*?WRAP \/ APLĪMĒŠANA/);
    expect(prompts).toMatch(/AI_SUMMARY_ANALYSIS_SYSTEM[\s\S]*?WRAP \/ APLĪMĒŠANA/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).toMatch(/wrap_film_missing/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).toMatch(/mentionsVehicleWrapInOrderFacts/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).toMatch(/wrap_film_invented/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).toMatch(/foreign_audit_fact_copied/);
    expect(readRepo("lib/admin-ai-historical-context.ts")).toMatch(/sanitizeOtherAuditSnippet/);
    expect(readRepo("lib/admin-ai-historical-context.ts")).toMatch(/OTHER_AUDIT_STYLE_HEADING/);
    expect(readRepo("lib/admin-ai-summary.ts")).toMatch(/WRAP_FILM|aplīmēšana/);
    expect(readRepo("lib/admin-ai-technical-risks.ts")).toMatch(/WRAP_FILM|aplīmēšana/);
    expect(AI_WRAP_FILM_RULES).toMatch(/NOT a trigger|NAV fakts|do not mention wrap at all/i);
  });

  it("resolved historical TA findings are not an in-person hunt list", () => {
    expect(AI_RESOLVED_HISTORICAL_FINDINGS_RULES).toMatch(/RESOLVED HISTORICAL FINDINGS/);
    expect(AI_RESOLVED_HISTORICAL_FINDINGS_RULES).toMatch(/cietās daļiņas/);
    expect(AI_RESOLVED_HISTORICAL_FINDINGS_RULES).toMatch(/rūsa/);
    expect(AI_RESOLVED_HISTORICAL_FINDINGS_RULES).toMatch(/2\+ year/);
    expect(PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES).toMatch(/datos jau novērstus defektus/);
    expect(PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES).not.toMatch(
      /viens mērījums ir situatīvs un jāpārbauda klātienē/,
    );
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_RESOLVED_HISTORICAL_FINDINGS_RULES\}/,
    );
    expect(prompts).toMatch(
      /PROVIN_EXPERT_SYSTEM_PROMPT[\s\S]*?\$\{AI_RESOLVED_HISTORICAL_FINDINGS_RULES\}/,
    );
    expect(prompts).toMatch(/CSDD FOCUS:[\s\S]*?cietās daļiņas/);
  });

  it("estimated repair EUR is banned from expert comments", () => {
    expect(AI_NO_ESTIMATED_REPAIR_EUR_RULES).toMatch(/NO ESTIMATED REPAIR EUR/);
    expect(AI_NO_ESTIMATED_REPAIR_EUR_RULES).toMatch(/orientējoši 400-800 €/);
    expect(AI_NO_ESTIMATED_REPAIR_EUR_RULES).toMatch(/ZERO estimated EUR/);
    expect(AI_TECHNICAL_RISKS_FLAGSHIP_RULES).toMatch(/Bez orientējošām EUR joslām/);
    const prompts = readRepo("lib/admin-ai-prompts.ts");
    expect(prompts).toMatch(
      /PROVIN_FIELD_AGENT_SYSTEM[\s\S]*?\$\{AI_NO_ESTIMATED_REPAIR_EUR_RULES\}/,
    );
    expect(prompts).toMatch(
      /PROVIN_EXPERT_SYSTEM_PROMPT[\s\S]*?\$\{AI_NO_ESTIMATED_REPAIR_EUR_RULES\}/,
    );
    expect(prompts).toMatch(/NERAKSTI aptuvenās remonta/);
    const tech = readRepo("lib/admin-ai-technical-risks.ts");
    expect(tech).toMatch(/NERAKSTI aptuvenās remonta izmaksas eiro/);
    expect(tech).not.toMatch(/aptuvenās remonta izmaksas EUR diapazonā/);
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
    expect(PROVIN_COMMENT_BREVITY_RULES).not.toMatch(/FLAGSHIP EXCEPTION/);
    expect(PROVIN_COMMENT_BREVITY_RULES).toMatch(/flagship fields live only/);
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

  it("summary generation synthesizes already-generated sections without web search", () => {
    const summary = readRepo("lib/admin-ai-summary.ts");
    expect(summary).toMatch(/adminGenerateExpertText/);
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
    expect(polish).toMatch(/applyProvinReportCopyVocabulary/);
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

  it("banned client-facing vocabulary (saime, Baltija, injektori, kancelejisms) is absent from prompt sources", () => {
    const filesToScan = [
      "lib/source-summary-comment-format.ts",
      "lib/admin-ai-prompts.ts",
      "lib/admin-ai-technical-risks.ts",
      "lib/admin-ai-aggregate-identification.ts",
      "lib/admin-ai-aggregate-knowledge.ts",
      "lib/provin-aggregate-case-rules.ts",
    ];
    for (const file of filesToScan) {
      const src = readRepo(file);
      for (const entry of PROVIN_BANNED_VOCABULARY) {
        expect(src, `${file} must not use "${entry.label}" (banned vocabulary)`).not.toMatch(
          entry.pattern,
        );
      }
    }
  });

  it("banned vocabulary single source of truth feeds both prompt and eval", () => {
    expect(readRepo("lib/source-summary-comment-format.ts")).toMatch(
      /buildBannedVocabularyPromptRules/,
    );
    expect(readRepo("lib/ai-eval/comment-quality.ts")).toMatch(/findBannedVocabularyHits/);
  });

  it("EUR safety net keeps 2.0 TDI / 0.03 headings instead of chopping the paragraph start", () => {
    const input = [
      "Eļļas sūkņa piedziņas ass",
      "2.0 TDI dzinējiem ar CAHA kodu ass nodilums ir tipisks.",
      "",
      "Cieto daļiņu rādītājs",
      "Dūmainības koeficients 0.03 ir labvēlīgs signāls datos.",
    ].join("\n");
    const out = stripUnauthorizedEuroAmounts(input);
    expect(out).toContain("Eļļas sūkņa piedziņas ass\n2.0 TDI");
    expect(out).toContain("Cieto daļiņu rādītājs\nDūmainības koeficients 0.03");
  });

  it("stripUnauthorizedEuroAmounts drops only the sentence carrying € / EUR", () => {
    const input =
      "Šis ir teikums bez naudas pieminēšanas. Nomaiņa izmaksā apmēram 250-500 € servisā. Trešais teikums turpinās normāli.";
    const out = stripUnauthorizedEuroAmounts(input);
    expect(out).not.toMatch(/€/);
    expect(out).toMatch(/Šis ir teikums bez naudas pieminēšanas/);
    expect(out).toMatch(/Trešais teikums turpinās normāli/);
  });

  it("technical risks and inspection generators apply the EUR safety-net filter", () => {
    expect(readRepo("lib/admin-ai-technical-risks.ts")).toMatch(/stripUnauthorizedEuroAmounts/);
    expect(readRepo("lib/admin-ai-inspection.ts")).toMatch(/stripUnauthorizedEuroAmounts/);
    expect(readRepo("lib/admin-ai-summary.ts")).toMatch(/stripUnauthorizedEuroAmounts/);
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
    expect(readRepo("app/api/admin/ai/listing-peek-comment/route.ts")).toMatch(
      /nextJsonBodyWithAiUsage/,
    );
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
    expect(ai).toMatch(/MAX_TOKENS_TEXT = 32_000/);
    expect(ai).toMatch(/shouldAiModelFailover/);
    expect(ai).not.toMatch(/FAILOVER_BACKOFF_MS/);
    expect(readRepo("lib/admin-gemini.ts")).not.toMatch(/FAILOVER_BACKOFF_MS/);
    expect(readRepo("components/admin/OrderDetailWorkspace.tsx")).toMatch(
      /readGeneratedAdminAiText/,
    );
  });

  it("text generation streams so a paid-but-cut-off answer is still salvaged", () => {
    const ai = readRepo("lib/admin-ai.ts");
    expect(ai).toMatch(/messages\.stream\(/);
    expect(ai).toMatch(/partial_text_salvaged/);
    expect(ai).toMatch(/TEXT_REQUEST_TIMEOUT_MS = 280_000/);
    expect(ai).toMatch(/WEB_SEARCH_REQUEST_TIMEOUT_MS = 280_000/);
    expect(ai).toMatch(/AiIncompleteCommentError/);
    expect(ai).not.toMatch(/return salvaged;/);
    const gemini = readRepo("lib/admin-gemini.ts");
    expect(gemini).toMatch(/generateContentStream/);
    expect(gemini).toMatch(/partial_text_salvaged/);
    expect(gemini).toMatch(/maxOutputTokens/);
    expect(gemini).toMatch(/thinkingBudget/);
    expect(gemini).toMatch(/streamGenerateContent/);
    expect(gemini).toMatch(/AiIncompleteCommentError/);
    expect(readRepo("lib/admin-ai-route-response.ts")).toMatch(/ai_empty_content/);
    expect(readRepo("lib/admin-ai-route-response.ts")).toMatch(/ai_incomplete_comment/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).toMatch(/SELF_CORRECTION_RETRY_CODES/);
    expect(readRepo("lib/admin-ai-dispatch.ts")).not.toMatch(
      /SELF_CORRECTION_RETRY_CODES = new Set\(\[[\s\S]*markdown_asterisk/,
    );
    expect(readRepo("lib/admin-ai.ts")).toMatch(/aiBudgetAllowsRetry/);
    expect(readRepo("lib/admin-gemini.ts")).toMatch(/aiBudgetAllowsRetry/);
  });

  it("comment generation waits for JSON instead of a live preview stream", () => {
    expect(readRepo("lib/admin-ai-stream-client.ts")).toMatch(/Accept:\s*"application\/json"/);
    expect(readRepo("components/admin/OrderDetailWorkspace.tsx")).toMatch(/generateAdminAiText/);
    expect(readRepo("components/admin/OrderDetailWorkspace.tsx")).not.toMatch(/AdminAiStreamPreview/);
    expect(readRepo("components/admin/AdminListingAnalysisSourceBlock.tsx")).toMatch(
      /generateAdminAiText/,
    );
    expect(readRepo("components/admin/AdminListingAnalysisSourceBlock.tsx")).not.toMatch(
      /AdminAiStreamPreview/,
    );
  });

  it("AI field errors are rendered visibly, not as 9px amber whispers", () => {
    for (const file of [
      "components/admin/OrderDetailWorkspace.tsx",
      "components/admin/AdminListingAnalysisSourceBlock.tsx",
      "components/admin/AdminSourceCommentField.tsx",
      "components/admin/AdminTirgusSourceBlock.tsx",
      "components/admin/AdminListingPeekCommentComposer.tsx",
    ]) {
      const src = readRepo(file);
      expect(src).toMatch(/AdminAiFieldError/);
      expect(src).not.toMatch(/text-\[9px\] leading-snug text-amber-800\/90/);
    }
    expect(readRepo("components/admin/AdminAiFieldError.tsx")).toMatch(/role="alert"/);
  });

  it("comment AI routes use the 300s Fluid Compute ceiling", () => {
    for (const route of [
      "app/api/admin/ai/summary-analysis/route.ts",
      "app/api/admin/ai/technical-risk-analysis/route.ts",
      "app/api/admin/ai/seller-analysis/route.ts",
      "app/api/admin/ai/source-comment/route.ts",
      "app/api/admin/ai/inspection-recommendations/route.ts",
    ]) {
      expect(readRepo(route)).toMatch(/maxDuration = 300/);
    }
    expect(readRepo("lib/ai-request-budget.ts")).toMatch(/AI_ROUTE_MAX_DURATION_SEC = 300/);
    expect(readRepo("lib/admin-ai.ts")).toMatch(/TEXT_REQUEST_TIMEOUT_MS = 280_000/);
    expect(readRepo("lib/admin-gemini.ts")).toMatch(/TEXT_REQUEST_TIMEOUT_MS = 280_000/);
  });
});
