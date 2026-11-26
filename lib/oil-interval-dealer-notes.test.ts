import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock, type AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { oilIntervalNotesWithRequiredNotes, oilExceededIntervalsForBlock } from "@/lib/oil-change-interval-chart";
import {
  OIL_NOT_SKIPPED_NOTE,
  ensureOilIntervalNotes,
  isGenericDealerRecordWork,
  oilGenericRecordsNote,
  type OilNoteLang,
} from "@/lib/oil-interval-dealer-notes";

/**
 * Anonimizēta struktūra no 26.11.2026 pasūtījuma (BMW 330d, M57 D30, OEM 30 000 km / 24 mēn.):
 * 3 dzinēja eļļas maiņas, otrais solis 82 952 km / 48 mēn. (Datu iztrūkums), starp tām
 * trīs „Apkope” ieraksti bez darbu saraksta.
 */
function bmwBlock(notes: string): AutoRecordsBlockState {
  const row = (date: string, odometer: string, works: string) => ({ date, odometer, location: "", works });
  return {
    ...emptyAutoRecordsBlock(),
    oilChangeIntervalNotes: notes,
    serviceWorks: [
      row("07.04.2017", "253161", "Stūres rata centrālā uzlika"),
      row("30.01.2015", "192284", "Apkope"),
      row("26.09.2014", "188120", "Apkope"),
      row("02.02.2011", "134643", "Eļļas separators / Motoreļļa SAE 5W-30 Longlife-04 / Eļļas filtra komplekts"),
      row("16.07.2010", "122451", "Apkope"),
      row("30.05.2008", "89930", "Labais miglas lukturis"),
      row("13.02.2008", "81531", "Apkope"),
      row("07.02.2008", "81531", "Degvielas atplūdes caurule / Sprausla"),
      row("16.07.2007", "68778", "Vējstikls"),
      row("27.02.2007", "55307", "Apkope"),
      row("05.02.2007", "51691", "Motoreļļa SAE 5W-30 Longlife-04 / Eļļas filtra komplekts"),
      row("16.02.2006", "33138", "Motoreļļa SAE 0W-40 Longlife-04 / Eļļas filtra komplekts"),
      row("01.11.2005", "25241", "Dzesēšanas papildventilators"),
      row("29.10.2004", "3", "Apkope"),
    ],
  };
}

const BMW_NOTES_SCREENSHOT =
  "Ražotāja intervāls: līdz 30 000 km / 24 mēn. (M57 D30).<br><br><strong>Eļļas maiņu regularitāte</strong><br>Dīlera vēsturē fiksētas 3 dzinēja eļļas maiņas. Pirmais fiksētais intervāls (18 553 km un aptuveni 12 mēneši) iekļaujas ražotāja maksimālajā intervālā. Otrais fiksētais intervāls dīlera datubāzē, starp 2007. gada februāri un 2011. gada februāri, ir 82 952 km un 48 mēneši, kas pārsniedz ražotāja pieļauto robežu.&nbsp;<br><br><strong>Pēdējā fiksētā eļļas maiņa</strong><br>Pēdējā dzinēja eļļas maiņa pie oficiālā dīlera reģistrēta 02.02.2011 ar nobraukumu 134 643 km.";

const GENERIC_LV =
  "Šajā periodā ir arī dīlera ieraksti bez detalizēta darbu apraksta (3: 27.02.2007, 13.02.2008, 16.07.2010) - uz eļļas maiņu teorētiski var norādīt arī kāds no tiem, bet to nevaram apliecināt.";

describe("eļļas intervāla piebildes (Nils 26.11.2026)", () => {
  it("BMW pasūtījums: pārsniegtais solis ar 3 vispārīgiem ierakstiem", () => {
    const intervals = oilExceededIntervalsForBlock(bmwBlock(BMW_NOTES_SCREENSHOT));
    expect(intervals).toEqual([
      { fromDate: "05.02.2007", toDate: "02.02.2011", genericDates: ["27.02.2007", "13.02.2008", "16.07.2010"] },
    ]);
  });

  it("komentārs ar pārsniegumu -> abas piebildes vienā rindkopā pēc pārsnieguma", () => {
    const out = oilIntervalNotesWithRequiredNotes(bmwBlock(BMW_NOTES_SCREENSHOT), BMW_NOTES_SCREENSHOT, "lv");
    expect(out).toContain(
      `kas pārsniedz ražotāja pieļauto robežu. ${OIL_NOT_SKIPPED_NOTE.lv} ${GENERIC_LV}&nbsp;<br><br><strong>Pēdējā fiksētā eļļas maiņa</strong>`,
    );
    expect(out).not.toMatch(/eksperts|pirkt|nepirkt|slēdzien|verdikt/i);
  });

  it("dubultošanās nav: otrā izsaukumā teksts nemainās", () => {
    const block = bmwBlock(BMW_NOTES_SCREENSHOT);
    const once = oilIntervalNotesWithRequiredNotes(block, BMW_NOTES_SCREENSHOT, "lv");
    const twice = oilIntervalNotesWithRequiredNotes(block, once, "lv");
    expect(twice).toBe(once);
    expect(once.split(OIL_NOT_SKIPPED_NOTE.lv).length).toBe(2);
    expect(once.split("bez detalizēta darbu apraksta").length).toBe(2);
  });

  it("AI vai operatora paša formulējums skaitās kā 1. piebilde (nedublē), 2. piebildi pievieno", () => {
    const own = BMW_NOTES_SCREENSHOT.replace(
      "pieļauto robežu.",
      "pieļauto robežu, bet nenozīmē, ka eļļas maiņa netika veikta neatkarīgā servisā.",
    );
    const out = oilIntervalNotesWithRequiredNotes(bmwBlock(own), own, "lv");
    expect(out).not.toContain(OIL_NOT_SKIPPED_NOTE.lv);
    expect(out).toContain(`neatkarīgā servisā. ${GENERIC_LV}`);
  });

  it("bez pārsnieguma -> nav piebildes", () => {
    const block: AutoRecordsBlockState = {
      ...emptyAutoRecordsBlock(),
      serviceWorks: [
        { date: "10.01.2020", odometer: "10000", location: "", works: "Motoreļļa 5W-30, eļļas filtrs" },
        { date: "15.06.2020", odometer: "15000", location: "", works: "Apkope" },
        { date: "10.01.2021", odometer: "25000", location: "", works: "Motoreļļa 5W-30, eļļas filtrs" },
      ],
    };
    const text = "Ražotāja intervāls: 30 000 km / 24 mēn.\n\nSolis 15 000 km iekļaujas intervālā.";
    expect(oilExceededIntervalsForBlock({ ...block, oilChangeIntervalNotes: text })).toEqual([]);
    expect(oilIntervalNotesWithRequiredNotes(block, text, "lv")).toBe(text);
  });

  it("pārsniegums bez vispārīgiem ierakstiem -> tikai 1. piebilde", () => {
    const block: AutoRecordsBlockState = {
      ...emptyAutoRecordsBlock(),
      serviceWorks: [
        { date: "10.01.2018", odometer: "10000", location: "", works: "Motoreļļa 5W-30" },
        { date: "10.06.2020", odometer: "45000", location: "", works: "Motoreļļa 5W-30" },
      ],
    };
    const text = "Ražotāja intervāls: 30 000 km / 24 mēn.\n\nSolis 35 000 km un 29 mēn. pārsniedz ražotāja intervālu.\n\nPēdējā maiņa 10.06.2020.";
    const out = oilIntervalNotesWithRequiredNotes(block, text, "lv");
    expect(out).toBe(
      `Ražotāja intervāls: 30 000 km / 24 mēn.\n\nSolis 35 000 km un 29 mēn. pārsniedz ražotāja intervālu. ${OIL_NOT_SKIPPED_NOTE.lv}\n\nPēdējā maiņa 10.06.2020.`,
    );
    expect(out).not.toContain("bez detalizēta darbu apraksta");
  });

  it("bez rindkopas par pārsniegumu -> sadaļas „Eļļas maiņu regularitāte” beigās", () => {
    const iv = [{ fromDate: "01.01.2010", toDate: "01.01.2014", genericDates: [] }];
    const text = "Ražotāja intervāls: 15 000 km / 12 mēn.<br><br><strong>Eļļas maiņu regularitāte</strong><br>Fiksētas 2 maiņas.<br><br><strong>Pēdējā</strong><br>01.01.2014.";
    expect(ensureOilIntervalNotes(text, iv, "lv")).toBe(
      `Ražotāja intervāls: 15 000 km / 12 mēn.<br><br><strong>Eļļas maiņu regularitāte</strong><br>Fiksētas 2 maiņas. ${OIL_NOT_SKIPPED_NOTE.lv}<br><br><strong>Pēdējā</strong><br>01.01.2014.`,
    );
  });

  it("vairāki pārsniegti periodi -> 2. piebilde tikai periodam ar vispārīgiem ierakstiem, ar periodu", () => {
    const iv = [
      { fromDate: "01.01.2010", toDate: "01.01.2014", genericDates: ["01.06.2012"] },
      { fromDate: "01.01.2014", toDate: "01.01.2018", genericDates: [] },
    ];
    const out = ensureOilIntervalNotes("Divi soļi pārsniedz intervālu.", iv, "lv");
    expect(out).toContain("Periodā 01.01.2010-01.01.2014 ir arī dīlera ieraksts bez detalizēta darbu apraksta (1: 01.06.2012)");
    expect(out).not.toContain("01.01.2014-01.01.2018 ir arī");
  });

  it.each<[OilNoteLang, string]>([
    ["lv", "Otrais solis pārsniedz ražotāja intervālu."],
    ["en", "The second step exceeds the manufacturer interval."],
    ["ru", "Второй шаг превышает интервал производителя."],
    ["de", "Der zweite Schritt überschreitet das Herstellerintervall."],
  ])("4 valodas (%s): piebildes klienta valodā, bez dubultošanās", (lang, text) => {
    const iv = [{ fromDate: "05.02.2007", toDate: "02.02.2011", genericDates: ["27.02.2007", "13.02.2008"] }];
    const out = ensureOilIntervalNotes(text, iv, lang);
    expect(out).toBe(`${text} ${OIL_NOT_SKIPPED_NOTE[lang]} ${oilGenericRecordsNote(lang, ["27.02.2007", "13.02.2008"])}`);
    expect(out).toContain("(2: 27.02.2007, 13.02.2008)");
    expect(ensureOilIntervalNotes(out, iv, lang)).toBe(out);
  });

  it("valoda no teksta, ja nav dota", () => {
    const block = bmwBlock("");
    const ru = "Ražotāja intervāls: 30 000 km / 24 mēn.\n\nВторой шаг 82 952 км превышает интервал производителя.";
    expect(oilIntervalNotesWithRequiredNotes(block, ru, null)).toContain(OIL_NOT_SKIPPED_NOTE.ru);
  });

  it("vispārīgi ieraksti: tikai „apkope / serviss / apmeklējums” bez darbiem", () => {
    expect(isGenericDealerRecordWork("Apkope")).toBe(true);
    expect(isGenericDealerRecordWork("Serviss.")).toBe(true);
    expect(isGenericDealerRecordWork("Apmeklējums")).toBe(true);
    expect(isGenericDealerRecordWork("Service")).toBe(true);
    expect(isGenericDealerRecordWork("Wartung")).toBe(true);
    expect(isGenericDealerRecordWork("Apkope A")).toBe(false);
    expect(isGenericDealerRecordWork("Motoreļļa 5W-30")).toBe(false);
    expect(isGenericDealerRecordWork("Vējstikls")).toBe(false);
    expect(isGenericDealerRecordWork("Apkope, bremžu kluču maiņa")).toBe(false);
  });
});
