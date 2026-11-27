import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 27.11 (Nils): AUDITS rīkjoslā soļu (avotu bloku) pārslēdzējs saspiedās līdz punktiem,
 * VIN kartīte tika nogriezta, «1. Pielikumi» pogu rindā «Klienta valoda» čips izgāja ārpus malas.
 */
const src = readFileSync(path.resolve(__dirname, "OrderDetailWorkspace.tsx"), "utf8");

describe("pasūtījuma rīkjoslas platums", () => {
  it("soļu pārslēdzējam garantēts minimālais platums (pārlūzt jaunā rindā, nevis saspiežas)", () => {
    expect(src).toMatch(/order-1 flex min-w-0 flex-1 flex-col gap-1 md:min-w-\[34rem\]/);
  });

  it("VIN kartīte nesaspiežas un netiek nogriezta", () => {
    expect(src).toMatch(/order-3 ml-auto hidden max-w-full flex-none flex-col/);
  });

  it("AI izmaksu teksts šaurā ekrānā paslēpts", () => {
    expect(src).toMatch(/<span className="max-xl:hidden">\s*<AdminAiSessionCostBar \/>/);
  });

  it("«1. Pielikumi» pogas pārnesas jaunā rindā jebkurā platumā", () => {
    expect(src).toContain('<div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">');
    expect(src).not.toContain("flex shrink-0 flex-wrap items-center gap-1.5 max-sm:min-w-0");
  });
});
