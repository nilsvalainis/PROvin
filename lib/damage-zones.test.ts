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

  it("atpazīst pdf.js izgrieztu Labā priekšējā daļa", () => {
    const hits = parseDamageZoneHits("Labā priek š ējā da ļ a / Buferis Labā puse / Priekšējās durvis");
    expect(hits.map((h) => h.id).sort()).toEqual(["front_right", "right"]);
  });

  it("atpazīst Labais sāns kā labo pusi", () => {
    const hits = parseDamageZoneHits("Labā sāna priekšpuse Labais sāns");
    expect(hits.map((h) => h.id).sort()).toEqual(["front_right", "right"]);
  });

  it("atpazīst Jumts un priekšpusi pa labi", () => {
    const hits = parseDamageZoneHits(
      "Jumts / Virs-virsbūve Priekšpuse (Pa labi / Buferis) Labais priekšējais spārns",
    );
    expect(hits.map((h) => h.id)).toEqual(expect.arrayContaining(["front_right", "roof"]));
  });
});

describe("buildDamageZoneSilhouetteSvg", () => {
  it("iezīmē aktīvās zonas zilā tonī, apgrieztas pēc virsbūves kontūras", () => {
    const svg = buildDamageZoneSilhouetteSvg(["front", "front_left"], "t1");
    expect(svg).toContain('class="pdf-dmg-sil"');
    expect(svg).toContain("#B7D1F5");
    expect(svg).not.toContain("#ef4444");
    expect(svg).toContain('clip-path="url(#dmg-body-t1)"');
    expect(svg).not.toContain("PROVIN");
    expect(svg).not.toContain("pdfDmgHatch");
    expect((svg.match(/pdf-dmg-zone--on/g) ?? []).length).toBe(2);
  });

  it("nezīmē neaktīvās zonas", () => {
    const svg = buildDamageZoneSilhouetteSvg([], "t2");
    expect(svg).not.toContain("pdf-dmg-zone");
  });
});
