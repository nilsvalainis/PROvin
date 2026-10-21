import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { displayUsdAsEur } from "@/lib/currency-eur-convert";

const BLOCKS = ["components/admin/AdminAsvSourceBlock.tsx", "components/admin/AdminCcVinSourceBlock.tsx"];

function typeInto(target: string, onKey: (v: string) => string): string {
  let v = "";
  for (const ch of target) v = onKey(v + ch);
  return v;
}

describe("USD → EUR summas laukos: pārrēķins pēc ievades (blur), ne katrā taustiņā", () => {
  it("pārrēķins katrā taustiņā sabojā „$12,400” (iemesls labojumam)", () => {
    expect(typeInto("$12,400", displayUsdAsEur)).toBe("1 €2,400");
  });

  it("neapstrādāta ievade + blur dod pareizu eiro summu", () => {
    for (const raw of ["$12,400", "USD 12 400", "12 400 USD", "12400$"]) {
      const typed = typeInto(raw, (v) => v);
      expect(typed).toBe(raw);
      expect(displayUsdAsEur(typed)).toBe("11 410 €");
    }
  });

  it("blur uz jau eiro summas neko nemaina", () => {
    expect(displayUsdAsEur("11 410 €")).toBe("11 410 €");
  });

  it.each(BLOCKS)("%s nepārrēķina onChange laikā", (rel) => {
    const src = readFileSync(path.join(process.cwd(), rel), "utf8");
    expect(src).not.toMatch(/displayUsdAsEur\(next\)/);
    expect(src).not.toMatch(/displayUsdAsEur\(row\./);
    expect(src.match(/normalizeOnBlur: displayUsdAsEur/g)?.length).toBe(2);
  });
});
