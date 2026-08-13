import { describe, expect, it } from "vitest";
import {
  buildDamageZoneSilhouetteSvg,
  parseDamageZoneHits,
} from "@/lib/damage-zones";

describe("parseDamageZoneHits", () => {
  it("atpazīst AutoDNA priekšpuses zonas, nesapludinot tās vispārīgajā priekšpusē", () => {
    const hits = parseDamageZoneHits(
      "Priekšpuse Labā sāna priekšpuse Kreisā sāna priekšpuse",
    );
    expect(hits.map((h) => h.id).sort()).toEqual(["front", "front_left", "front_right"]);
  });

  it("atpazīst CarVertical priekšējās daļas un priekšpusi", () => {
    const hits = parseDamageZoneHits(
      "Kreisā priekšējā daļa / Buferis Priekšpuse / Buferis Labā priekšējā daļa / Buferis",
    );
    expect(hits.map((h) => h.id).sort()).toEqual(["front", "front_left", "front_right"]);
  });

  it("atpazīst Kreisā puse un Priekšpuse kā atsevišķas zonas", () => {
    const hits = parseDamageZoneHits("Kreisā puse Priekšpuse");
    expect(hits.map((h) => h.id).sort()).toEqual(["front", "left"]);
  });
});

describe("buildDamageZoneSilhouetteSvg", () => {
  it("iezīmē aktīvās zonas ar zīmola šķērsējumu", () => {
    const svg = buildDamageZoneSilhouetteSvg(["front", "front_left"], "t1");
    expect(svg).toContain('class="pdf-dmg-sil"');
    expect(svg).toContain("pdfDmgHatch-t1");
    expect(svg).toContain("PROVIN");
    expect((svg.match(/url\(#pdfDmgHatch-t1\)/g) ?? []).length).toBe(2);
  });
});
