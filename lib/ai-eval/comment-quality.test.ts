import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  evaluateExpertCommentQuality,
  mentionsVehicleWrapInOrderFacts,
  type CommentQualityOptions,
} from "@/lib/ai-eval/comment-quality";

type Fixture = {
  id: string;
  field: CommentQualityOptions["field"];
  expectPass: boolean;
  codes?: string[];
  wrapPresentInContext?: boolean;
  winterSaltRustRequiredInContext?: boolean;
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

### Vēsturiskie PROVIN auditi ar līdzīgiem agregātiem (BMW 320d)
#### Atsauce 1
**1. Tehnisko risku analīze:** Automašīna ir aplīmēta ar plēvi, zem tās krāsojumu nevar novērtēt.

### Nobraukums
Lineārs, bez vakuuma.

---

Sagatavo kopsavilkumu.`;
    expect(mentionsVehicleWrapInOrderFacts(prompt)).toBe(false);
  });
});
