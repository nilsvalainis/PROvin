import { describe, expect, it } from "vitest";
import {
  buildDamageZoneSilhouetteSvg,
  damageGroupDisplayLabels,
  damageZoneDisplayLabels,
  parseDamageZoneHits,
  resolveDamageMarks,
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

describe("resolveDamageMarks", () => {
  it("AutoDNA zonas paliek sektori, ne buferis/kapote/bagāžnieks", () => {
    const marks = resolveDamageMarks(
      ["front", "front_left", "front_right", "rear"],
      ["Priekšpuse", "Labā sāna priekšpuse", "Kreisā sāna priekšpuse", "Aizmugure"],
    );
    expect(marks.panels).toEqual([]);
    expect(marks.zones.sort()).toEqual(["front", "front_left", "front_right", "rear"]);
  });

  it("CarVertical Buferis iekrāso tikai buferi", () => {
    const marks = resolveDamageMarks(
      ["front", "front_right"],
      ["Priekšpuse / Buferis", "Labā priekšējā daļa / Buferis"],
    );
    expect(marks.panels).toEqual(["front_bumper"]);
    expect(marks.zones).toEqual([]);
  });

  it("iekrāso aizmugurējo buferi no Aizmugure / Buferis, ne bagāžnieku", () => {
    const marks = resolveDamageMarks(["rear"], ["Aizmugure / Buferis"]);
    expect(marks.panels).toEqual(["rear_bumper"]);
    expect(marks.zones).toEqual([]);
  });

  it("sašaurina sānu līdz nosauktajām durvīm", () => {
    const marks = resolveDamageMarks(["right"], ["Labā puse / Priekšējās durvis"]);
    expect(marks.panels).toEqual(["front_right_door"]);
    expect(marks.zones).toEqual([]);
  });
});

describe("buildDamageZoneSilhouetteSvg", () => {
  it("iezīmē AutoDNA sektoru ar sarkanām šķērssvītrām uz foto auto", () => {
    const svg = buildDamageZoneSilhouetteSvg(["front_left"], "t1");
    expect(svg).toContain('class="pdf-dmg-sil"');
    expect(svg).toContain("#DC2626");
    expect(svg).toContain("dmg-hatch-t1");
    expect(svg).not.toContain("#B7D1F5");
    expect(svg).toContain('data-zone="front_left"');
    expect(svg).not.toContain('data-zone="front_left_fender"');
    expect((svg.match(/pdf-dmg-zone--on/g) ?? []).length).toBe(1);
  });

  it("nezīmē neaktīvās zonas", () => {
    const svg = buildDamageZoneSilhouetteSvg([], "t2");
    expect(svg).not.toContain("pdf-dmg-zone");
  });

  it("nosaucot durvis, iekrāso durvis, ne rupjo priekšpusi", () => {
    const svg = buildDamageZoneSilhouetteSvg(["front", "front_left_door"], "panel-1", "panels", [
      "Kreisā puse / Priekšējās durvis",
    ]);
    expect(svg).toContain('class="pdf-dmg-sil"');
    expect(svg).not.toContain('data-zone="front_bumper"');
    expect(svg).not.toContain('data-zone="hood"');
    expect(svg).toContain('data-zone="front_left_door"');
    expect((svg.match(/pdf-dmg-zone--on/g) ?? []).length).toBe(1);
  });

});

describe("damageGroupDisplayLabels", () => {
  it("nogriež PDF kājeni no jau saglabātas grupas rindas", () => {
    const labels = damageGroupDisplayLabels(
      "Ārējās virsbūves detaļasVIN numurs: WBAVT11010KW00321 Ģenerēšanas datums:",
    );
    expect(labels).toEqual(["Ārējās virsbūves detaļas"]);
  });

  it("atdala salīmētas grupas un noņem AutoDNA kodu 01", () => {
    const labels = damageGroupDisplayLabels(
      "Virsbūves ārējās daļas Ārējās virsbūves detaļas 01 Virsbūves ārējās daļas · Ārējās virsbūves detaļas",
    );
    expect(labels).toEqual(["Virsbūves ārējās daļas", "Ārējās virsbūves detaļas"]);
  });

  it("nogriež CarVertical «līdzīgs ieraksts» un mūsu kopsavilkuma virsrakstu", () => {
    const labels = damageGroupDisplayLabels(
      "Ārējās virsbūves detaļas 1 līdzīgs ieraksts NEGADĪJUMU VĒSTURES KOPSAVILKUMS Fiksētie incidenti un datu saskaņotība AutoDNA un CarVertical",
    );
    expect(labels).toEqual(["Ārējās virsbūves detaļas"]);
    expect(labels.join(" ")).not.toMatch(/līdzīg/i);
    expect(labels.join(" ")).not.toMatch(/NEGADĪJUMU/i);
    expect(labels.join(" ")).not.toMatch(/saskaņot/i);
  });
});
