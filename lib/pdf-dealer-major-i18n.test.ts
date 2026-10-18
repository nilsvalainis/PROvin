import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { emptyAutoRecordsBlock, emptyCsddFields } from "@/lib/admin-source-blocks";
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import {
  buildClientReportDocumentHtml,
  type ClientReportLang,
  type ClientReportPayload,
} from "@/lib/client-report-html";
import { CLIENT_REPORT_LANGS, clientReportDateLocale } from "@/lib/client-report-i18n";
import { emptyOutvinDealerReport, emptyOutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import {
  buildDealerMajorWorksHtml,
  buildDealerVisitSummary,
  buildDealerVisitSummaryHtml,
} from "@/lib/pdf-dealer-timeline";
import {
  BMW_CLUTCH_KIT_TWIN_MASS_PART_LIST,
  BMW_REMAN_GEARBOX_WITH_OIL_LINE,
  BMW_V99966_D15_TWINPOWER_OIL_REPAIR_KIT,
  BMW_WINDSCREEN_CHIP_CHECK,
  BMW_WINDSCREEN_REPLACED,
  DE_STONE_CHIP_REPAIR,
  JEEP_LV_DOOR_TRIM_AND_PROPSHAFT,
  JEEP_LV_DOOR_TRIM_PANEL,
  VOLVO_D4_ENGINE_TURBO_WARRANTY,
} from "@/lib/dealer-major-works.prod-corpus.fixture";
import { VOLVO_XC90_RAW_ROWS } from "@/lib/dealer-major-works.volvo-xc90.fixture";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";

const BMW_RU_ATF = "Автоматическая коробка передач: замена масла и фильтра";

const NONE: Record<ClientReportLang, string> = {
  lv: "Nav fiksēts",
  en: "None recorded",
  ru: "Не зафиксировано",
  de: "Nicht erfasst",
};

const MAJOR_HEAD: Record<ClientReportLang, string> = {
  lv: "Lielie darbi",
  en: "Major work",
  ru: "Крупные работы",
  de: "Größere Arbeiten",
};

const GEARBOX: Record<ClientReportLang, string> = {
  lv: "Ātrumkārba",
  en: "Transmission",
  ru: "Коробка передач",
  de: "Getriebe",
};

const CHAIN: Record<ClientReportLang, string> = {
  lv: "Sadales ķēde",
  en: "Timing chain",
  ru: "Цепь ГРМ",
  de: "Steuerkette",
};

const BELT: Record<ClientReportLang, string> = {
  lv: "Zobsiksna",
  en: "Timing belt",
  ru: "Ремень ГРМ",
  de: "Zahnriemen",
};

const CRANK_SEAL: Record<ClientReportLang, string> = {
  lv: "Kloķvārpstas blīvslēgs",
  en: "Crankshaft seal",
  ru: "Сальник коленвала",
  de: "Kurbelwellendichtung",
};

const CLUTCH: Record<ClientReportLang, string> = {
  lv: "Sajūgs",
  en: "Clutch",
  ru: "Сцепление",
  de: "Kupplung",
};

const DMF: Record<ClientReportLang, string> = {
  lv: "Divmasu spararats",
  en: "Dual-mass flywheel",
  ru: "Двухмассовый маховик",
  de: "Zweimassenschwungrad",
};

const ENGINE: Record<ClientReportLang, string> = {
  lv: "Dzinējs",
  en: "Engine",
  ru: "Двигатель",
  de: "Motor",
};

const TURBO: Record<ClientReportLang, string> = {
  lv: "Turbokompresors",
  en: "Turbocharger",
  ru: "Турбокомпрессор",
  de: "Turbolader",
};

const PROPSHAFT: Record<ClientReportLang, string> = {
  lv: "Kardāns",
  en: "Propshaft",
  ru: "Кардан",
  de: "Gelenkwelle",
};

const BODY_GLASS: Record<ClientReportLang, string> = {
  lv: "Virsbūve / stikls",
  en: "Body / glass",
  ru: "Кузов / стекло",
  de: "Karosserie / Glas",
};

const ASSEMBLIES: Record<ClientReportLang, string> = {
  lv: "Lielie mezgli",
  en: "Major assemblies",
  ru: "Крупные узлы",
  de: "Große Baugruppen",
};

const LEAKED_LV = ["Lielie darbi", "Lielie mezgli", "Nav fiksēts", "Ātrumkārba", "Sadales ķēde"];

const bmwAtfRows: AutoRecordsServiceWorkRow[] = [
  { date: "10.01.2018", odometer: "20100", location: "BMW Bonn", works: "Engine oil service" },
  { date: "12.06.2018", odometer: "35500", location: "BMW Bonn", works: "Engine oil service" },
  { date: "03.03.2019", odometer: "52000", location: "BMW Bonn", works: "Cabin filter" },
  { date: "18.11.2019", odometer: "71000", location: "BMW Bonn", works: "Brake fluid" },
  { date: "22.08.2020", odometer: "89000", location: "BMW Bonn", works: "Spark plugs" },
  { date: "05.08.2022", odometer: "122576", location: "BMW Bonn", works: BMW_RU_ATF },
];

const bmwReplacementRows: AutoRecordsServiceWorkRow[] = [
  ...bmwAtfRows.slice(0, 5),
  { date: "10.08.2021", odometer: "121000", location: "BMW Bonn", works: "Timing chain kit replaced (Steuerkette)" },
  { date: "05.08.2022", odometer: "122576", location: "BMW Bonn", works: "Gearbox replaced" },
];

const volvoRows: AutoRecordsServiceWorkRow[] = VOLVO_XC90_RAW_ROWS.map((r) => ({
  date: r.date,
  odometer: r.odometer,
  location: "Volvo Partner",
  works: r.works,
}));

function section(html: string, cls: string): string {
  const start = html.indexOf(`class="${cls}"`);
  if (start < 0) return "";
  const open = html.lastIndexOf("<", start);
  const tag = html.slice(open + 1, html.indexOf(" ", open + 1) || html.indexOf(">", open + 1));
  const close = `</${tag}>`;
  let depth = 0;
  for (let i = open; i < html.length; ) {
    if (html.startsWith(`<${tag}`, i)) {
      depth += 1;
      i += tag.length + 1;
      continue;
    }
    if (html.startsWith(close, i)) {
      depth -= 1;
      if (depth === 0) return html.slice(open, i + close.length);
      i += close.length;
      continue;
    }
    i += 1;
  }
  return "";
}

function payload(vin: string, model: string, rows: AutoRecordsServiceWorkRow[]): ClientReportPayload {
  const csdd = emptyCsddFields();
  csdd.makeModel = model;
  return {
    sessionId: "cs_major_i18n",
    vin,
    created: 1_700_000_000,
    amountTotal: 9999,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: "klients@example.com",
    customerPhone: null,
    customerName: "Kristaps Vītoliņš",
    contactMethod: null,
    notes: null,
    csdd: "",
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    pdfReportKind: "dealer",
    csddForm: csdd,
    autoRecordsBlock: {
      ...emptyAutoRecordsBlock(),
      outvinReport: {
        ...emptyOutvinDealerReport(),
        vehicleInfo: { ...emptyOutvinVehicleInfo(), model, vinCode: vin },
      },
      serviceWorks: rows,
    },
  } as ClientReportPayload;
}

function render(vin: string, model: string, rows: AutoRecordsServiceWorkRow[], lang: ClientReportLang): string {
  return buildClientReportDocumentHtml({
    payload: payload(vin, model, rows),
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat(clientReportDateLocale(lang), { dateStyle: "long" }),
    formatBytes: () => "0 B",
    lang,
  });
}

describe("Lielie darbi labels in every PDF language", () => {
  it.each(CLIENT_REPORT_LANGS)("BMW RU ATF is not major work in %s", (lang) => {
    const facts = extractDealerFactsFromServiceWorks(bmwAtfRows);
    const summary = buildDealerVisitSummary(bmwAtfRows, facts);
    expect(summary?.majorWorks).toEqual([]);
    const summaryHtml = buildDealerVisitSummaryHtml(bmwAtfRows, facts, lang);
    const majorHtml = buildDealerMajorWorksHtml(facts, lang);
    expect(majorHtml).toBe("");
    expect(summaryHtml).toContain(ASSEMBLIES[lang]);
    expect(summaryHtml).toContain(NONE[lang]);
    if (lang !== "lv") {
      for (const lv of LEAKED_LV) expect(summaryHtml).not.toContain(lv);
    }
    const doc = render("WBA6X310305V99966", "BMW 2er", bmwAtfRows, lang);
    expect(section(doc, "pdf-svc-major")).toBe("");
    expect(doc).toContain(ASSEMBLIES[lang]);
    expect(doc).toContain(NONE[lang]);
    expect(doc).not.toMatch(/Ātrumkārba D6|Коробка передач D6|Transmission D6|Getriebe D6/);
  });

  it.each(CLIENT_REPORT_LANGS)("Volvo XC90 RAW 20.02.2018 belt and seal in %s, not engine swap", (lang) => {
    const facts = extractDealerFactsFromServiceWorks(volvoRows);
    const summary = buildDealerVisitSummary(volvoRows, facts);
    expect(summary?.campaignsDone).toBe(true);
    expect(summary?.majorWorks.map((w) => w.id).sort()).toEqual(["crankshaft_seal", "timing_belt"]);
    const majorHtml = buildDealerMajorWorksHtml(facts, lang);
    expect(majorHtml).toContain(MAJOR_HEAD[lang]);
    expect(majorHtml).toContain(`<b>${BELT[lang]}</b>`);
    expect(majorHtml).toContain(`<b>${CRANK_SEAL[lang]}</b>`);
    expect(majorHtml).not.toContain(GEARBOX[lang]);
    if (lang !== "lv") {
      expect(majorHtml).not.toContain("Zobsiksna");
      expect(majorHtml).not.toContain("Kloķvārpstas blīvslēgs");
      expect(majorHtml).not.toContain("Dzinējs");
    }
    if (lang === "lv") expect(majorHtml).not.toContain("<b>Dzinējs</b>");
    const campaigns =
      lang === "lv" ? "Jā" : lang === "en" ? "Yes" : lang === "ru" ? "Да" : "Ja";
    const summaryHtml = buildDealerVisitSummaryHtml(volvoRows, facts, lang);
    expect(summaryHtml).toContain(`>${campaigns}<`);
    const doc = render("YV1LCA4BCG1067242", "Volvo XC90", volvoRows, lang);
    const aside = section(doc, "pdf-svc-major");
    expect(aside).toContain(BELT[lang]);
    expect(aside).toContain(CRANK_SEAL[lang]);
    const dealerTitle =
      lang === "lv"
        ? "OFICIĀLĀ DĪLERA DATI"
        : lang === "en"
          ? "OFFICIAL DEALER RECORDS"
          : lang === "ru"
            ? "ДАННЫЕ ОФИЦИАЛЬНОГО ДИЛЕРА"
            : "OFFIZIELLE HÄNDLERDATEN";
    expect(doc).toContain(dealerTitle);
  });

  it.each(CLIENT_REPORT_LANGS)("BMW chain + gearbox replacement labels in %s", (lang) => {
    const facts = extractDealerFactsFromServiceWorks(bmwReplacementRows);
    const summary = buildDealerVisitSummary(bmwReplacementRows, facts);
    expect(summary?.majorWorks.map((w) => w.id).sort()).toEqual(["gearbox", "timing_chain"].sort());
    const majorHtml = buildDealerMajorWorksHtml(facts, lang);
    expect(majorHtml).toContain(MAJOR_HEAD[lang]);
    expect(majorHtml).toContain(`<b>${GEARBOX[lang]}</b>`);
    expect(majorHtml).toContain(`<b>${CHAIN[lang]}</b>`);
    expect(majorHtml).not.toMatch(/D6|ĀtrumkārbaD6|Коробка передачD6/);
    if (lang !== "lv") {
      expect(majorHtml).not.toContain("Lielie darbi");
      expect(majorHtml).not.toContain("Ātrumkārba");
      expect(majorHtml).not.toContain("Sadales ķēde");
    }
    const doc = render("WBA6X310305V99966", "BMW 2er", bmwReplacementRows, lang);
    const aside = section(doc, "pdf-svc-major");
    expect(aside).toContain(MAJOR_HEAD[lang]);
    expect(aside).toContain(GEARBOX[lang]);
    expect(aside).toContain(CHAIN[lang]);
  });

  it.each(CLIENT_REPORT_LANGS)("BMW REMAN gearbox and TwinPower oil visit labels in %s", (lang) => {
    const remanRows: AutoRecordsServiceWorkRow[] = [
      {
        date: "12.04.2021",
        odometer: "98210",
        location: "BMW Partner",
        works: BMW_REMAN_GEARBOX_WITH_OIL_LINE,
      },
      {
        date: BMW_V99966_D15_TWINPOWER_OIL_REPAIR_KIT.date,
        odometer: BMW_V99966_D15_TWINPOWER_OIL_REPAIR_KIT.odometer,
        location: "BMW Partner",
        works: BMW_V99966_D15_TWINPOWER_OIL_REPAIR_KIT.works,
      },
    ];
    const facts = extractDealerFactsFromServiceWorks(remanRows);
    expect(buildDealerVisitSummary(remanRows, facts)?.majorWorks.map((w) => w.id)).toEqual(["gearbox"]);
    const majorHtml = buildDealerMajorWorksHtml(facts, lang);
    expect(majorHtml).toContain(`<b>${GEARBOX[lang]}</b>`);
    expect(majorHtml).not.toContain(`<b>${TURBO[lang]}</b>`);
  });

  it.each(CLIENT_REPORT_LANGS)("clutch + DMF, Volvo engine/turbo, Jeep Kardāns labels in %s", (lang) => {
    const rows: AutoRecordsServiceWorkRow[] = [
      {
        date: "03.06.2020",
        odometer: "110400",
        location: "BMW Partner",
        works: BMW_CLUTCH_KIT_TWIN_MASS_PART_LIST,
      },
      {
        date: VOLVO_D4_ENGINE_TURBO_WARRANTY.date,
        odometer: VOLVO_D4_ENGINE_TURBO_WARRANTY.odometer,
        location: "Volvo Partner",
        works: VOLVO_D4_ENGINE_TURBO_WARRANTY.works,
      },
      {
        date: "18.09.2019",
        odometer: "87600",
        location: "Jeep Partner",
        works: JEEP_LV_DOOR_TRIM_AND_PROPSHAFT,
      },
    ];
    const facts = extractDealerFactsFromServiceWorks(rows);
    const ids = buildDealerVisitSummary(rows, facts)?.majorWorks.map((w) => w.id).sort();
    expect(ids).toEqual(["clutch", "dual_mass_flywheel", "engine", "propshaft", "turbo"].sort());
    const majorHtml = buildDealerMajorWorksHtml(facts, lang);
    expect(majorHtml).toContain(`<b>${CLUTCH[lang]}</b>`);
    expect(majorHtml).toContain(`<b>${DMF[lang]}</b>`);
    expect(majorHtml).toContain(`<b>${ENGINE[lang]}</b>`);
    expect(majorHtml).toContain(`<b>${TURBO[lang]}</b>`);
    expect(majorHtml).toContain(`<b>${PROPSHAFT[lang]}</b>`);
    expect(majorHtml).not.toContain(`<b>${GEARBOX[lang]}</b>`);
    if (lang !== "lv") {
      expect(majorHtml).not.toContain("Sajūgs");
      expect(majorHtml).not.toContain("Kardāns");
    }
  });

  it.each(CLIENT_REPORT_LANGS)("windscreen replacement is Lielie darbi in %s; chip/trim is not", (lang) => {
    const replaceRows: AutoRecordsServiceWorkRow[] = [
      {
        date: "14.05.2021",
        odometer: "73400",
        location: "BMW Partner",
        works: BMW_WINDSCREEN_REPLACED,
      },
    ];
    const skipRows: AutoRecordsServiceWorkRow[] = [
      {
        date: "14.05.2021",
        odometer: "73400",
        location: "BMW Partner",
        works: BMW_WINDSCREEN_CHIP_CHECK,
      },
      {
        date: "02.06.2021",
        odometer: "74100",
        location: "BMW Partner",
        works: DE_STONE_CHIP_REPAIR,
      },
      {
        date: "18.09.2019",
        odometer: "87600",
        location: "Jeep Partner",
        works: JEEP_LV_DOOR_TRIM_PANEL,
      },
    ];
    const replaceFacts = extractDealerFactsFromServiceWorks(replaceRows);
    expect(buildDealerVisitSummary(replaceRows, replaceFacts)?.majorWorks.map((w) => w.id)).toEqual([
      "body_glass",
    ]);
    const majorHtml = buildDealerMajorWorksHtml(replaceFacts, lang);
    expect(majorHtml).toContain(`<b>${BODY_GLASS[lang]}</b>`);
    const skipFacts = extractDealerFactsFromServiceWorks(skipRows);
    expect(buildDealerVisitSummary(skipRows, skipFacts)?.majorWorks).toEqual([]);
    expect(buildDealerMajorWorksHtml(skipFacts, lang)).toBe("");
  });
});


