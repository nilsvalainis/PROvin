import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock, type AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { oilIntervalNotesWithRequiredNotes, oilExceededIntervalsForBlock } from "@/lib/oil-change-interval-chart";
import {
  OIL_NOT_SKIPPED_NOTE,
  ensureOilIntervalNotes,
  isGenericDealerRecordWork,
  oilGenericRecordsNote,
  replaceOilStepWordingLv,
  type OilNoteLang,
} from "@/lib/oil-interval-dealer-notes";
import { formatOilStepRangeFactLine, formatOilStepRangeShortLv, buildOilChangeIntervalSeries } from "@/lib/oil-change-intervals";

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
  "Šajā periodā ir arī dīlera ieraksti bez detalizēta darbu apraksta (27.02.2007, 13.02.2008, 16.07.2010) - tie teorētiski var liecināt par eļļas maiņu, bet to nevaram apliecināt.";

const count = (hay: string, needle: string) => hay.split(needle).length - 1;

/** Anonimizēta #1291 struktūra: 8 eļļas maiņas, vairāki pārsniegti intervāli ar „Apkope” ierakstiem. */
function eightChangesBlock(notes: string): AutoRecordsBlockState {
  const row = (date: string, odometer: string, works: string) => ({ date, odometer, location: "", works });
  const oil = "Motoreļļa SAE 5W-30 Longlife-04 / Eļļas filtra komplekts";
  return {
    ...emptyAutoRecordsBlock(),
    oilChangeIntervalNotes: notes,
    serviceWorks: [
      row("10.01.2006", "20000", oil),
      row("10.01.2007", "45000", oil),
      row("10.01.2008", "70000", oil),
      row("10.03.2011", "130000", oil),
      row("24.10.2012", "150000", "Apkope"),
      row("10.01.2013", "165000", oil),
      row("04.04.2014", "180000", "Serviss"),
      row("10.06.2016", "215000", oil),
      row("10.06.2017", "240000", oil),
      row("10.06.2018", "265000", oil),
    ],
  };
}

const EIGHT_NOTES =
  "Ražotāja intervāls: 30 000 km / 24 mēn. (M57 D30).<br><br><strong>Eļļas maiņu regularitāte</strong><br>Fiksētas 8 dzinēja eļļas maiņas. Nobraukuma soļi ir 25 000-60 000 km. Intervāls starp 10.01.2008 un 10.03.2011 ir 60 000 km un 38 mēneši, kas pārsniedz ražotāja intervālu.<br><br>Arī soļi 2011-2013 un 2014-2016 pārsniedz ražotāja intervālu.<br><br><strong>Pēdējā fiksētā eļļas maiņa</strong><br>10.06.2018, 265 000 km.";

const NOTES_PARA = (lang: OilNoteLang, dates: string[], periods: number) =>
  `${OIL_NOT_SKIPPED_NOTE[lang]} ${oilGenericRecordsNote(lang, dates, periods)}`;

describe("eļļas intervāla piebildes (Nils 26.11.2026, #1291 labojumi)", () => {
  it("BMW pasūtījums: pārsniegtais intervāls ar 3 vispārīgiem ierakstiem", () => {
    const intervals = oilExceededIntervalsForBlock(bmwBlock(BMW_NOTES_SCREENSHOT));
    expect(intervals).toEqual([
      { fromDate: "05.02.2007", toDate: "02.02.2011", genericDates: ["27.02.2007", "13.02.2008", "16.07.2010"] },
    ]);
  });

  it("viens periods: abas piebildes vienreiz, atsevišķā rindkopā pēc rindkopas par pārsniegumu", () => {
    const out = oilIntervalNotesWithRequiredNotes(bmwBlock(BMW_NOTES_SCREENSHOT), BMW_NOTES_SCREENSHOT, "lv");
    expect(out).toContain(
      `kas pārsniedz ražotāja pieļauto robežu.<br><br>${OIL_NOT_SKIPPED_NOTE.lv} ${GENERIC_LV}<br><br><strong>Pēdējā fiksētā eļļas maiņa</strong>`,
    );
    expect(count(out, OIL_NOT_SKIPPED_NOTE.lv)).toBe(1);
    expect(count(out, "bez detalizēta darbu apraksta")).toBe(1);
    expect(out).not.toMatch(/eksperts|pirkt|nepirkt|slēdzien|verdikt/i);
  });

  it("vairāki periodi: 2. piebilde VIENREIZ ar visiem datumiem, «Šajos periodos»; 1. piebilde vienreiz", () => {
    const block = eightChangesBlock(EIGHT_NOTES);
    const iv = oilExceededIntervalsForBlock(block);
    expect(iv.filter((x) => x.genericDates.length > 0).length).toBe(2);
    const out = oilIntervalNotesWithRequiredNotes(block, EIGHT_NOTES, "lv");
    expect(count(out, OIL_NOT_SKIPPED_NOTE.lv)).toBe(1);
    expect(count(out, "bez detalizēta darbu apraksta")).toBe(1);
    expect(out).toContain(
      "Šajos periodos ir arī dīlera ieraksti bez detalizēta darbu apraksta (24.10.2012, 04.04.2014) - tie teorētiski var liecināt par eļļas maiņu, bet to nevaram apliecināt.",
    );
    // Pēc pēdējās rindkopas par pārsniegumu, pirms „Pēdējā fiksētā eļļas maiņa”.
    expect(out).toContain(
      `2014-2016 pārsniedz ražotāja intervālu.<br><br>${NOTES_PARA("lv", ["24.10.2012", "04.04.2014"], 2)}<br><br><strong>Pēdējā`,
    );
    expect(out).not.toMatch(/(?<!\p{L})(?:sol(?:is|a|im|i|ī)|soļ(?:i|u|iem|us|os))(?!\p{L})/iu);
    expect(oilIntervalNotesWithRequiredNotes(block, out, "lv")).toBe(out);
  });

  it("vecais #1291 teksts ar atkārtotām piebildēm pie katra perioda -> sakārtots vienreiz", () => {
    const block = eightChangesBlock(EIGHT_NOTES);
    const oldNote1 = "Tas nenozīmē, ka eļļas maiņa nav veikta - tā var būt veikta neatkarīgā servisā, kas datus dīlera sistēmai nenodod.";
    const old2a = "Periodā 10.03.2011-10.01.2013 ir arī dīlera ieraksts bez detalizēta darbu apraksta (1: 24.10.2012) - uz eļļas maiņu teorētiski var norādīt arī tas, bet to nevaram apliecināt.";
    const old2b = "Periodā 10.01.2013-10.06.2016 ir arī dīlera ieraksts bez detalizēta darbu apraksta (1: 04.04.2014) - uz eļļas maiņu teorētiski var norādīt arī tas, bet to nevaram apliecināt.";
    const prod = EIGHT_NOTES.replace("kas pārsniedz ražotāja intervālu.<br>", `kas pārsniedz ražotāja intervālu. ${oldNote1} ${old2a} ${old2b}<br>`).replace(
      "2014-2016 pārsniedz ražotāja intervālu.",
      `2014-2016 pārsniedz ražotāja intervālu. ${oldNote1} ${old2b}`,
    );
    const out = oilIntervalNotesWithRequiredNotes(block, prod, "lv");
    expect(out).toBe(oilIntervalNotesWithRequiredNotes(block, EIGHT_NOTES, "lv"));
    expect(out).not.toContain("dīlera sistēmai nenodod");
    expect(out).not.toContain("Periodā ");
  });

  it("vienskaitlis: viens periods, viens ieraksts", () => {
    expect(oilGenericRecordsNote("lv", ["24.10.2012"], 1)).toBe(
      "Šajā periodā ir arī dīlera ieraksts bez detalizēta darbu apraksta (24.10.2012) - tas teorētiski var liecināt par eļļas maiņu, bet to nevaram apliecināt.",
    );
  });

  it("vairāk par 4 datumiem -> tikai skaits", () => {
    const d = ["01.01.2010", "01.02.2010", "01.03.2010", "01.04.2010", "01.05.2010"];
    expect(oilGenericRecordsNote("lv", d, 2)).toContain("bez detalizēta darbu apraksta (5) - tie");
  });

  it("AI paša formulējums teikuma vidū skaitās kā 1. piebilde (nedublē), 2. piebildi pievieno", () => {
    const own = BMW_NOTES_SCREENSHOT.replace(
      "pieļauto robežu.",
      "pieļauto robežu, bet nenozīmē, ka eļļas maiņa netika veikta neatkarīgā servisā.",
    );
    const out = oilIntervalNotesWithRequiredNotes(bmwBlock(own), own, "lv");
    expect(out).not.toContain(OIL_NOT_SKIPPED_NOTE.lv);
    expect(out).toContain(`neatkarīgā servisā.<br><br>${GENERIC_LV}<br><br>`);
  });

  it("AI teikums bez neatkarīgā servisa («nepierāda, ka … netika veikta vispār») -> kanoniskā 1. piebilde tomēr ir", () => {
    const own = BMW_NOTES_SCREENSHOT.replace(
      "pieļauto robežu.",
      "pieļauto robežu, bet nepierāda, ka eļļas maiņa netika veikta vispār.",
    );
    const out = oilIntervalNotesWithRequiredNotes(bmwBlock(own), own, "lv");
    expect(out).toContain(`veikta vispār.<br><br>${OIL_NOT_SKIPPED_NOTE.lv} ${GENERIC_LV}<br><br>`);
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
    const text = "Ražotāja intervāls: 30 000 km / 24 mēn.\n\nIntervāls 15 000 km iekļaujas ražotāja intervālā.";
    expect(oilExceededIntervalsForBlock({ ...block, oilChangeIntervalNotes: text })).toEqual([]);
    expect(oilIntervalNotesWithRequiredNotes(block, text, "lv")).toBe(text);
  });

  it("pārsniegums bez vispārīgiem ierakstiem -> tikai 1. piebilde, atsevišķā rindkopā (vienkāršs teksts)", () => {
    const block: AutoRecordsBlockState = {
      ...emptyAutoRecordsBlock(),
      serviceWorks: [
        { date: "10.01.2018", odometer: "10000", location: "", works: "Motoreļļa 5W-30" },
        { date: "10.06.2020", odometer: "45000", location: "", works: "Motoreļļa 5W-30" },
      ],
    };
    const text = "Ražotāja intervāls: 30 000 km / 24 mēn.\n\nIntervāls 35 000 km un 29 mēn. pārsniedz ražotāja intervālu.\n\nPēdējā maiņa 10.06.2020.";
    const out = oilIntervalNotesWithRequiredNotes(block, text, "lv");
    expect(out).toBe(
      `Ražotāja intervāls: 30 000 km / 24 mēn.\n\nIntervāls 35 000 km un 29 mēn. pārsniedz ražotāja intervālu.\n\n${OIL_NOT_SKIPPED_NOTE.lv}\n\nPēdējā maiņa 10.06.2020.`,
    );
    expect(out).not.toContain("bez detalizēta darbu apraksta");
  });

  it("bez rindkopas par pārsniegumu -> sadaļas „Eļļas maiņu regularitāte” beigās, atsevišķi", () => {
    const iv = [{ fromDate: "01.01.2010", toDate: "01.01.2014", genericDates: [] }];
    const text = "Ražotāja intervāls: 15 000 km / 12 mēn.<br><br><strong>Eļļas maiņu regularitāte</strong><br>Fiksētas 2 maiņas.<br><br><strong>Pēdējā</strong><br>01.01.2014.";
    expect(ensureOilIntervalNotes(text, iv, "lv")).toBe(
      `Ražotāja intervāls: 15 000 km / 12 mēn.<br><br><strong>Eļļas maiņu regularitāte</strong><br>Fiksētas 2 maiņas.<br><br>${OIL_NOT_SKIPPED_NOTE.lv}<br><br><strong>Pēdējā</strong><br>01.01.2014.`,
    );
  });

  it.each<[OilNoteLang, string]>([
    ["lv", "Otrais intervāls pārsniedz ražotāja intervālu."],
    ["en", "The second interval exceeds the manufacturer interval."],
    ["ru", "Второй интервал превышает интервал производителя."],
    ["de", "Das zweite Intervall überschreitet das Herstellerintervall."],
  ])("4 valodas (%s): piebildes klienta valodā, vienreiz, bez dubultošanās", (lang, text) => {
    const iv = [
      { fromDate: "05.02.2007", toDate: "02.02.2011", genericDates: ["27.02.2007"] },
      { fromDate: "02.02.2011", toDate: "02.02.2015", genericDates: ["13.02.2013"] },
    ];
    const out = ensureOilIntervalNotes(text, iv, lang);
    expect(out).toBe(`${text}\n\n${NOTES_PARA(lang, ["27.02.2007", "13.02.2013"], 2)}`);
    expect(out).toContain("(27.02.2007, 13.02.2013)");
    expect(ensureOilIntervalNotes(out, iv, lang)).toBe(out);
  });

  it("tulkojumi: vienskaitlis/daudzskaitlis un nozīme", () => {
    expect(oilGenericRecordsNote("en", ["24.10.2012"], 1)).toBe(
      "In this period there is also a dealer record without a detailed description of work (24.10.2012) - in theory it could indicate an oil change, but we cannot confirm this.",
    );
    expect(oilGenericRecordsNote("ru", ["24.10.2012", "04.04.2014"], 2)).toContain("В эти периоды есть также записи дилера");
    expect(oilGenericRecordsNote("de", ["24.10.2012"], 1)).toContain("In diesem Zeitraum gibt es auch einen Händlereintrag");
    expect(OIL_NOT_SKIPPED_NOTE.lv).toBe(
      "Tas nenozīmē, ka eļļas maiņa nav veikta - tā var būt veikta neatkarīgā servisā, kas datus oficiālajā dīlera sistēmā neievada.",
    );
    for (const l of ["en", "ru", "de"] as const) {
      expect(OIL_NOT_SKIPPED_NOTE[l]).not.toMatch(/\bstep|шаг|Schritt/i);
      expect(oilGenericRecordsNote(l, ["1.1.2010", "1.1.2011"], 2)).not.toMatch(/\bstep|шаг|Schritt/i);
    }
  });

  it("valoda no teksta, ja nav dota", () => {
    const block = bmwBlock("");
    const ru = "Ražotāja intervāls: 30 000 km / 24 mēn.\n\nВторой интервал 82 952 км превышает интервал производителя.";
    expect(oilIntervalNotesWithRequiredNotes(block, ru, null)).toContain(OIL_NOT_SKIPPED_NOTE.ru);
  });

  it("«solis / soļi» -> «intervāls / intervāli» tajā pašā locījumā", () => {
    expect(replaceOilStepWordingLv("Nobraukuma soļi ir 12 300-19 700 km. Garākais solis ir 2011. gadā, soļu diapazons plašs, 3 soļiem.")).toBe(
      "Intervāli ir 12 300-19 700 km. Garākais intervāls ir 2011. gadā, intervālu diapazons plašs, 3 intervāliem.",
    );
    expect(replaceOilStepWordingLv("Izsoļu arhīvs; nosolīts")).toBe("Izsoļu arhīvs; nosolīts");
  });

  it("AI faktu rindās nav vārda «solis/soļi»", () => {
    const series = buildOilChangeIntervalSeries(
      [
        { date: "10.01.2018", odometer: "10000", location: "", works: "Motoreļļa 5W-30" },
        { date: "10.06.2019", odometer: "29660", location: "", works: "Motoreļļa 5W-30" },
        { date: "10.06.2020", odometer: "68280", location: "", works: "Motoreļļa 5W-30" },
      ],
      { km: 30000, kmMin: null, months: 24 },
    );
    const lines = `${formatOilStepRangeFactLine(series)}\n${formatOilStepRangeShortLv(series)}\n${series.ringNote}`;
    expect(lines).toContain("Intervāli starp dzinēja eļļas maiņām");
    expect(lines).not.toMatch(/(?<!\p{L})(?:sol(?:is|a|im|i|ī)|soļ(?:i|u|iem|us|os))(?!\p{L})/iu);
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
