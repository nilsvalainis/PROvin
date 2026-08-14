import { describe, expect, it } from "vitest";
import {
  buildPromotionCandidates,
  clipPromotionMarkdown,
  extractRecurringTerms,
  formatPromotionCandidatesMarkdown,
} from "@/lib/admin-audit-knowledge-promote";
import {
  clipLearningSnippet,
  distillLesson,
  redactLearningText,
} from "@/lib/admin-audit-learning-extract";

describe("admin-audit-learning-extract", () => {
  it("redacts VIN email phone km dates EUR", () => {
    const raw =
      "VIN WVWZZZ1JZYW123456 e-pasts test@example.com +371 26123456 185000 km 12.03.2024 cena 12 500 €";
    const out = redactLearningText(raw);
    expect(out).not.toMatch(/WVWZZZ/);
    expect(out).toContain("[VIN]");
    expect(out).toContain("[e-pasts]");
    expect(out).toContain("[tālrunis]");
    expect(out).toContain("[km]");
    expect(out).toContain("[datums]");
    expect(out).toContain("[EUR]");
  });

  it("distills short tagged lesson", () => {
    const plain =
      "Galvenais risks ir DSG mehatronika pie augsta nobraukuma. Klātienē jāpārbauda aukstais starts un slīdēšana.";
    const lesson = distillLesson(plain, "Tehnika");
    expect(lesson).toMatch(/^\[Tehnika\]/);
    expect(lesson!.length).toBeLessThanOrEqual(360);
  });

  it("clips long snippets", () => {
    const long = "A".repeat(500);
    expect(clipLearningSnippet(long, 40).length).toBeLessThanOrEqual(40);
  });
});

describe("admin-audit-knowledge-promote", () => {
  it("builds candidates only above min snippet count", () => {
    const candidates = buildPromotionCandidates(
      [
        {
          key: "AUDI|A6|CRT",
          label: "Audi A6 CRT",
          updatedAt: new Date().toISOString(),
          snippets: ["[Tehnika] a", "[Apskate] b", "[Kopsavilkums] c"],
        },
        {
          key: "BMW|X5",
          label: "BMW X5",
          updatedAt: new Date().toISOString(),
          snippets: ["[Tehnika] only one rich enough? no"],
        },
      ],
      { minSnippets: 3 },
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].key).toBe("AUDI|A6|CRT");
    expect(candidates[0].topSnippets).toHaveLength(3);
  });

  it("formats compact markdown and clips budget", () => {
    const md = formatPromotionCandidatesMarkdown([
      {
        key: "VW|GOLF|CFFB",
        label: "VW Golf CFFB",
        snippetCount: 4,
        topSnippets: [
          "[Tehnika] DQ250 eļļas maiņa un testa brauciens.",
          "[Apskate] DPF regenerācijas kļūdas pilsētā.",
          "[Nobraukums] Odometra līkne bez pretrunām.",
        ],
      },
    ]);
    expect(md).toContain("promotion candidates");
    expect(md).toContain("VW Golf CFFB");
    expect(clipPromotionMarkdown(md, 80)).toContain("truncated");
  });

  it("extracts recurring terms across snippets", () => {
    const terms = extractRecurringTerms(
      [
        "DSG mehatronika un eļļas maiņa",
        "DSG testa brauciens un eļļas kontrole",
        "cits teksts bez atkārtojumiem xyz",
      ],
      2,
    );
    expect(terms.some((t) => t.includes("dsg") || t.includes("eļļas"))).toBe(true);
  });
});
