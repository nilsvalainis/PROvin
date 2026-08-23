import { describe, expect, it } from "vitest";
import {
  OTHER_AUDIT_STYLE_HEADING,
  extractOtherAuditMemoryFromPrompt,
  findCopiedOtherAuditPhrases,
  sanitizeOtherAuditSnippet,
} from "@/lib/admin-ai-other-audit-style";
import {
  evaluateExpertCommentQuality,
  mentionsVehicleWrapInOrderFacts,
} from "@/lib/ai-eval/comment-quality";

describe("sanitizeOtherAuditSnippet", () => {
  it("drops wrap / film sentences from another car", () => {
    const out = sanitizeOtherAuditSnippet(
      "Hidrotransformators paliek ierasta uzturēšanas izmaksa. Automašīna ir aplīmēta ar plēvi, zem tās krāsojumu nevar novērtēt. Kārba jāpārbauda aukstā startā.",
    );
    expect(out).toMatch(/Hidrotransformators/);
    expect(out).toMatch(/Kārba/);
    expect(out).not.toMatch(/aplīm|plēv/i);
  });
});

describe("findCopiedOtherAuditPhrases", () => {
  it("flags an eight-word phrase copied from another audit", () => {
    const foreign =
      "Kreisā puse pēc remonta paliek ar nesamērīgi biezu krāsu un šuvju nobīdi pret rūpnīcas paneļiem.";
    const prompt = `${OTHER_AUDIT_STYLE_HEADING}
**1. Tehnisko risku analīze:** ${foreign}

### CSDD
AUDI Q7 bez virsbūves piezīmēm.

---

Sagatavo analīzi.`;
    const leaks = findCopiedOtherAuditPhrases(foreign, prompt, "AUDI Q7 bez virsbūves piezīmēm.");
    expect(leaks.length).toBeGreaterThan(0);
  });

  it("does not flag a phrase that is already in this order's facts", () => {
    const fact = "Sludinājumā rakstīts ka priekšējais bamperis ir krāsots pēc stāvvietas berzes.";
    const prompt = `### Sludinājuma analīze
${fact}

${OTHER_AUDIT_STYLE_HEADING}
**1. Tehnisko risku analīze:** ${fact}

---

Sagatavo analīzi.`;
    expect(findCopiedOtherAuditPhrases(fact, prompt, fact)).toEqual([]);
  });
});

describe("generation must not inherit another car's wrap", () => {
  it("treats wrap only in other-audit memory as not this car's fact", () => {
    const prompt = `### CSDD
BMW 320d.

${OTHER_AUDIT_STYLE_HEADING}
**1. Tehnisko risku analīze:** Automašīna ir aplīmēta ar plēvi, zem tās krāsojumu nevar novērtēt.

---

Sagatavo kopsavilkumu.`;
    expect(mentionsVehicleWrapInOrderFacts(prompt)).toBe(false);
    const issues = evaluateExpertCommentQuality(
      "Kopējā aina\nAutomašīna ir aplīmēta ar plēvi, tāpēc krāsojumu zem tās nevar novērtēt bez demontāžas.\n\nRekomendācija\nIeteicams turpināt pēc klātienes pārbaudes.",
      { field: "summary", sourcePrompt: prompt },
    );
    expect(issues.some((i) => i.code === "wrap_film_invented")).toBe(true);
  });
});

describe("extractOtherAuditMemoryFromPrompt", () => {
  it("keeps only other-audit headings", () => {
    const prompt = `### CSDD
Q7

${OTHER_AUDIT_STYLE_HEADING}
svešs teksts

### Nobraukums
lineārs`;
    const mem = extractOtherAuditMemoryFromPrompt(prompt);
    expect(mem).toMatch(/svešs teksts/);
    expect(mem).not.toMatch(/lineārs/);
  });
});
