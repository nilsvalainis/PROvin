import { describe, expect, it } from "vitest";
import {
  buildDamageZoneSilhouetteSvg,
  damageGroupDisplayLabels,
  damageZoneDisplayLabels,
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

  it("atpazīst aizmuguri, kreiso sānu un lukturus pēc tās pašas sadaļas principa", () => {
    const hits = parseDamageZoneHits(
      "Kreisā puse / Aizmugurējās durvis Aizmugure / Buferis Priekšpuse / Lukturi",
    );
    expect(hits.map((h) => h.id).sort()).toEqual(["front", "rear", "rear_left"]);
    const labels = damageZoneDisplayLabels(
      "Kreisā puse / Aizmugurējās durvis Aizmugure / Buferis Priekšpuse / Lukturi",
    );
    expect(labels.join(" ")).toMatch(/Aizmugurējās durvis/i);
    expect(labels.join(" ")).toMatch(/Lukturi/i);
    expect(labels.join(" ")).toMatch(/Buferis/i);
  });

  it("patur avota detaļas, kas nav silueta zona (piem. apgaismojums bez puses)", () => {
    const hits = parseDamageZoneHits("Ārējais apgaismojums");
    expect(hits).toEqual([]);
    expect(damageZoneDisplayLabels("Ārējais apgaismojums")).toEqual(["Ārējais apgaismojums"]);
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
    expect((svg.match(/pdf-dmg-zone--on/g) ?? []).length).toBe(3);
  });

  it("nezīmē neaktīvās zonas", () => {
    const svg = buildDamageZoneSilhouetteSvg([], "t2");
    expect(svg).not.toContain("pdf-dmg-zone");
  });

  it("panel scheme highlights each body panel, not a single blob", () => {
    const svg = buildDamageZoneSilhouetteSvg(["front", "front_left_door"], "panel-1", "panels");
    expect(svg).toContain('class="pdf-dmg-sil"');
    expect(svg).toContain('data-zone="front_bumper"');
    expect(svg).toContain('data-zone="hood"');
    expect(svg).toContain('data-zone="front_left_door"');
    expect((svg.match(/pdf-dmg-zone--on/g) ?? []).length).toBe(3);
    expect(svg).toContain("dmg-body-panel-1");
  });

});

describe("damageGroupDisplayLabels", () => {
  it("nogriež PDF kājeni no jau saglabātas grupas rindas", () => {
    const labels = damageGroupDisplayLabels(
      "Ārējās virsbūves detaļasVIN numurs: WBAVT11010KW00321 Ģenerēšanas datums:",
    );
    expect(labels).toEqual(["Ārējās virsbūves detaļas"]);
  });
});
