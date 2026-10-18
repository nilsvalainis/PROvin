import { describe, expect, it } from "vitest";
import {
  applyFactCheckFixToField,
  factCheckActionLine,
  factCheckLevelLabel,
  suggestFactCheckFix,
} from "@/lib/fact-check-suggested-fix";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

function flag(partial: Partial<FactCheckFlag> & Pick<FactCheckFlag, "id" | "kind" | "message" | "sentence">): FactCheckFlag {
  return { level: "E", ...partial };
}

describe("fact-check suggested fix", () => {
  it("uses Latvian level labels", () => {
    expect(factCheckLevelLabel("E")).toBe("Kļūda");
    expect(factCheckLevelLabel("W")).toBe("Jāpārbauda");
  });

  it("appends a rollback sentence without dropping heading or bold", () => {
    const f = flag({
      id: "rollback_omitted",
      kind: "rollback_omitted",
      message: "Nobraukuma datos ir odometra kritums (90 000 km) un/vai CarVertical brīdinājums, bet šis komentārs to nepiemin.",
      sentence: "Nobraukuma līkne izskatās lineāra.",
    });
    const suggestion = suggestFactCheckFix(f);
    expect(suggestion?.preview).toMatch(/odometra kritums \(90 000 km\)/);
    expect(suggestion?.preview).toMatch(/CarVertical/);
    expect(suggestion?.preview).not.toMatch(/\u2013|\u2014/);
    expect(factCheckActionLine(f)).toMatch(/kritumu/);

    const html = "<p><strong>Nobraukums</strong></p><p>Līkne izskatās lineāra.</p>";
    const next = applyFactCheckFixToField(html, f);
    expect(next).toContain("<strong>Nobraukums</strong>");
    expect(next).toContain("Līkne izskatās lineāra.");
    expect(next).toContain("odometra kritums");
  });

  it("replaces owner count and keeps surrounding markup", () => {
    const f = flag({
      id: "owner_count",
      kind: "owner_count",
      message: "Teksts saka 4 īpašniekus, kanoniskā lapa: 3 (LV 3).",
      sentence: "Latvijā fiksēti 4 īpašnieki.",
    });
    const next = applyFactCheckFixToField(
      "<p><strong>Īpašnieki</strong></p><p>Latvijā fiksēti 4 īpašnieki.</p>",
      f,
    );
    expect(next).toContain("<strong>Īpašnieki</strong>");
    expect(next).toContain("3 īpašnieki");
    expect(next).not.toContain("4 īpašnieki");
  });

  it("does not invent a fix when there is no template", () => {
    const f = flag({
      id: "unsourced_date",
      kind: "unsourced_date",
      level: "W",
      message: "Datums 03.11.2021 nav avota datos / kanoniskajā lapā.",
      sentence: "Serviss 03.11.2021.",
    });
    expect(suggestFactCheckFix(f)).toBeNull();
    expect(applyFactCheckFixToField("<p>Serviss 03.11.2021.</p>", f)).toBe("<p>Serviss 03.11.2021.</p>");
  });
});
