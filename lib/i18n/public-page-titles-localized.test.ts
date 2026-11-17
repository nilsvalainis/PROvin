import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import lvMisc from "@/messages/lv/misc.json";
import enMisc from "@/messages/en/misc.json";
import dePartner from "@/messages/de/partner.json";

/** FABLE v3 F7: /en|de|ru lapās nebija LV virsrakstu («PROVIN partneru reģistrācija», 404 «Lapa nav atrasta»). */
describe("publisko lapu virsraksti nav LV hibrīdi citās valodās", () => {
  const files = [
    ...globSync("app/[[]locale]/partneriem/**/page.tsx"),
    "app/[locale]/not-found.tsx",
  ];

  it("partneru un 404 lapās nav cietā LV teksta", () => {
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/title: "PROVIN partner|Lapa nav atrasta|PROVIN sākumlapa/);
    }
  });

  it("tulkojumi eksistē", () => {
    expect(lvMisc.Misc.notFoundTitle).toBe("Lapa nav atrasta");
    expect(enMisc.Misc.notFoundTitle).toBe("Page not found");
    expect(dePartner.Partner.metaRegisterTitle).toBe("PROVIN Partnerregistrierung");
  });
});
