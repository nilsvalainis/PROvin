import { describe, expect, it } from "vitest";
import {
  applyPaintGaugeStaticBlock,
  PAINT_GAUGE_STATIC_HEADING,
  PAINT_GAUGE_STATIC_PARAGRAPH,
} from "@/lib/paint-gauge-static-block";

describe("applyPaintGaugeStaticBlock", () => {
  it("appends the canonical heading and one paragraph to plain text", () => {
    const out = applyPaintGaugeStaticBlock("Jumta lūkas drenāža\nJāpārbauda paklāji.");
    expect(out).toContain("Jumta lūkas drenāža");
    expect(out).toContain(PAINT_GAUGE_STATIC_HEADING);
    expect(out).toContain("100 līdz 150 µm");
    expect(out).toContain("50 līdz 150 µm");
    expect(out).toContain(PAINT_GAUGE_STATIC_PARAGRAPH);
    expect(out).not.toMatch(/[\u2013\u2014]/);
  });

  it("replaces an older micron lecture with the static block", () => {
    const old = [
      "Virsbūves stāvoklis un krāsas biezums",
      "Digitālie dati var neuzrādīt krāsotus elementus. Rūpnīca 108-156 µm, starpība 50-100 µm.",
    ].join("\n");
    const out = applyPaintGaugeStaticBlock(old);
    expect(out).toContain("100 līdz 150 µm");
    expect(out).toContain("50 līdz 150 µm");
    expect(out).not.toMatch(/108-156/);
    expect(out).not.toMatch(/50-100 µm/);
  });

  it("does not rewrite stored comments twice when already canonical", () => {
    const first = applyPaintGaugeStaticBlock("Eļļas pēdas uz motora.");
    const second = applyPaintGaugeStaticBlock(first);
    expect(second.match(/Virsbūves stāvoklis un krāsas biezums/g)).toHaveLength(1);
  });

  it("injects HTML after existing rich paragraphs", () => {
    const out = applyPaintGaugeStaticBlock("<p><strong>Jumta lūka</strong></p><p>Jāpārbauda paklāji.</p>");
    expect(out).toContain("<strong>Virsbūves stāvoklis un krāsas biezums</strong>");
    expect(out).toContain("100 līdz 150");
  });
});
