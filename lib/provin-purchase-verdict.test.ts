import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { checkCommentContradictions } from "@/lib/comment-contradiction-check";
import { evaluateExpertCommentQuality } from "@/lib/ai-eval/comment-quality";
import {
  buildFlashMaxReviewUserPrompt,
  FLASH_MAX_FINAL_REVIEW_SYSTEM,
  parseFlashMaxReviewResponse,
} from "@/lib/flash-max-final-review";
import { LISTING_PEEK_TOPICS } from "@/lib/listing-peek-comment-presets";
import {
  buildBannedVocabularyPromptRules,
  textHasPurchaseVerdict,
} from "@/lib/provin-banned-vocabulary";
import { AI_LISTING_PEEK_COMMENT_SYSTEM } from "@/lib/admin-ai-prompts";

/** 25.11 Nila likums: PROVIN dod ieteikumus, lēmumu pieņem klients - nekāda «pirkt / nepirkt» verdikta. */
describe("pirkuma verdikta vārdi", () => {
  it.each([
    "Slēdziens: pirkt / nepirkt - nepirkt.",
    "Šo auto neiesakām iegādāties.",
    "Iesakām šo automašīnu pirkt.",
    "Konkrētās automašīnas iegādi neiesakām.",
    "Nav ieteicams pirkt bez pārbaudes.",
    "Mūsu verdikts ir skaidrs.",
    "Kopējais slēdziens - auto ir labā stāvoklī.",
    "Nepērciet šo auto.",
  ])("atrod: %s", (text) => {
    expect(textHasPurchaseVerdict(text)).toBe(true);
  });

  it.each([
    "Pirms pirkuma ieteicams pārbaudīt dzinēju servisā.",
    "Ieteicams pārbaudīt zobsiksnas maiņas rēķinu.",
    "Auto pirkts Vācijā 2019. gadā.",
    "Lēmumu par iegādi pieņemat Jūs.",
  ])("neatrod ieteikumā: %s", (text) => {
    expect(textHasPurchaseVerdict(text)).toBe(false);
  });

  it("banned saraksts nonāk promptā un eval (self-correction) pārbaudē", () => {
    expect(buildBannedVocabularyPromptRules()).toMatch(/pirkt \/ nepirkt/);
    expect(buildBannedVocabularyPromptRules()).toMatch(/lēmumu pieņem klients/);
    const codes = evaluateExpertCommentQuality("Šo auto neiesakām iegādāties.", { field: "summary" }).map((i) => i.code);
    expect(codes).toContain("vocabulary_iesakam_iegadaties");
  });

  it("deterministiskā faktu pārbaude karodziņo verdiktu (W), ar teikumu", () => {
    const facts = buildCanonicalFacts({ sourceBlocks: createDefaultSourceBlocks() } as never);
    const flags = checkCommentContradictions({
      text: "Nobraukums atbilst. Šo auto neiesakām iegādāties.",
      field: "summary",
      facts,
    });
    const hit = flags.find((f) => f.kind === "purchase_verdict");
    expect(hit?.level).toBe("W");
    expect(hit?.sentence).toMatch(/neiesakām iegādāties/);
  });

  it("noslēguma pārbaude: veids «verdikts», deterministiskie trāpījumi promptā, labojums bez verdikta", () => {
    expect(FLASH_MAX_FINAL_REVIEW_SYSTEM).toMatch(/"verdikts"/);
    const fields = [{ id: "summary", label: "3. Kopsavilkums", text: "Fakti sakrīt. Šo auto neiesakām iegādāties." }];
    expect(buildFlashMaxReviewUserPrompt(fields, "fakti")).toMatch(/PURCHASE VERDICT WORDS FOUND[\s\S]*summary/);
    expect(buildFlashMaxReviewUserPrompt([{ id: "x", label: "x", text: "Fakti sakrīt." }], "fakti")).not.toMatch(
      /PURCHASE VERDICT/,
    );
    const ok = parseFlashMaxReviewResponse(
      JSON.stringify({
        findings: [
          {
            field: "summary",
            kind: "verdikts",
            reason: "Pirkuma lēmumu pieņem klients.",
            find: "Šo auto neiesakām iegādāties.",
            replace: "Pirms lēmuma ieteicams pārbaudīt dzinēju servisā.",
          },
          {
            field: "summary",
            kind: "valoda",
            reason: "x",
            find: "Fakti sakrīt.",
            replace: "Slēdziens: nepirkt.",
          },
        ],
      }),
      fields,
    );
    expect(ok.map((f) => f.kind)).toEqual(["verdikts"]);
  });

  it("Ātrā sludinājuma e-pasta prompts un sagataves bez «neiesakām iegādāties»", () => {
    // Prompts satur aizliegto vārdu sarakstu (BANNED VOCABULARY) - pārbaudām pašu uzdevuma tekstu.
    expect(AI_LISTING_PEEK_COMMENT_SYSTEM).not.toMatch(/"neiesakām iegādāties" variantu/);
    expect(AI_LISTING_PEEK_COMMENT_SYSTEM).toMatch(/lēmumu pieņem klients/);
    for (const topic of LISTING_PEEK_TOPICS) {
      for (const phrase of topic.phrases) {
        expect(textHasPurchaseVerdict(phrase.text), phrase.text).toBe(false);
      }
    }
  });
});
