/**
 * FABLE 25.10: jaunā IRISS pasūtījuma telefona skatā "+" (Jauns piedāvājums) bija 11 px plats, un virs
 * specifikācijas bija tukša kartīte (sludinājumu saišu rinda bez saitēm).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildListingPlatformChips } from "@/lib/iriss-listing-links";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const editor = readFileSync("components/admin/IrissPasutijumsEditor.tsx", "utf8");

describe("IRISS pasūtījums telefonā: piedāvājumu čipi", () => {
  it("P1/P2/+ čipiem pieskāriena mērķis vismaz 44x44", () => {
    const line = editor.split("\n").find((l) => l.startsWith("const offerPChipButtonClass"));
    expect(line).toMatch(/min-h-11/);
    expect(line).toMatch(/min-w-11/);
  });

  it("jaunam pasūtījumam bez saitēm saišu kartīte netiek rādīta", () => {
    expect(buildListingPlatformChips(emptyIrissPasutijums("ord_new", "2026-10-25T10:00:00.000Z"))).toHaveLength(0);
    expect(editor).toMatch(/buildListingPlatformChips\(rec\)\.length > 0 \? \(\s*<section className=\{shellCard\}>\s*<IrissListingPlatformChipsRow/);
  });
});
