import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  evaluateExpertCommentQuality,
  mentionsVehicleWrapInOrderFacts,
  type CommentQualityOptions,
} from "@/lib/ai-eval/comment-quality";
import { stripSummaryDualismOpener } from "@/lib/provin-banned-vocabulary";

type Fixture = {
  id: string;
  field: CommentQualityOptions["field"];
  expectPass: boolean;
  codes?: string[];
  wrapPresentInContext?: boolean;
  winterSaltRustRequiredInContext?: boolean;
  winterSaltTailgateMaterial?: CommentQualityOptions["winterSaltTailgateMaterial"];
  text: string;
};

const fixturesPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/golden-comments.json");
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8")) as Fixture[];

describe("ai-eval comment quality (golden fixtures)", () => {
  for (const fx of fixtures) {
    it(`${fx.id} (${fx.expectPass ? "pass" : "fail"})`, () => {
      const issues = evaluateExpertCommentQuality(fx.text, {
        field: fx.field,
        wrapPresentInContext: fx.wrapPresentInContext,
        winterSaltRustRequiredInContext: fx.winterSaltRustRequiredInContext,
        winterSaltTailgateMaterial: fx.winterSaltTailgateMaterial,
      });
      if (fx.expectPass) {
        expect(issues, JSON.stringify(issues)).toEqual([]);
      } else {
        expect(issues.length).toBeGreaterThan(0);
        if (fx.codes?.length) {
          for (const code of fx.codes) {
            expect(issues.some((i) => i.code === code)).toBe(true);
          }
        }
      }
    });
  }
});

describe("mentionsVehicleWrapInOrderFacts", () => {
  it("does not treat wrap-task instructions as a fact about this car", () => {
    const prompt = `### CSDD
AUDI Q7, pirmā reģistrācija 2016.

---

Sagatavo tehnisko risku analīzi.
OBLIGĀTI:
- WRAP_FILM: tikai ja ŠĪ pasūtījuma datos jau ir fiksēta aplīmēšana. Šī rinda NAV fakts par auto. Ja datos nav — par plēvi NERAKSTI.
- Ja kontekstā auto ir aplīmēts (plēve / PPF) — viena rindkopa.`;
    expect(mentionsVehicleWrapInOrderFacts(prompt)).toBe(false);
  });

  it("detects wrap from this order's listing or notes", () => {
    const prompt = `=== OPERATORA KOMANDAS ===
Auto ir aplīmēts ar tumšu plēvi.

### Sludinājuma analīze
Virsbūve aplīmēta, zem PPF krāsa nav redzama.

---

Sagatavo tehnisko risku analīzi.
OBLIGĀTI:
- Ja kontekstā auto ir aplīmēts — viena rindkopa.`;
    expect(mentionsVehicleWrapInOrderFacts(prompt)).toBe(true);
  });

  it("ignores wrap copied from another car's historical audit", () => {
    const prompt = `### CSDD
BMW 320d.

### Citu PROVIN auditu stils (NE šī auto fakti) — līdzīgi agregāti: BMW 320d
#### Atsauce 1
**1. Tehnisko risku analīze:** Automašīna ir aplīmēta ar plēvi, zem tās krāsojumu nevar novērtēt.

### Nobraukums
Lineārs, bez vakuuma.

---

Sagatavo kopsavilkumu.`;
    expect(mentionsVehicleWrapInOrderFacts(prompt)).toBe(false);
  });
});

describe("too_long vs operator paste", () => {
  it("does not flag too_long when the prompt contains a long operator paste", () => {
    const prompt = [
      "=== OPERATORA IELĪMĒTAIS TEKSTS (pilns saturs jāsaglabā) ===",
      "x".repeat(500),
      "=== BEIGAS OPERATORA IELĪMĒTAJAM TEKSTAM ===",
    ].join("\n");
    const long = "Nobraukuma līkne datos ir lineāra un pretrunas nav fiksētas. ".repeat(40);
    const issues = evaluateExpertCommentQuality(long, {
      field: "generic",
      sourcePrompt: prompt,
    });
    expect(issues.some((i) => i.code === "too_long")).toBe(false);
  });

  it("still flags too_long without operator material", () => {
    const long = "Nobraukuma līkne datos ir lineāra un pretrunas nav fiksētas. ".repeat(40);
    const issues = evaluateExpertCommentQuality(long, { field: "generic" });
    expect(issues.some((i) => i.code === "too_long")).toBe(true);
  });

  it("does not flag a typical multi-paragraph source comment as too_long", () => {
    const typical = "CSDD datos fiksēta pirmā reģistrācija Latvijā 2016. gadā un vairākas tehniskās apskates. ".repeat(25);
    expect(typical.length).toBeGreaterThan(1400);
    expect(typical.length).toBeLessThan(4000);
    const issues = evaluateExpertCommentQuality(typical, { field: "source" });
    expect(issues.some((i) => i.code === "too_long")).toBe(false);
  });
});

describe("stripSummaryDualismOpener", () => {
  it("deletes the canned dual-history opener and renames the old heading", () => {
    const raw = [
      "Kopējā aina",
      "Pēc pieejamajiem datiem, automašīnai ir caurskatāma, bet duāla vēsture. CSDD datos auto Latvijā reģistrēts 2016. gadā.",
      "",
      "Rekomendācija",
      "Ieteicams pirms darījuma pārbaudīt virsbūvi servisā.",
    ].join("\n");
    const out = stripSummaryDualismOpener(raw);
    expect(out).toMatch(/^Fakti/);
    expect(out).not.toMatch(/caurskatām/i);
    expect(out).not.toMatch(/duāl/i);
    expect(out).toMatch(/CSDD datos auto Latvijā reģistrēts 2016/);
    expect(out).toMatch(/Rekomendācija/);
  });
});

describe("sentence padding", () => {
  it("flags a leftover risk-label tail after the fact", () => {
    const issues = evaluateExpertCommentQuality(
      "N47 ķēde atrodas aizmugurē, tāpēc šis ir galvenais finansiālais un tehniskais pirkuma risks.",
      { field: "generic" },
    );
    expect(issues.some((i) => i.code === "sentence_padding")).toBe(true);
  });
});

describe("planning leak", () => {
  it("flags an English Internal Analysis preamble", () => {
    const issues = evaluateExpertCommentQuality(
      "I have analyzed the data.\n\nInternal Analysis & Plan:\nRisk Prioritization #1.\n\nSadales ķēde\nĶēde ir risks.",
      { field: "technical_risks" },
    );
    expect(issues.some((i) => i.code === "planning_leak")).toBe(true);
  });
});
