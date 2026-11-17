import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { evaluateExpertCommentQuality, type CommentQualityOptions } from "@/lib/ai-eval/comment-quality";
import { createDefaultSourceBlocks, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import { finalizeProvinExpertAiComment } from "@/lib/source-summary-comment-format";

type Row = { date: string; odometer: string; country: string };
type Fixture = {
  vin: string;
  csdd: { prevInspectionOdometer: string; mileageHistory: Row[] };
  listingCreated: string;
  sources: { autodna: Row[]; carvertical: Row[] };
  comments: Array<{
    id: string;
    field: CommentQualityOptions["field"];
    focus?: string;
    text: string;
    expectCodes?: string[];
    expectNone?: string[];
  }>;
};

const fx = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/bmw-540d-g31-regression.json"), "utf8"),
) as Fixture;

function blocks(): WorkspaceSourceBlocks {
  const b = createDefaultSourceBlocks();
  b.csdd = {
    ...b.csdd,
    makeModel: "BMW 540d",
    mileageHistory: fx.csdd.mileageHistory,
    prevInspectionBlock: { ...b.csdd.prevInspectionBlock, odometer: fx.csdd.prevInspectionOdometer },
  };
  b.tirgus = { ...b.tirgus, listingCreated: fx.listingCreated };
  b.autodna = { ...b.autodna, serviceHistory: fx.sources.autodna } as typeof b.autodna;
  b.carvertical = { ...b.carvertical, serviceHistory: fx.sources.carvertical } as typeof b.carvertical;
  return b;
}

function promptFor(focus: string | undefined, sheet: string, focusText: string): string {
  return [
    focus ? `Avota sadaļa (fokuss): ${focus}` : "Lauks: test",
    sheet,
    focus ? `=== Konkrētā avota „${focus}” dati (bez esošajiem komentāriem) ===\n${focusText}\n\nSagatavo komentāru TIKAI šai avota sadaļai.` : "",
  ].join("\n");
}

describe("BMW 540d G31 regresija (1.-4. posms)", () => {
  const facts = buildCanonicalFacts({ vin: fx.vin, sourceBlocks: blocks() });

  it("fikstūra ir anonimizēta (VIN maskēts)", () => {
    expect(fx.vin).toMatch(/\*/);
  });

  it("faktu lapa: nav „Kritums”, izolēta ievades kļūda, CSDD rādījums aptuveni 09.2026", () => {
    expect(facts.rollbacks).toHaveLength(0);
    expect(facts.suspectedEntryErrors).toHaveLength(1);
    expect(facts.sheet).not.toMatch(/- Kritums:/);
    expect(facts.sheet).toMatch(/211 988 km, aptuveni 09\.2026/);
  });

  for (const c of fx.comments) {
    it(`${c.id}`, () => {
      const csddText = `Odometra rādījums: ${fx.csdd.prevInspectionOdometer}`;
      const issues = evaluateExpertCommentQuality(c.text, {
        field: c.field,
        sourcePrompt: promptFor(c.focus, facts.sheet, c.focus === "CSDD" ? csddText : ""),
      });
      const codes = issues.map((i) => i.code);
      for (const code of c.expectCodes ?? []) expect(codes, JSON.stringify(codes)).toContain(code);
      for (const code of c.expectNone ?? []) expect(codes, JSON.stringify(codes)).not.toContain(code);
      // Jaunie karodziņi nekad neiedarbina maksas atkārtojumu.
      expect(codes.some((x) => x === "canonical_rollback_omitted")).toBe(false);
    });
  }

  it("salauztais eļļas virsraksts pēc formatētāja paliek vesels", () => {
    const out = finalizeProvinExpertAiComment(
      "<strong>Eļļas maiņas intervāli un faktiskā vēsture</strong><br>Ražotāja intervāls: 30 000 km / 24 mēn.",
    );
    expect(out.split("\n")[0]).toBe("Eļļas maiņas intervāli un faktiskā vēsture");
    expect(evaluateExpertCommentQuality(out, { field: "source_dealer" }).map((i) => i.code)).not.toContain(
      "heading_fragment",
    );
  });
});
