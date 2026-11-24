import { describe, expect, it } from "vitest";
import { emptyCsddFields, type CsddFormFields } from "@/lib/admin-source-blocks";
import { buildCsddLocalParseFromText } from "@/lib/csdd-pdf-ingest";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import {
  buildOwnerMileageBlockHtml,
  buildCsddOwnerMileageBlockHtml,
  ownerMileageDurationLabel,
  ownerMileageKmLabel,
  ownerMileagePeriodLabel,
} from "@/lib/owner-mileage-block-html";
import {
  buildOwnerMileagePeriods,
  collectOwnerMileageFacts,
  formatOwnerMileageFactLines,
  ownerMileageCalendarDuration,
  ownerMileageColumns,
  ownerMileageInputFromCsdd,
  ownerMileageReadingsFromUnifiedRows,
  type OwnerMileageReading,
  type OwnerMileageResult,
} from "@/lib/owner-mileage-periods";
import {
  OWNER_MILEAGE_FIXTURE_GJ,
  OWNER_MILEAGE_FIXTURE_OP,
  OWNER_MILEAGE_FIXTURE_RO,
} from "@/lib/owner-mileage-periods.fixtures";
import { ownerMileageDuration } from "@/lib/client-report-i18n";
import { collectUnifiedMileageRows, prepareUnifiedMileageDisplayRows } from "@/lib/unified-mileage";
import { buildCanonicalFactsSheet } from "@/lib/canonical-facts-sheet";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";

const NOW = Date.UTC(2026, 10, 24);
const d = (s: string) => {
  const [dd, mm, yy] = s.split(".").map(Number);
  return Date.UTC(yy!, mm! - 1, dd!);
};

function fromFixture(text: string): { form: CsddFormFields; r: OwnerMileageResult } {
  const form = buildCsddLocalParseFromText(text, "fixture.pdf").fields;
  const rs = ownerMileageReadingsFromUnifiedRows(prepareUnifiedMileageDisplayRows(collectUnifiedMileageRows({ csddForm: form })));
  const r = buildOwnerMileagePeriods(ownerMileageInputFromCsdd(form, rs, NOW)!)!;
  return { form, r };
}

function rowsOf(r: OwnerMileageResult): string[] {
  return [r.abroad, ...r.owners]
    .filter((p) => p != null)
    .map((p) => `${ownerMileagePeriodLabel(p!, "lv")} | ${ownerMileageDurationLabel(p!, "lv")} | ${ownerMileageKmLabel(p!)}`);
}

function ownersForm(dates: string[], extra: Partial<CsddFormFields> = {}): CsddFormFields {
  return {
    ...emptyCsddFields(),
    ownerCountLatvia: String(dates.length),
    ownerRegistrationEvents: dates.map((date, i) => ({
      date,
      label: i === 0 ? "Pirmā reģistrācija Latvijā" : "Īpašnieka maiņa",
    })),
    ...extra,
  };
}

describe("ilgumi", () => {
  it("rēķina kalendāra ilgumu: dienas zem mēneša, citādi gadi + mēneši", () => {
    expect(ownerMileageCalendarDuration(d("03.02.2007"), d("16.02.2007"))).toEqual({ years: 0, months: 0, days: 13 });
    expect(ownerMileageCalendarDuration(d("16.02.2007"), d("07.12.2012"))).toEqual({ years: 5, months: 10 });
    expect(ownerMileageCalendarDuration(d("07.12.2012"), d("15.01.2015"))).toEqual({ years: 2, months: 1 });
    expect(ownerMileageCalendarDuration(d("15.01.2015"), d("24.07.2015"))).toEqual({ years: 0, months: 6 });
  });

  it("saīsināti formāti visās 4 valodās, vienā rindā", () => {
    const p = { years: 5, months: 10 };
    expect(ownerMileageDuration(p, "lv")).toBe("5 g. 10 mēn.");
    expect(ownerMileageDuration(p, "en")).toBe("5 yr 10 mo");
    expect(ownerMileageDuration(p, "ru")).toBe("5 г. 10 мес.");
    expect(ownerMileageDuration(p, "de")).toBe("5 J. 10 Mon.");
    expect(ownerMileageDuration({ years: 0, months: 0, days: 13 }, "lv")).toBe("13 d.");
    expect(ownerMileageDuration({ years: 2, months: 0 }, "lv")).toBe("2 g.");
  });
});

describe("CSDD izdrukas piemēri (anonimizēti)", () => {
  it("9 īpašnieki + Vācija: ilgumi, interpolācija, samazinājums → «-»", () => {
    const { r } = fromFixture(OWNER_MILEAGE_FIXTURE_GJ);
    expect(r.ownerCount).toBe(9);
    expect(r.abroad?.country).toBe("Vācija");
    expect(rowsOf(r)).toEqual([
      "2000-02.2007 | ~7 g. | 117 969 km",
      "02.2007 | 13 d. | -",
      "02.2007-12.2012 | 5 g. 10 mēn. | 70 364 km",
      "12.2012-01.2015 | 2 g. 1 mēn. | ~21 230 km",
      "01.2015-07.2015 | 6 mēn. | ~6 370 km",
      "07.2015-03.2021 | 5 g. 8 mēn. | -",
      "03.2021-12.2025 | 4 g. 9 mēn. | ~13 940 km",
      "12.2025 | 7 d. | ~50 km",
      "12.2025-07.2026 | 7 mēn. | ~1 430 km",
      "kopš 07.2026 | 4 mēn. | -",
    ]);
    expect(r.owners[4]!.drop).toEqual({ fromT: d("15.06.2016"), fromKm: 235342, toT: d("11.09.2018"), toKm: 228276 });
  });

  it("4 īpašnieki + Itālija: pašreizējam bez rādījuma pēc maiņas «-»", () => {
    const { r } = fromFixture(OWNER_MILEAGE_FIXTURE_OP);
    expect(r.abroad?.country).toBe("Itālija");
    expect(rowsOf(r)[0]).toBe("2006-05.2017 | ~11 g. | 254 471 km");
    expect(r.owners.map((o) => o.km)).toEqual([null, 108090, null, null]);
    expect(r.owners[3]!.current).toBe(true);
  });

  it("2 īpašnieki: pašreizējam km līdz pēdējam rādījumam («~»)", () => {
    const { r } = fromFixture(OWNER_MILEAGE_FIXTURE_RO);
    expect(rowsOf(r)).toEqual(["2014-05.2025 | ~11 g. | 163 981 km", "05.2025-01.2026 | 8 mēn. | ~4 760 km", "kopš 01.2026 | 10 mēn. | ~2 840 km"]);
  });
});

describe("aprēķina noteikumi", () => {
  const readings = (pairs: [string, number][]): OwnerMileageReading[] => pairs.map(([t, km]) => ({ t: d(t), km }));

  it("interpolē starp tuvākajiem rādījumiem un liek «~»", () => {
    const form = ownersForm(["01.01.2010", "01.01.2011"], { firstRegistration: "2010-01-01" });
    const r = buildOwnerMileagePeriods(
      ownerMileageInputFromCsdd(form, readings([["01.07.2010", 5000], ["01.07.2011", 25000], ["01.11.2026", 90000]]), NOW)!,
    )!;
    expect(r.abroad).toBeNull();
    // 1. īpašnieks: jauns auto (0 km) līdz 01.01.2011 (interpolēts ~15 000).
    expect(r.owners[0]!.kmApprox).toBe(true);
    expect(ownerMileageKmLabel(r.owners[0]!)).toBe("~15 080 km");
    expect(ownerMileageKmLabel(r.owners[1]!)).toBe("~74 920 km");
  });

  it("odometra samazinājums periodā → «-» un fakts AI lapai", () => {
    const form = ownersForm(["01.01.2015", "01.01.2020"], { previousRegistrationCountry: "VĀCIJA", modelYear: "2010" });
    const r = buildOwnerMileagePeriods(
      ownerMileageInputFromCsdd(
        form,
        readings([["01.01.2015", 100000], ["01.01.2017", 150000], ["01.01.2018", 120000], ["01.01.2020", 140000], ["01.06.2026", 160000]]),
        NOW,
      )!,
    )!;
    expect(r.owners[0]!.km).toBeNull();
    expect(r.owners[0]!.drop?.fromKm).toBe(150000);
    expect(r.owners[1]!.km).toBe(20000);
    const html = buildOwnerMileageBlockHtml(r);
    expect(html).toContain('<span class="pdf-own-na">-</span>');
    expect(html.slice(0, html.indexOf("pdf-own-foot"))).not.toMatch(/samazin|nav datu|odometr/i);
    const facts = formatOwnerMileageFactLines(r).join("\n");
    expect(facts).toContain("Odometrs samazinājās 1. īpašnieka periodā: 01.01.2017 150 000 km → 01.01.2018 120 000 km (par 30 000 km)");
  });

  it("bez ārvalstu perioda: nav ārvalstu kolonnas un banera, trešais baneris - pirmā reģistrācija", () => {
    const form = ownersForm(["10.03.2019", "05.05.2022"], { firstRegistration: "2019-03-10" });
    const r = buildOwnerMileagePeriods(ownerMileageInputFromCsdd(form, readings([["10.03.2021", 30000], ["05.05.2023", 60000]]), NOW)!)!;
    expect(r.abroad).toBeNull();
    const html = buildOwnerMileageBlockHtml(r);
    expect(html).not.toContain("Ārvalstīs");
    expect(html).not.toContain("pdf-own-col--ab");
    expect(html).toContain("Pirmā reģistrācija Latvijā");
    expect(html).toContain("2 īpašnieki");
    expect(html.match(/<div><span class="pdf-own-cap">/g)?.length).toBe(2);
  });

  it("bez īpašnieku datumiem bloka nav", () => {
    const form = { ...emptyCsddFields(), ownerCountLatvia: "2" };
    expect(buildOwnerMileagePeriods(ownerMileageInputFromCsdd(form, [], NOW)!)).toBeNull();
    expect(buildCsddOwnerMileageBlockHtml(form, [], { nowMs: NOW })).toBe("");
  });

  it("īsie periodi, trūkstoši rādījumi un ārvalstu km robeža - AI faktos", () => {
    const form = ownersForm(["01.06.2020", "01.09.2020", "01.03.2023"], { previousRegistrationCountry: "NĪDERLANDE", modelYear: "2012" });
    const rs: OwnerMileageReading[] = [
      { t: d("01.05.2016"), km: 80000, foreign: true },
      { t: d("02.06.2020"), km: 150000 },
      { t: d("10.03.2023"), km: 190000 },
    ];
    const r = buildOwnerMileagePeriods(ownerMileageInputFromCsdd(form, rs, NOW)!)!;
    const f = collectOwnerMileageFacts(r);
    expect(f.short.map((o) => o.n)).toEqual([1]);
    expect(f.abroadKnownUntilYear).toBe(2016);
    const text = formatOwnerMileageFactLines(r).join("\n");
    expect(text).toContain("Īsi turēšanas periodi (mazāk par gadu): 1. īpašnieks 3 mēn.");
    expect(text).toContain("Ārvalstu nobraukums zināms tikai līdz 2016. gadam");
    expect(text).toContain("Pašreizējam īpašniekam pēc maiņas vēl nav odometra rādījuma");
  });
});

describe("režģis: ≤ 5 kolonnas rindā, rindas simetriskas", () => {
  it.each([
    [3, 3],
    [5, 5],
    [6, 3],
    [7, 4],
    [10, 5],
  ])("%i kolonnas → %i rindā", (n, cols) => {
    expect(ownerMileageColumns(n)).toBe(cols);
  });

  it.each([
    [2, 3],
    [5, 3],
    [9, 5],
  ])("%i īpašnieki + ārvalstis → data-cols=%i", (owners, cols) => {
    const dates = Array.from({ length: owners }, (_, i) => `01.0${(i % 9) + 1}.${2010 + i}`);
    const form = ownersForm(dates, { previousRegistrationCountry: "VĀCIJA", modelYear: "2005" });
    const html = buildCsddOwnerMileageBlockHtml(form, [], { nowMs: NOW });
    expect(html).toContain(`data-cols="${cols}"`);
    expect(html.match(/class="pdf-own-col[ "]/g)?.length).toBe(owners + 1);
  });

  it("5 īpašnieki bez ārvalstīm - viena rinda pa 5", () => {
    const form = ownersForm(["01.01.2015", "01.01.2017", "01.01.2019", "01.01.2021", "01.01.2023"]);
    expect(buildCsddOwnerMileageBlockHtml(form, [], { nowMs: NOW })).toContain('data-cols="5"');
  });
});

describe("HTML un valodas", () => {
  it("baneros tikai virsraksts un viens skaitlis", () => {
    const { r } = fromFixture(OWNER_MILEAGE_FIXTURE_GJ);
    const html = buildOwnerMileageBlockHtml(r);
    const tiles = html.slice(html.indexOf("pdf-own-tiles"), html.indexOf("pdf-own-grid"));
    expect(tiles).toContain('<span class="pdf-own-cap">Ārvalstīs</span><b>~7 g.</b>');
    expect(tiles).toContain('<span class="pdf-own-cap">Latvijā</span><b>9 īpašnieki</b>');
    expect(tiles).toContain('<span class="pdf-own-cap">Ievests Latvijā</span><b>03.02.2007</b>');
    expect(tiles).not.toMatch(/odometr|samazin|nav datu/i);
    expect(html).toContain("<h3>Īpašnieki un nobraukums</h3>");
    expect(html).toContain("Zīme «~» nozīmē");
  });

  it.each([
    ["en", "Owners and mileage", "9 owners", "Imported to Latvia", "Owner 2", "5 yr 10 mo"],
    ["ru", "Владельцы и пробег", "9 владельцев", "Ввезён в Латвию", "Владелец 2", "5 г. 10 мес."],
    ["de", "Halter und Laufleistung", "9 Halter", "Nach Lettland eingeführt", "2. Halter", "5 J. 10 Mon."],
  ] as const)("%s", (lang, title, count, imported, owner, dur) => {
    const { r } = fromFixture(OWNER_MILEAGE_FIXTURE_GJ);
    const html = buildOwnerMileageBlockHtml(r, { lang });
    for (const s of [title, count, imported, owner, dur]) expect(html).toContain(s);
    expect(html).not.toContain("īpašniek");
  });
});

describe("klienta PDF", () => {
  const payload = (form: CsddFormFields): ClientReportPayload =>
    ({
      sessionId: "cs_test",
      vin: "WBAXX00000XX00001",
      created: Date.now(),
      amountTotal: 7999,
      currency: "eur",
      paymentStatus: "paid",
      listingUrl: null,
      customerEmail: null,
      customerPhone: null,
      customerName: null,
      contactMethod: null,
      notes: null,
      csdd: "",
      csddForm: form,
      ltab: "",
      tirgus: "",
      citi: "",
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
    }) as ClientReportPayload;

  it("CSDD sadaļā jaunais bloks vecās kartītes «N īpašnieki Latvijā» vietā", () => {
    const { form } = fromFixture(OWNER_MILEAGE_FIXTURE_GJ);
    const html = buildClientReportDocumentHtml({
      payload: payload(form),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const zone = html.slice(html.indexOf("pdf-src-zone pdf-src-zone--csdd"));
    expect(zone).toContain("data-owner-mileage-block");
    expect(zone).not.toContain("pdf-csdd-owner-timeline");
    expect(zone).not.toContain("īpašnieki Latvijā");
    expect(html).toContain(".pdf-own-grid{");
  });
});

describe("AI faktu lapa", () => {
  it("kanoniskajā lapā ir īpašnieku periodu fakti", () => {
    const { form } = fromFixture(OWNER_MILEAGE_FIXTURE_GJ);
    const blocks = createDefaultSourceBlocks();
    const sheet = buildCanonicalFactsSheet({ sourceBlocks: { ...blocks, csdd: form } });
    expect(sheet).toContain("Īpašnieku periodi (PDF bloks «Īpašnieki un nobraukums»");
    expect(sheet).toContain("Odometrs samazinājās 5. īpašnieka periodā: 15.06.2016 235 342 km → 11.09.2018 228 276 km");
    expect(sheet).toContain("Īsi turēšanas periodi (mazāk par gadu): 1. īpašnieks 13 d., 4. īpašnieks 6 mēn., 7. īpašnieks 7 d., 8. īpašnieks 7 mēn.");
  });
});
