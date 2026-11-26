/**
 * 25.11.2026: EN/RU/DE klienta PDF palika latviešu teksts (6a kartītes «3 ieraksti», «Nav ierakstu»,
 * CARFAX bloks, CSDD vērtības, TA vērtējumi, LTAB izziņa, eļļas intervāli). Pastāvīga sargtests:
 * bagāts payload visās valodās - ne-LV versijā nav latviešu atlieku, izņemot «(oriģināls)» tekstus.
 * 25.11 (2. kārta): arī CSDD TA defektu un «Piezīmes» standarta teikumi tulkoti bez AI (csdd-ta-defects-i18n).
 */
import { describe, expect, it } from "vitest";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { translateClientReportLvTerms } from "@/lib/client-report-lv-terms-i18n";
import {
  lvResiduePayload,
  lvResiduePhotoMap,
  lvResidueSparsePayload,
} from "@/lib/client-report-lv-residue.fixtures";
import {
  applyClientReportTranslatedTexts,
  collectClientReportTranslatableTexts,
} from "@/lib/client-report-translatable-fields";
import { csddTaDefectSentencesLv, translateCsddTaDefectText } from "@/lib/csdd-ta-defects-i18n";

const LV_DIACRITIC = /[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/;
const LV_WORD = /(?<![\p{L}\p{N}])(ieraksts|ieraksti|ierakstu|nav|dienas|dienu|mēn|pēdējais|apkopju|kopš|uzskaitē|izsoles|īpašnieki)(?![\p{L}\p{N}])/iu;

/** Pirmais gājiens reālajā plūsmā: AI iztulko komentārus u.c. brīvo tekstu (sk. translateClientReportPayloadForPrint). */
function withTranslatedFreeText(p: ClientReportPayload): ClientReportPayload {
  const texts = collectClientReportTranslatableTexts(p);
  for (const k of Object.keys(texts)) texts[k] = "Translated text.";
  return applyClientReportTranslatedTexts(p, texts);
}

function render(p: ClientReportPayload, lang: ClientReportLang): string {
  return buildClientReportDocumentHtml({
    payload: lang === "lv" ? p : withTranslatedFreeText(p),
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
    ccVinPhotoDataUrls: lvResiduePhotoMap(),
    lang,
  });
}

function textNodes(html: string): string[] {
  const body = html.slice(html.indexOf("<body")).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  return [...body.matchAll(/>([^<]+)</g)]
    .map((m) => m[1]!.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Avota oriģināls: tekstā ar «(oriģināls)». */
function isSourceOriginal(text: string): boolean {
  return /\(oriģināls\)/i.test(text);
}

function lvResidue(html: string): string[] {
  return [...new Set(textNodes(html).filter((t) => (LV_DIACRITIC.test(t) || LV_WORD.test(t)) && !isSourceOriginal(t)))];
}

const VARIANTS: Record<string, () => ClientReportPayload> = {
  pilna: () => lvResiduePayload(),
  merijumi: () => lvResiduePayload({ measurements: true }),
  izvilkums: () => lvResiduePayload({ izvilkums: true }),
  tuksa: () => lvResidueSparsePayload(),
  dilera: () => ({ ...lvResiduePayload(), pdfReportKind: "dealer" }) as ClientReportPayload,
};

describe("klienta PDF EN/RU/DE - nav latviešu atlieku", () => {
  for (const lang of ["en", "ru", "de"] as const) {
    for (const [name, make] of Object.entries(VARIANTS)) {
      it(`${lang} / ${name}`, () => {
        expect(lvResidue(render(make(), lang))).toEqual([]);
      });
    }
  }

  it("LV versijā bagātais payload patiešām satur pārbaudāmos LV tekstus (tests nav tukšs)", () => {
    const lv = textNodes(render(lvResiduePayload(), "lv"));
    for (const s of ["3 bojājumu ieraksti", "4 ieraksti", "Ātrā pārbaude", "Iepriekšējie meklējumi", "LTAB datubāzē negadījumi nav reģistrēti", "Datu iztrūkums"]) {
      expect(lv).toContain(s);
    }
    expect(textNodes(render(lvResidueSparsePayload(), "lv"))).toEqual(
      expect.arrayContaining(["Nav ierakstu", "Apkopju ieraksti nav atrasti"]),
    );
  });

  it.each([
    ["en", "4 records", "3 damage records", "No maintenance records found"],
    ["ru", "4 зап.", "3 зап. о повреждениях", "Записи о ТО не найдены"],
    ["de", "4 Einträge", "3 Schadenseinträge", "Keine Wartungseinträge gefunden"],
  ] as const)("%s: 6a kartīšu vērtības tulkotas", (lang, service, damage, noService) => {
    expect(textNodes(render(lvResiduePayload(), lang))).toEqual(expect.arrayContaining([service, damage]));
    expect(textNodes(render(lvResidueSparsePayload(), lang))).toContain(noService);
  });
});

describe("translateClientReportLvTerms", () => {
  it("kartīšu vērtības un šabloni", () => {
    expect(translateClientReportLvTerms("3 ieraksti", "en")).toBe("3 records");
    expect(translateClientReportLvTerms("1 ieraksts", "de")).toBe("1 Eintrag");
    expect(translateClientReportLvTerms("Nav ierakstu", "ru")).toBe("Нет записей");
    expect(translateClientReportLvTerms("Bez neatbilstībām", "de")).toBe("Ohne Abweichungen");
    expect(translateClientReportLvTerms("Apkopju ieraksti nav atrasti", "en")).toBe("No maintenance records found");
    expect(translateClientReportLvTerms("Pēdējais 16.09.2026 · 15 ieraksti", "en")).toBe("Latest 16.09.2026 · 15 records");
    expect(translateClientReportLvTerms("17.07.2026 · pamatpārbaude · Novērtējums 2 - Ar mēneša laikā labojamiem defektiem", "de")).toBe(
      "17.07.2026 · Hauptuntersuchung · Bewertung 2 - Mit innerhalb eines Monats zu behebenden Mängeln",
    );
    expect(translateClientReportLvTerms("NĪDERLANDE", "en")).toBe("Netherlands");
    expect(translateClientReportLvTerms("Smagums: Vidējs", "ru")).toBe("Тяжесть: Средняя");
  });

  it("nezināms teksts un vārdu daļas netiek aiztikti; LV nemainās", () => {
    expect(translateClientReportLvTerms("Navigācija", "en")).toBe("Navigācija");
    expect(translateClientReportLvTerms("Mercedes-Benz Köln, DE-50667", "de")).toBe("Mercedes-Benz Köln, DE-50667");
    expect(translateClientReportLvTerms("Priekšējais tilts. Plaisas, lūzumi.", "en")).toBe("Priekšējais tilts. Plaisas, lūzumi.");
    expect(translateClientReportLvTerms("3 ieraksti", "lv")).toBe("3 ieraksti");
  });
});

describe("CSDD TA defektu teikumi", () => {
  it("fiksētie teikumi visās valodās, arī «- …» un «…» ietvarā", () => {
    expect(translateCsddTaDefectText("Priekšējais tilts. Plaisas, lūzumi, ievērojama korozija labās puses atsperojumā.", "en")).toBe(
      "Front axle. Cracks, fractures, significant corrosion of the right-hand suspension spring.",
    );
    expect(translateCsddTaDefectText("«Stāvbremze nedarbojas vienā pusē.»", "de")).toBe("«Feststellbremse auf einer Seite unwirksam.»");
    expect(translateCsddTaDefectText("- Nevar pieslēgties OBD, jo nesavienojas ar sistēmu.", "ru")).toBe(
      "- Не удаётся подключиться к OBD - нет связи с системой.",
    );
    expect(translateCsddTaDefectText("Priekšējais tilts. Palielināta brīvkustība balstiekārtas šarnīrā. Kreisais augšējais šarnīrs.", "de")).toBe(
      "Vorderachse. Übermäßiges Spiel im Achsgelenk. Linkes oberes Gelenk.",
    );
  });

  it("nezināms teikums - viss gabals paliek AI gājienam; LV - null", () => {
    expect(translateCsddTaDefectText("Priekšējais tilts. Nezināms defekts.", "en")).toBeNull();
    expect(translateCsddTaDefectText("Stāvbremze nedarbojas vienā pusē.", "lv")).toBeNull();
  });

  it("katram teikumam ir EN/RU/DE bez latviešu burtiem", () => {
    for (const lv of csddTaDefectSentencesLv()) {
      for (const lang of ["en", "ru", "de"] as const) {
        const out = translateCsddTaDefectText(lv, lang);
        expect(out, `${lang}: ${lv}`).not.toBeNull();
        expect(LV_DIACRITIC.test(out!), `${lang}: ${out}`).toBe(false);
      }
    }
  });
});
