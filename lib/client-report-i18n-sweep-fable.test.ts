/**
 * FABLE 25.10: EN/RU/DE atskaitēs sweep aizvietoja vārda daļu ("Virsbūve" iekš "Virsbūves" -> "Bodys", "Кузовs"),
 * krāsas biezuma bloks palika LV, frāzes ar skaitļiem un valstis palika LV.
 */
import { describe, expect, it } from "vitest";
import { applyClientReportDynamicTranslations } from "@/lib/client-report-dynamic-i18n";
import { applyClientReportStaticTranslations } from "@/lib/client-report-i18n";
import { PAINT_GAUGE_STATIC_HTML } from "@/lib/paint-gauge-static-block";

const doc = (body: string) => `<!DOCTYPE html><html lang="lv"><head><style>.x{content:"Vācija"}</style></head><body>${body}</body></html>`;
const sweep = (html: string, lang: "en" | "ru" | "de") =>
  applyClientReportDynamicTranslations(applyClientReportStaticTranslations(html, lang), lang);

describe("PDF tulkojuma sweep", () => {
  it("neaizvieto vārda daļu (nav hibrīdvārdu)", () => {
    const html = doc("<p>Virsbūves krāsa</p><p>Virsbūve</p>");
    expect(sweep(html, "en")).not.toContain("Bodys");
    expect(sweep(html, "ru")).not.toContain("Кузовs");
    expect(sweep(html, "en")).toContain("<p>Body</p>");
  });

  it("krāsas biezuma statiskais bloks tiek pilnībā iztulkots", () => {
    const html = doc(PAINT_GAUGE_STATIC_HTML);
    expect(sweep(html, "en")).toContain("Body condition and paint thickness");
    expect(sweep(html, "en").split("<body>")[1]).not.toMatch(/[āčēģīķļņšūž]/);
    expect(sweep(html, "ru")).toContain("Состояние кузова и толщина ЛКП");
    expect(sweep(html, "de")).toContain("Karosseriezustand und Lackschichtdicke");
  });

  it("frāzes ar skaitļiem un valstis teksta mezglos; atribūti/CSS netiek aiztikti", () => {
    const html = doc(
      '<p data-c="Vācija">Vācija</p><p>3 ieraksti bez pretrunām</p><p>Aptuveni 29 mēneši bez ierakstiem</p><p>2. īpašnieks Latvijā</p><p>Latvijā 1 / ārvalstīs 3</p>',
    );
    const en = sweep(html, "en");
    expect(en).toContain(">Germany<");
    expect(en).toContain('data-c="Vācija"');
    expect(en).toContain('content:"Vācija"');
    expect(en).toContain("3 records, consistent");
    expect(en).toContain("About 29 months without records");
    expect(en).toContain("Owner no. 2 in Latvia");
    expect(en).toContain("Latvia 1 / abroad 3");
    expect(sweep(html, "de")).toContain(">Deutschland<");
    expect(sweep(html, "ru")).toContain(">Германия<");
  });

  it("LV nemainās", () => {
    const html = doc("<p>Vācija</p><p>3 ieraksti bez pretrunām</p>");
    expect(applyClientReportDynamicTranslations(applyClientReportStaticTranslations(html, "lv"), "lv")).toBe(html);
  });
});
