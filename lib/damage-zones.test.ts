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

  it("atpazīst Jumts un priekšpusi pa labi", () => {
    const hits = parseDamageZoneHits(
      "Jumts / Virs-virsbūve Priekšpuse (Pa labi / Buferis) Labais priekšējais spārns",
    );
    expect(hits.map((h) => h.id)).toEqual(expect.arrayContaining(["front_right", "roof"]));
  });
});

describe("buildDamageZoneSilhouetteSvg", () => {
  it("iezīmē aktīvās zonas sarkanā krāsā bez zīmola uzraksta", () => {
    const svg = buildDamageZoneSilhouetteSvg(["front", "front_left"], "t1");
    expect(svg).toContain('class="pdf-dmg-sil"');
    expect(svg).toContain("#ef4444");
    expect(svg).not.toContain("PROVIN");
    expect(svg).not.toContain("pdfDmgHatch");
    expect((svg.match(/pdf-dmg-zone--on/g) ?? []).length).toBe(2);
  });
});
