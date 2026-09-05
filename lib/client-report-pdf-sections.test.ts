import { describe, expect, it } from "vitest";
import {
  createDefaultSourceBlocks,
  emptyAutoRecordsBlock,
  emptyCsddFields,
  emptyCitiAvotiSection,
  emptyTirgusFields,
  SOURCE_BLOCK_LABELS,
} from "@/lib/admin-source-blocks";
import { KEY_READ_HISTORY_LABEL } from "@/lib/vendor-service-history";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import {
  buildVehicleLifecycleEvents,
  lifecycleLocationIsCountryName,
  PDF_LIFECYCLE_TITLE,
} from "@/lib/vehicle-lifecycle-timeline";
import {
  buildUnifiedIncidentsTableHtml,
  buildUnifiedMileageTableHtml,
  buildClientReportDocumentHtml,
  type ClientReportPayload,
} from "@/lib/client-report-html";
import { buildOutvinDealerReportPdfInnerHtml } from "@/lib/outvin-dealer-pdf-html";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import { PDF_HERO_BRAND_LOGO_DATA_URI } from "@/lib/pdf-hero-brand-logos";
import { PDF_DEALER_LOGO_DATA_URI, PDF_SOURCE_LOGO_DATA_URI } from "@/lib/pdf-source-brand-logos";
import { emptyLtabCertificate } from "@/lib/ltab-report-extract";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

function minimalPayload(overrides: Partial<ClientReportPayload> = {}): ClientReportPayload {
  return {
    sessionId: "cs_test",
    vin: "WVWZZZ1JZXW000001",
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
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    ...overrides,
  } as ClientReportPayload;
}

describe("PDF design system", () => {
  function doc(): string {
    return buildClientReportDocumentHtml({
      payload: minimalPayload({ notes: "Klienta piezīme" }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
  }

  it("declares one set of layout tokens", () => {
    const html = doc();
    expect(html).toContain("--pdf-radius-outer:12px");
    expect(html).toContain("--pdf-radius-inner:8px");
    expect(html).toContain("--pdf-gap-section:24px");
    expect(html).toContain("--pdf-fs-sec:13px");
    expect(html).toContain("--pdf-comment-bg:#F6FAFF");
    expect(html).not.toContain("background:#F3F8FF");
    expect(html).toContain(".pdf-summary-tile--alert{background:#fff;}");
    expect(html).toContain(".pdf-ltab-loss-history{\n        border-color:var(--pdf-line);background:#fff;");
  });

  it("keeps the digital PDF palette unless print-ink is requested", () => {
    const html = doc();
    expect(html).toContain("--pdf-line:#E9EDF3");
    expect(html).not.toContain('class="provin-report-print-ink"');
    expect(html).not.toContain("--pdf-line:#C5CDD8");
    expect(html).toContain("Drukāt / PDF");
    expect(html).not.toContain('document.body.innerHTML=""');
    expect(html).toContain("document.fonts.load");
  });

  it("adds a high-contrast print-ink overlay without replacing digital tokens", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({ notes: "Klienta piezīme" }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
      printInk: true,
    });
    expect(html).toContain('class="provin-report-print-ink"');
    expect(html).toContain("--pdf-line:#E9EDF3");
    expect(html).toContain("--pdf-line:#C5CDD8");
    expect(html).not.toContain("--pdf-line:#111827");
    expect(html).toContain("Drukājamā versija");
    expect(html).toContain("Drukāt (augsts kontrasts)");
    expect(html).toContain('class="no-print pdf-print-chrome"');
    expect(html).toContain(".no-print,.pdf-print-chrome,.pdf-print-ink-banner{display:none!important");
    const body = html.slice(html.indexOf("<body"));
    expect(body.indexOf("pdf-print-chrome")).toBeLessThan(body.indexOf('class="sheet"'));
  });

  it("uses tokens instead of per-section radii and paddings", () => {
    const html = doc();
    const zoneCss = html.slice(html.indexOf(".pdf-unified-mileage-zone{"));
    expect(zoneCss.slice(0, 260)).toContain("border-radius:var(--pdf-radius-outer)");
    expect(html).not.toContain("border-radius:10px;box-shadow");
    expect(html).not.toContain("font-size:8pt");
  });

  it("opens with summary tiles above the source list and the about block", () => {
    const csdd = emptyCsddFields();
    csdd.registrationStatus = "Reģistrēts";
    csdd.ownerCountLatvia = "2";
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        csddForm: csdd,
        notes: "Klienta piezīme",
        manualVendorBlocks: [
          {
            title: "AutoDNA",
            mileageRows: [{ date: "2020-07-01", odometer: "120000", country: "DE" }],
            incidentRows: [{ csngDate: "01.06.2021", lossAmount: "3500", incidentNo: "Latvija" }],
            comments: "AutoDNA komentārs",
          },
        ],
      } as Partial<ClientReportPayload>),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("ATSKAITES KOPSAVILKUMS");
    expect(html).toContain("pdf-summary-tile--alert");
    expect(html).toContain("Negadījumi un bojājumi");
    expect(html).toContain("1 negadījums");
    expect(html).toContain("120000 km");
    expect(html).toContain("Īpašnieku skaits");
    expect(html).toContain("Latvijā 2");
    expect(html).not.toContain("Latvijā: 2");
    expect(html).not.toContain("2 īpašnieki");
    expect(html).toContain("Kas tika pārbaudīts");
    expect(html).toContain("pdf-src-dot pdf-src-dot--autodna");
    expect(html).toContain("PASŪTĪJUMA DATI");
    expect(html.indexOf("ATSKAITES KOPSAVILKUMS")).toBeLessThan(html.indexOf("Kas tika pārbaudīts"));
    expect(html.indexOf("Kas tika pārbaudīts")).toBeLessThan(html.indexOf("PASŪTĪJUMA DATI"));
    expect(html.indexOf("PASŪTĪJUMA DATI")).toBeLessThan(html.indexOf("NOBRAUKUMA VĒSTURE"));
  });

  it("keeps history hub sections when CSDD-step unified flags were saved off", () => {
    const autoRecords = {
      ...createDefaultSourceBlocks().auto_records,
      serviceHistory: [{ date: "24.07.2024", odometer: "262546", country: "Vācija" }],
    };
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        autoRecordsBlock: autoRecords,
        manualVendorBlocks: [
          {
            title: "AutoDNA",
            mileageRows: [{ date: "13.08.2019", odometer: "189858", country: "Vācija" }],
            incidentRows: [{ csngDate: "01.05.2023", lossAmount: "5500-6000", incidentNo: "Vācija" }],
            comments: "Bojājumu zonas",
          },
        ],
        pdfVisibility: mergePdfVisibility({ unifiedMileage: false, unifiedIncidents: false, csdd: false }),
      } as Partial<ClientReportPayload>),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain(PDF_LIFECYCLE_TITLE);
    expect(html).toContain("NOBRAUKUMA VĒSTURE");
    expect(html).toContain("NEGADĪJUMU VĒSTURE");
    expect(html).toContain("189858");
    expect(html).toContain("01.05.2023");
  });

  it("puts reconciled Latvia + Sweden owner counts on the owner-count tile", () => {
    const csdd = emptyCsddFields();
    csdd.registrationStatus = "Uzskaitē";
    csdd.ownerCountLatvia = "2";
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        csddForm: csdd,
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.carinfo,
            mileageRows: [],
            incidentRows: [],
            comments: "",
            ownersSummary: "6 īpašnieki",
          },
          {
            title: SOURCE_BLOCK_LABELS.carvertical,
            mileageRows: [],
            incidentRows: [],
            comments: "3 īpašnieki",
          },
        ],
      } as Partial<ClientReportPayload>),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("Īpašnieku skaits");
    expect(html).toContain("Latvijā 2");
    expect(html).toContain("Zviedrijā 6");
    expect(html).not.toContain("8 īpašnieki");
    expect(html).not.toContain("kopā 8");
    expect(html).not.toContain("pdf-summary-owner-chip");
    expect(html).not.toContain("Latvijā: 2");
    expect(html).not.toContain("Īpašnieki Latvijā: 2 + Īpašnieki Zviedrijā: 6");
    expect(html).toContain(SOURCE_BLOCK_LABELS.carinfo);
  });

  it("does not show Latvian owner count when CSDD has no Latvian registration", () => {
    const csdd = emptyCsddFields();
    csdd.comments = "Dati nav pieejami.";
    csdd.ownerCountLatvia = "2";
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        csddForm: csdd,
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.autodna,
            mileageRows: [],
            incidentRows: [],
            comments: "Pirms importa Latvijā. 2 īpašnieki",
          },
        ],
      } as Partial<ClientReportPayload>),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("Īpašnieku skaits");
    expect(html).not.toContain("Latvijā 2");
    expect(html).not.toContain("Latvijā: 2");
  });

  it("keeps payment, vehicle, client and notes in one about block", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        listingUrl: "https://www.ss.lv/msg/lv/transport/cars/audi/a6/abcd.html",
        customerName: "Jānis Bērziņš",
        notes: "Interesē tikai bojājumi",
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const aboutCount = (html.match(/pdf-about-report/g) ?? []).length;
    expect(aboutCount).toBe(1);
    expect(html).toContain("Transportlīdzeklis");
    expect(html).toContain("Maksājums");
    expect(html).toContain("Jānis Bērziņš");
    expect(html).toContain("Interesē tikai bojājumi");
    expect(html).not.toContain("transportlīdzeklis un sludinājums");
    expect(html).not.toContain("klienta dati");
  });

  it("marks each source zone with its own accent and record count", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        manualVendorBlocks: [
          {
            title: "AutoDNA",
            mileageRows: [{ date: "2020-07-01", odometer: "120000", country: "DE" }],
            incidentRows: [{ csngDate: "01.06.2021", lossAmount: "3500", incidentNo: "Latvija" }],
            comments: "AutoDNA komentārs",
          },
        ],
      } as Partial<ClientReportPayload>),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("pdf-src-zone pdf-src-zone--autodna");
    expect(html).toContain("pdf-src-count-badge pdf-src-count-badge--ok");
    expect(html).toContain("2 ieraksti");
    expect(html).toContain(".pdf-src-count-badge--ok{background:#F5FBF7;color:#16a34a;}");
    expect(html).toContain(".pdf-src-zone--autodna{border-top-color:#1E3A8A;");
    expect(html).toContain("background:linear-gradient(180deg,#FFF1E8 0%,#fff 42%)");
    expect(html).toContain('class="pdf-ico pdf-ico--brand-logo"');
    expect(html).toContain("pdf-sec-ico-wrap--brand-logo");
    expect(html).toContain(PDF_HERO_BRAND_LOGO_DATA_URI.autodna);
  });

  it("embeds a shared-scale mileage spark in the AutoDNA source zone", () => {
    const csdd = emptyCsddFields();
    csdd.mileageHistory.push({ date: "01.06.2020", odometer: "120000", country: "LV" });
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        csddForm: csdd,
        manualVendorBlocks: [
          {
            title: "AutoDNA",
            mileageRows: [{ date: "01.03.2016", odometer: "80000", country: "DE" }],
            incidentRows: [],
            comments: "AutoDNA komentārs",
          },
        ],
      } as Partial<ClientReportPayload>),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("pdf-src-mileage-spark");
    expect(html).toContain('data-src-spark="autodna"');
    expect(html).toContain('data-src-spark="csdd"');
    const autodnaZone = html.slice(html.indexOf("pdf-src-zone--autodna"));
    expect(autodnaZone).toContain('data-src-spark="autodna"');
    expect(autodnaZone).toContain("01.03.2016");
    expect(html).toContain(".pdf-src-mileage-spark-ghost");
  });

  it("uses the homepage hero CarVertical logo and greens the record count when there is at least one row", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.carvertical,
            mileageRows: [{ date: "2021-03-01", odometer: "90000", country: "LT" }],
            incidentRows: [],
            comments: "CarVertical komentārs",
          },
        ],
      } as Partial<ClientReportPayload>),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("pdf-src-zone pdf-src-zone--carvertical");
    expect(html).toContain("1 ieraksts");
    expect(html).toContain("pdf-src-count-badge--ok");
    expect(html).toContain(PDF_HERO_BRAND_LOGO_DATA_URI.carvertical);
  });

  it("renders every section head with the same icon bubble and title style", () => {
    const html = doc();
    expect(html).toContain("font-size:var(--pdf-fs-sec);font-weight:700");
    // Paneļu galvai vairs nav atsevišķas zilās strīpas
    const panelHead = html.slice(html.indexOf(".pdf-v1-panel-head{"));
    expect(panelHead.slice(0, 160)).not.toContain("border-left");
  });
});

describe("PDF source-section brand logos", () => {
  it("uses the CSDD, CAR INFO, and LTAB marks on those source heads", () => {
    const csdd = emptyCsddFields();
    csdd.registrationStatus = "Reģistrēts";
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        csddForm: csdd,
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.carinfo,
            mileageRows: [],
            incidentRows: [],
            comments: "Zviedrijas reģistrs",
          },
        ],
        manualLtabBlock: {
          rows: [],
          comments: "LTAB komentārs",
          certificate: { ...emptyLtabCertificate(), accidentCount: "0" },
        },
      } as Partial<ClientReportPayload>),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain(PDF_SOURCE_LOGO_DATA_URI.csdd);
    expect(html).toContain(PDF_SOURCE_LOGO_DATA_URI.carinfo);
    expect(html).toContain(PDF_SOURCE_LOGO_DATA_URI.ltab);
  });

  it("puts the hero dealer manufacturer logo on OFICIĀLĀ DĪLERA DATI when make is known", () => {
    const csdd = emptyCsddFields();
    csdd.makeModel = "AUDI A6";
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        csddForm: csdd,
        autoRecordsBlock: {
          ...emptyAutoRecordsBlock(),
          comments: "Dīlera servisa vēsture",
        },
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("OFICIĀLĀ DĪLERA DATI");
    expect(html).toContain(PDF_DEALER_LOGO_DATA_URI.audi);
  });

  it("prints OneAuto OEM tables under OFICIĀLĀ DĪLERA DATI", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        oneautoBlock: {
          ...createDefaultSourceBlocks().oneauto,
          display: {
            powertrain: [{ label: "Dzinējs", value: "D4204T14" }],
            equipment: [{ label: "Panorāmas jumts", value: "Jā" }],
            serviceTimeline: [
              {
                date: "23.12.2020",
                odometer: "142220",
                place: "Volvo",
                works: "Eļļas maiņa",
              },
            ],
          },
        },
        pdfVisibility: mergePdfVisibility({ auto_records: true }),
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("OFICIĀLĀ DĪLERA DATI");
    expect(html).toContain("23.12.2020");
    expect(html).toContain("142 220 km");
    expect(html).toContain("Eļļas maiņa");
    expect(html).toContain("D4204T14");
    expect(html).toContain("Panorāmas jumts");
  });

  it("uses ss.lv / auto24.ee / mobile.de logos from the listing URL, otherwise the search icon", () => {
    const listing = {
      ...createDefaultSourceBlocks().listing_analysis,
      sellerPortrait: "Privāts pārdevējs.",
    };
    const sslv = buildClientReportDocumentHtml({
      payload: minimalPayload({
        listingUrl: "https://www.ss.lv/msg/lv/transport/cars/audi/a6/abcd.html",
        listingAnalysis: listing,
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(sslv).toContain(PDF_SOURCE_LOGO_DATA_URI.sslv);

    const auto24 = buildClientReportDocumentHtml({
      payload: minimalPayload({
        listingUrl: "https://www.auto24.ee/used/12345",
        listingAnalysis: listing,
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(auto24).toContain(PDF_SOURCE_LOGO_DATA_URI.auto24);

    const mobile = buildClientReportDocumentHtml({
      payload: minimalPayload({
        listingUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=1",
        listingAnalysis: listing,
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(mobile).toContain(PDF_SOURCE_LOGO_DATA_URI.mobilede);

    const other = buildClientReportDocumentHtml({
      payload: minimalPayload({
        listingUrl: "https://www.andelemandele.lv/item/1",
        listingAnalysis: listing,
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(other).not.toContain(PDF_SOURCE_LOGO_DATA_URI.sslv);
    expect(other).not.toContain(PDF_SOURCE_LOGO_DATA_URI.auto24);
    expect(other).not.toContain(PDF_SOURCE_LOGO_DATA_URI.mobilede);
    expect(other).toContain("SLUDINĀJUMA ANALĪZE");
  });
});

describe("TRANSPORTLĪDZEKĻA DATI", () => {
  it("moves the technical fields into their own section and out of the CSDD zone", () => {
    const csdd = emptyCsddFields();
    csdd.makeModel = "BMW 520d";
    csdd.fuelType = "Dīzelis";
    csdd.enginePowerKw = "140";
    csdd.engineDisplacementCm3 = "1995";
    csdd.registrationNumber = "AB1234";
    csdd.registrationStatus = "Reģistrēts";
    csdd.ownerCountLatvia = "3";
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({ csddForm: csdd }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("TRANSPORTLĪDZEKĻA DATI");
    expect(html).toContain("BMW 520d");
    expect(html.indexOf("TRANSPORTLĪDZEKĻA DATI")).toBeLessThan(html.indexOf("Kas tika pārbaudīts"));
    const csddZone = html.slice(html.indexOf("pdf-src-zone pdf-src-zone--csdd"));
    expect(csddZone).toContain("AB1234");
    expect(csddZone).not.toContain("Degvielas veids:");
    // Īpašnieku skaits paliek tikai īpašnieku laika joslā
    expect((html.match(/Īpašnieku skaits Latvijā:/g) ?? []).length).toBeLessThanOrEqual(1);
  });
});

describe("Vēstures kopsavilkums", () => {
  it("rāda CC.VIN pārdošanas summu kopsavilkuma joslā", () => {
    const ccVin = emptyCcVinBlock();
    ccVin.sales = [
      {
        date: "20.11.2019",
        venue: "Bmw Of Murrieta (Murrieta, CA)",
        odometer: "5 660",
        price: "38 745 USD",
        status: "Pārdots",
      },
    ];
    const events = buildVehicleLifecycleEvents({ ccVinBlock: ccVin });
    const sale = events.find((e) => e.kind === "sale");
    expect(sale).toBeTruthy();
    expect(sale!.date).toBe("20.11.2019");
    expect(sale!.detail).toBe("35 550 €");
    expect(sale!.title).toContain("Bmw Of Murrieta");
  });


  it("keeps a month-only clustered incident in the timeline (CarVertical 01.MM + LTAB day)", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: "carVertical",
          mileageRows: [],
          incidentRows: [{ csngDate: "01.05.2016", lossAmount: "1 501 - 2 000 €", incidentNo: "Latvija" }],
          comments: "",
        },
      ],
      manualLtabBlock: {
        rows: [{ csngDate: "16.05.2016", lossAmount: "1 521.14 €", incidentNo: "Latvija" }],
        comments: "",
      },
    });
    const incident = events.find((e) => e.kind === "incident");
    expect(incident).toBeTruthy();
    expect(incident!.title).toBe("Negadījums");
    expect(incident!.date).toBe("05.2016");
    expect(incident!.time).toBe(Date.UTC(2016, 4, 16));
    expect(incident!.year).toBe("2016");
  });

  it("keeps a CarVertical MM.YYYY-only incident in the timeline", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: "carVertical",
          mileageRows: [],
          incidentRows: [{ csngDate: "05.2016", lossAmount: "1 636 €", incidentNo: "Latvija" }],
          comments: "",
        },
      ],
    });
    const incident = events.find((e) => e.kind === "incident");
    expect(incident).toBeTruthy();
    expect(incident!.date).toBe("05.2016");
    expect(incident!.time).toBeGreaterThan(0);
    expect(incident!.year).toBe("2016");
  });

  it("builds one chronological lifecycle from all sources", () => {
    const csdd = emptyCsddFields();
    csdd.firstRegistration = "12.05.2016";
    csdd.previousRegistrationCountry = "Vācija";
    csdd.ownerRegistrationEvents = [{ date: "03.02.2021", label: "Reģistrēts uz jaunu īpašnieku" }];
    csdd.technicalInspectionHistory = [
      {
        date: "10.03.2022",
        inspectionType: "Kārtējā",
        ratingLabel: "Bez trūkumiem",
        ratingLevel: 1,
        maxDefectLevel: null,
        smokeCoefficient: "",
        notes: "",
        defects: [],
      },
    ];
    const events = buildVehicleLifecycleEvents({
      csddForm: csdd,
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [{ date: "01.07.2019", odometer: "90000", country: "Vācija" }],
          incidentRows: [{ csngDate: "01.06.2021", lossAmount: "3500", incidentNo: "Latvija" }],
          comments: "",
        },
      ],
    });
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("first_registration");
    expect(kinds).toContain("registration");
    expect(kinds).toContain("inspection");
    expect(kinds).toContain("incident");
    expect(kinds).toContain("import");
    const times = events.map((e) => e.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("attaches same-month odometer readings to the fact instead of a separate row", () => {
    const events = buildVehicleLifecycleEvents({
      autoRecordsBlock: {
        ...emptyAutoRecordsBlock(),
        serviceWorks: [
          { date: "05.09.2022", odometer: "120000", location: "BMW Bonn", works: "Eļļas maiņa" },
        ],
      },
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [{ date: "07.09.2022", odometer: "120000", country: "Vācija" }],
          incidentRows: [],
          comments: "",
        },
      ],
    });
    const service = events.filter((e) => e.kind === "service");
    expect(service).toHaveLength(1);
    expect(service[0]!.odometer).toBe("120000");
    expect(events.filter((e) => e.kind === "odometer")).toHaveLength(0);
  });

  it("marks long silences between records", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [
            { date: "01.01.2016", odometer: "10000", country: "Vācija" },
            { date: "01.01.2021", odometer: "80000", country: "Vācija" },
          ],
          incidentRows: [],
          comments: "",
        },
      ],
    });
    const gap = events.find((e) => e.kind === "gap");
    expect(gap).toBeTruthy();
    expect(gap!.title).toMatch(/^Aptuveni \d+ mēneši bez ierakstiem$/);
    expect(gap!.detail).toBe("");
    expect(gap!.tone).toBe("warn");
  });

  it("puts tjekbil registry timeline events into the history summary with km", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.tjekbil,
          mileageRows: [{ date: "18.12.2017", odometer: "29000", country: "Dānija" }],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            { date: "18.12.2013", country: "Vācija", description: "Pirmā reģistrācija", odometer: "17" },
            {
              date: "18.12.2017",
              country: "Dānija",
              description: "Tehniskā apskate: izieta ar pirmo reizi",
              odometer: "29000",
            },
            { date: "12.08.2026", country: "Dānija", description: "Noņemts no uzskaites" },
          ],
        },
      ],
    });
    const first = events.find((e) => e.kind === "first_registration");
    expect(first?.title).toBe("Pirmā reģistrācija");
    expect(first?.odometer).toBe("17");
    expect(first?.country).toBe("Vācija");
    const inspection = events.find((e) => e.kind === "inspection");
    expect(inspection?.title).toBe("Tehniskā apskate");
    expect(inspection?.detail).toMatch(/izieta ar pirmo reizi/);
    expect(inspection?.odometer).toBe("29000");
    expect(events.some((e) => /Noņemts no uzskaites/.test(e.title))).toBe(true);
  });

  it("prints the timeline before the mileage section", () => {
    const csdd = emptyCsddFields();
    csdd.firstRegistration = "12.05.2016";
    csdd.mileageHistory = [{ date: "01.06.2020", odometer: "120000", country: "LV" }];
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({ csddForm: csdd }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain(PDF_LIFECYCLE_TITLE);
    expect(html).toContain("pdf-life-year__num");
    expect(html).toContain("pdf-life-card");
    expect(html).toContain("Pirmā reģistrācija");
    expect(html).toContain('<span class="pdf-life-srcs">');
    expect(html).toContain("pdf-life-rail");
    expect(html).not.toContain("pdf-life-tags");
    expect(html).toMatch(/\.pdf-life-year\{[^}]*background:#E8F1FC/);
    expect(html.indexOf(PDF_LIFECYCLE_TITLE)).toBeLessThan(html.indexOf("NOBRAUKUMA VĒSTURE"));
  });

  it("highlights an odometer contradiction as a red alert in the timeline and mileage table", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.autodna,
            mileageRows: [
              { date: "01.01.2020", odometer: "150000", country: "Nīderlande" },
              { date: "01.01.2022", odometer: "80000", country: "Latvija" },
            ],
            incidentRows: [],
            comments: "",
          },
        ],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("Iespējama odometra pretruna");
    expect(html).toContain("pdf-life-item--alert");
    expect(html).toContain("pdf-life-card--alert");
    expect(html).toContain("pdf-mileage-history-row--anomaly");
    expect(html).toContain("pdf-num-warn--red");
    expect(html).toMatch(/\.pdf-life-card--alert\{[^}]*background:#FFF1F2/);
    expect(html).toContain("pdf-life-alert-edge");
    expect(html).not.toContain("pdf-life-alert-edge--end");
    expect(html).not.toMatch(/\.pdf-life-alert-edge--end/);
    expect(html).toMatch(/\.pdf-mileage-history-row--anomaly td\{[^}]*background:#FFF1F2/);
  });

  it("highlights a long record gap as an amber warning on the timeline", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.autodna,
            mileageRows: [
              { date: "01.01.2016", odometer: "10000", country: "Vācija" },
              { date: "01.01.2021", odometer: "80000", country: "Vācija" },
            ],
            incidentRows: [],
            comments: "",
          },
        ],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("mēneši bez ierakstiem");
    expect(html).not.toContain("bez neviena ieraksta nevienā avotā");
    expect(html).toContain("pdf-life-break--gap");
    expect(html).toContain("pdf-life-break__chip");
    expect(html).toContain("pdf-life-break__title");
    expect(html).toContain("pdf-life-rail--dash");
    expect(html).not.toContain("pdf-life-gap-edge");
    expect(html).not.toMatch(/\.pdf-life-break--gap \.pdf-life-break__chip\{[^}]*background:#FFFCF3/);
    const gapLi = html.match(/<li class="pdf-life-break pdf-life-break--gap">[\s\S]*?<\/li>/);
    expect(gapLi?.[0]).toContain("pdf-life-rail--dash");
    expect(gapLi?.[0]).not.toContain("pdf-life-break__detail");
  });

  it("renders a country change as a centered flag card without a Valsts maiņa label", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.autodna,
            mileageRows: [
              { date: "01.01.2020", odometer: "100000", country: "Zviedrija" },
              { date: "01.06.2021", odometer: "120000", country: "Latvija" },
            ],
            incidentRows: [],
            comments: "",
          },
        ],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("pdf-life-card--import");
    expect(html).toContain("pdf-life-imp");
    expect(html).toMatch(/aria-label="Zviedrija → Latvija"/);
    expect(html).not.toContain("Valsts maiņa");
    const importLi = html.match(/<li class="pdf-life-item pdf-life-item--import">[\s\S]*?<\/li>/);
    expect(importLi?.[0]).toContain("Zviedrija");
    expect(importLi?.[0]).toContain("Latvija");
    expect(importLi?.[0]).toContain("→");
    expect(importLi?.[0]).toContain("pdf-life-rail");
    expect(importLi?.[0]).not.toContain("pdf-life-card__kind");
  });

  it("renders hub incidents as the same hanging cards as other events", () => {
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        manualVendorBlocks: [
          {
            title: "carVertical",
            mileageRows: [],
            incidentRows: [{ csngDate: "05.2016", lossAmount: "913 €", incidentNo: "Latvija" }],
            comments: "",
          },
        ],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const zoneStart = html.indexOf('pdf-lifecycle-zone" role="region"');
    const incidentsStart = html.indexOf(">NEGADĪJUMU VĒSTURE<");
    const zone = html.slice(zoneStart, incidentsStart);
    expect(zone).toContain("pdf-life-item--incident");
    expect(zone).toContain("pdf-life-card__grid");
    expect(zone).toContain("pdf-life-km--loss");
    expect(zone).toContain("pdf-num-warn--red");
    expect(zone).toContain("pdf-warn-tri-ico--lg");
    expect(zone).not.toContain("pdf-num-warn--yellow");
    expect(zone).toContain("Negadījums");
    expect(zone).toContain("Latvija");
    expect(zone).not.toContain("pdf-incident-card--hub");
    expect(zone).not.toContain("pdf-life-card--incident");
    expect(zone).not.toContain("pdf-life-item--alert");
    expect(zone).not.toContain("pdf-incident-card__datecol");
    expect(zone).not.toContain("pdf-incident-card__srcs");
    expect(zone).not.toContain("pdf-dmg-sil");
    const incidentsSection = html.slice(incidentsStart);
    expect(incidentsSection).toContain("pdf-incident-card");
    expect(incidentsSection).toContain("pdf-incident-card__srcs");
  });

  it("keeps only the flagged country line when location is just a country name", () => {
    expect(lifecycleLocationIsCountryName("Vācija")).toBe(true);
    expect(lifecycleLocationIsCountryName("B&K Deutschland GmbH, Osnabrück")).toBe(false);

    const events = buildVehicleLifecycleEvents({
      autoRecordsBlock: {
        ...emptyAutoRecordsBlock(),
        serviceWorks: [
          {
            date: "05.07.2021",
            odometer: "221195",
            location: "Vācija",
            works: "Apkope",
          },
          {
            date: "28.06.2021",
            odometer: "221000",
            location: "B&K Deutschland GmbH, Osnabrück",
            works: "Eļļas maiņa",
          },
        ],
      },
      manualVendorBlocks: [
        {
          title: "carVertical",
          mileageRows: [
            { date: "05.07.2021", odometer: "221195", country: "Vācija" },
            { date: "28.06.2021", odometer: "221000", country: "Vācija" },
          ],
          incidentRows: [],
          comments: "",
        },
      ],
    });
    const countryOnly = events.find((e) => e.kind === "service" && e.date === "05.07.2021");
    expect(countryOnly).toBeTruthy();
    expect(countryOnly!.detail).toBe("");
    expect(countryOnly!.country).toBe("Vācija");
    const workshop = events.find((e) => e.kind === "service" && e.date === "28.06.2021");
    expect(workshop!.detail).toBe("B&K Deutschland GmbH, Osnabrück");
    expect(workshop!.country).toBe("Vācija");

    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        autoRecordsBlock: {
          ...emptyAutoRecordsBlock(),
          serviceWorks: [
            {
              date: "05.07.2021",
              odometer: "221195",
              location: "Vācija",
              works: "Apkope",
            },
            {
              date: "28.06.2021",
              odometer: "221000",
              location: "B&K Deutschland GmbH, Osnabrück",
              works: "Eļļas maiņa",
            },
          ],
        },
        manualVendorBlocks: [
          {
            title: "carVertical",
            mileageRows: [
              { date: "05.07.2021", odometer: "221195", country: "Vācija" },
              { date: "28.06.2021", odometer: "221000", country: "Vācija" },
            ],
            incidentRows: [],
            comments: "",
          },
        ],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const list = html.match(/<ol class="pdf-life-list">[\s\S]*?<\/ol>/)?.[0] ?? "";
    expect(list).not.toMatch(/pdf-life-card__sub">Vācija</);
    expect(list).toContain("B&amp;K Deutschland GmbH, Osnabrück");
    const julyCard = list.match(/05\.07\.2021[\s\S]*?<\/li>/)?.[0] ?? "";
    expect((julyCard.match(/Vācija/g) ?? []).length).toBe(1);
  });

  it("omits opaque dealer ID codes from the lifecycle caption", () => {
    const events = buildVehicleLifecycleEvents({
      autoRecordsBlock: {
        ...emptyAutoRecordsBlock(),
        serviceWorks: [
          { date: "12.05.2026", odometer: "303616", location: "Dīlera ID: 00863-3", works: "Apkope" },
        ],
      },
    });
    const service = events.find((e) => e.kind === "service");
    expect(service).toBeTruthy();
    expect(service!.detail).toBe("");
    expect(service!.title).toBe("Servisa apmeklējums");
  });

  it("keeps a real workshop name next to a stripped dealer ID", () => {
    const events = buildVehicleLifecycleEvents({
      autoRecordsBlock: {
        ...emptyAutoRecordsBlock(),
        serviceWorks: [
          {
            date: "12.05.2026",
            odometer: "303616",
            location: "BMW Bonn, Dīlera ID: 00863 - 3",
            works: "Apkope",
          },
        ],
      },
    });
    expect(events.find((e) => e.kind === "service")!.detail).toBe("BMW Bonn");
  });

  it("keeps detailed service work lists off the lifecycle hub", () => {
    const events = buildVehicleLifecycleEvents({
      autoRecordsBlock: {
        ...emptyAutoRecordsBlock(),
        serviceWorks: [
          {
            date: "05.09.2022",
            odometer: "120000",
            location: "BMW Bonn",
            works: "Eļļas maiņa, filtri, bremžu šķidrums",
          },
        ],
      },
    });
    const service = events.find((e) => e.kind === "service");
    expect(service).toBeTruthy();
    expect(service!.title).toBe("Apkope");
    expect(service!.detail).toBe("BMW Bonn");
    expect(service!.detail).not.toMatch(/eļļas|filtri|bremžu/i);

    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        autoRecordsBlock: {
          ...emptyAutoRecordsBlock(),
          serviceWorks: [
            {
              date: "05.09.2022",
              odometer: "120000",
              location: "BMW Bonn",
              works: "Eļļas maiņa, filtri, bremžu šķidrums",
            },
          ],
        },
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const list = html.match(/<ol class="pdf-life-list">[\s\S]*?<\/ol>/)?.[0] ?? "";
    expect(list).toContain("Apkope");
    expect(list).toContain("BMW Bonn");
    expect(list).not.toContain("Eļļas maiņa");
    expect(list).not.toContain("bremžu šķidrums");
  });

  it("does not label Key Read snapshots as Apkope", () => {
    const events = buildVehicleLifecycleEvents({
      autoRecordsBlock: {
        ...emptyAutoRecordsBlock(),
        serviceWorks: [
          { date: "01.04.2025", odometer: "88000", location: "BMW Bonn", works: KEY_READ_HISTORY_LABEL },
          { date: "18.06.2021", odometer: "124100", location: "BMW Bonn", works: "Update DVD Road Map Europe Professional" },
        ],
      },
    });
    expect(events.find((e) => e.odometer === "88000")!.title).toBe("Dīlera nolasījums");
    expect(events.find((e) => e.odometer === "124100")!.title).toBe("Servisa apmeklējums");
    expect(events.filter((e) => e.kind === "service").every((e) => e.title !== "Apkope")).toBe(true);
  });

  it("puts the manufacturer logo on official-dealer hub cards", () => {
    const csdd = emptyCsddFields();
    csdd.makeModel = "BMW X5";
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        csddForm: csdd,
        autoRecordsBlock: {
          ...emptyAutoRecordsBlock(),
          serviceWorks: [
            { date: "18.06.2021", odometer: "124100", location: "BMW Bonn", works: "Eļļas maiņa" },
          ],
        },
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const list = html.match(/<ol class="pdf-life-list">[\s\S]*?<\/ol>/)?.[0] ?? "";
    expect(list).toContain("pdf-life-ico--brand");
    expect(list).toContain(PDF_DEALER_LOGO_DATA_URI.bmw);
    expect(list).toContain("Apkope");
  });

  it("wraps more than four source dots so they do not overflow the odometer", () => {
    const csdd = emptyCsddFields();
    csdd.mileageHistory = [{ date: "12.05.2026", odometer: "303616", country: "DE" }];
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({
        csddForm: csdd,
        autoRecordsBlock: {
          ...emptyAutoRecordsBlock(),
          serviceWorks: [
            { date: "12.05.2026", odometer: "303616", location: "Dīlera ID: 00863-3", works: "Apkope" },
          ],
        },
        manualVendorBlocks: [
          {
            title: "AutoDNA",
            mileageRows: [{ date: "12.05.2026", odometer: "303616", country: "Vācija" }],
            incidentRows: [],
            comments: "",
          },
          {
            title: "CarVertical",
            mileageRows: [{ date: "12.05.2026", odometer: "303616", country: "Vācija" }],
            incidentRows: [],
            comments: "",
          },
          {
            title: "CC VIN",
            mileageRows: [{ date: "12.05.2026", odometer: "303616", country: "Vācija" }],
            incidentRows: [],
            comments: "",
          },
        ],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const zone = html.slice(html.indexOf("pdf-lifecycle-zone"), html.indexOf("NOBRAUKUMA VĒSTURE"));
    expect(zone).toContain("pdf-life-srcs--wrap");
    expect(zone).not.toContain("Dīlera ID");
    expect(html).toMatch(/\.pdf-life-srcs\{[^}]*flex-wrap:wrap/);
    expect(html).not.toMatch(/\.pdf-life-srcs\{[^}]*max-width:44px/);
  });

  it("keeps the flagged country on one line under a long TA rating", () => {
    const csdd = emptyCsddFields();
    csdd.technicalInspectionHistory = [
      {
        date: "13.06.2024",
        inspectionType: "Kārtējā",
        ratingLabel: "2 - Ar mēneša laikā labojamiem defektiem",
        ratingLevel: 2,
        maxDefectLevel: 2,
        smokeCoefficient: "",
        notes: "",
        defects: [],
      },
    ];
    const html = buildClientReportDocumentHtml({
      payload: minimalPayload({ csddForm: csdd }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const list = html.match(/<ol class="pdf-life-list">[\s\S]*?<\/ol>/)?.[0] ?? "";
    expect(list).toContain("pdf-life-ta--warn");
    expect(list).toContain("2 - Ar mēneša laikā labojamiem defektiem");
    expect(list).toMatch(/pdf-life-country[\s\S]*pdf-country-flag[\s\S]*Latvija/);
    expect(html).toMatch(/\.pdf-life-country\{[^}]*white-space:nowrap/);
    expect(html).toMatch(/\.pdf-life-card__grid\{[^}]*minmax\(0,1fr\)/);
  });
});

describe("unified PDF sections single block", () => {
  it("mileage zone is one card: chart, table, source count, comment", () => {
    const csdd = emptyCsddFields();
    csdd.mileageHistory.push({ date: "2020-06-01", odometer: "120000", country: "LV" });
    const html = buildUnifiedMileageTableHtml({
      csddForm: csdd,
      mileageComment: "Nobraukuma komentārs",
    });
    expect(html).toContain("pdf-unified-mileage-zone__body");
    expect(html).not.toContain("pdf-unified-mileage-zone--continued");
    expect(html.indexOf("NOBRAUKUMA VĒSTURE")).toBeLessThan(html.indexOf("Nobraukuma komentārs"));
    expect(html.indexOf("Grafika ģenerēšanā izmantotais avotu skaits:")).toBeLessThan(
      html.indexOf("Nobraukuma komentārs"),
    );
  });

  it("merges same km from multiple sources into one row with multiple stripes", () => {
    const csdd = emptyCsddFields();
    csdd.mileageHistory.push({ date: "2020-06-01", odometer: "120000", country: "LV" });
    const html = buildUnifiedMileageTableHtml({
      csddForm: csdd,
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [{ date: "2020-07-01", odometer: "120000", country: "DE" }],
          incidentRows: [],
          comments: "",
        },
      ],
    });
    const rowMatches = html.match(/pdf-mileage-history-row/g) ?? [];
    expect(rowMatches.length).toBe(1);
    expect(html).toContain("pdf-src-dots");
    expect(html).toContain("pdf-src-dot--csdd");
    expect(html).toContain("pdf-src-dot--autodna");
  });

  it("plots ss.lv listing odometer on first publication date in the unified chart", () => {
    const html = buildUnifiedMileageTableHtml({
      listingUrl: "https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html",
      tirgusForm: {
        ...emptyTirgusFields(),
        listingCreated: "16.07.2026",
        listingMileageDate: "01.08.2026",
        listingMileageOdometer: "233 000",
        listingMileageCountry: "Vācija",
      },
    });
    expect(html).toContain("16.07.2026");
    expect(html).toContain("233");
    expect(html).toContain("ss.lv");
    expect(html).toContain("pdf-src-dot--sslv");
    expect(html).not.toContain("01.08.2026");
  });

  it("incidents zone is one card: table, source count, kopsavilkums", () => {
    const p = {
      internalComment: "Kopsavilkuma teksts",
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [],
          incidentRows: [{ csngDate: "2021-06-01", lossAmount: "1200", incidentNo: "LV" }],
          comments: "",
          pdfChecklist: { incidents: false, mileageHistory: false, mileageLine: false },
        },
      ],
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ unifiedIncidents: true });
    const html = buildUnifiedIncidentsTableHtml(p, vis);
    expect(html).toContain("pdf-unified-incidents-zone__body");
    expect(html).not.toContain("pdf-unified-incidents-zone--continued");
    expect(html).toContain("NEGADĪJUMU VĒSTURES KOPSAVILKUMS");
    expect(html).toContain("pdf-incident-history-card");
    expect(html).toContain("pdf-inc-list");
    expect(html).toContain("pdf-inc-item");
    expect(html).toContain("pdf-incident-count");
    expect(html).toContain("1 negadījums");
    expect(html).not.toContain("Negadījumi:");
    expect(html.indexOf("pdf-incident-count")).toBeLessThan(html.indexOf("pdf-incident-card"));
    expect(html).not.toContain("Apvienotie negadījumi");
    expect(html).not.toContain("Vidējā zaudējumu summa pa avotiem");
    expect(html).not.toContain("Kopā:");
    expect(html).not.toContain("Vidēji:");
    expect(html.indexOf("pdf-incident-history-card")).toBeLessThan(html.indexOf("Kopsavilkuma teksts"));
  });

  it("renders incident photos directly under the incidents summary comment", () => {
    const photoId = "inc_ph_aabbccddeeff001122334455";
    const p = {
      internalComment: "Kopsavilkuma teksts",
      incidentPhotos: [{ id: photoId }],
      incidentPhotoGroups: [{ id: "inc_phg_aabbccddeeff001122334455", title: "", photos: [{ id: photoId }] }],
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [],
          incidentRows: [{ csngDate: "2021-06-01", lossAmount: "1200", incidentNo: "LV" }],
          comments: "",
          pdfChecklist: { incidents: false, mileageHistory: false, mileageLine: false },
        },
      ],
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ unifiedIncidents: true });
    const urls = new Map<string, string>([[photoId, "data:image/jpeg;base64,/9j/4AAQ"]]);
    const html = buildUnifiedIncidentsTableHtml(p, vis, urls);
    expect(html).toContain("pdf-incident-photos");
    expect(html).toContain("pdf-listing-photo-img");
    expect(html).toContain("data:image/jpeg;base64,/9j/4AAQ");
    expect(html.indexOf("Kopsavilkuma teksts")).toBeLessThan(html.indexOf("pdf-incident-photos"));
  });

  it("renders source valuations as colored pills in one row", () => {
    const p = {
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [],
          incidentRows: [{ csngDate: "01.06.2021", lossAmount: "3500", incidentNo: "Latvija" }],
          comments: "",
        },
        {
          title: "CarVertical",
          mileageRows: [],
          incidentRows: [{ csngDate: "01.06.2021", lossAmount: "2584", incidentNo: "Latvija" }],
          comments: "",
        },
      ],
      manualLtabBlock: {
        rows: [{ csngDate: "16.06.2021", lossAmount: "2778", incidentNo: "Latvija" }],
        comments: "",
      },
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ unifiedIncidents: true });
    const html = buildUnifiedIncidentsTableHtml(p, vis);
    expect(html).toContain("pdf-src-tags pdf-incident-card__srcs");
    expect(html).toContain("pdf-src-dot--ltab");
    expect(html).toContain("pdf-src-dot--autodna");
    expect(html).toContain("pdf-src-dot--carvertical");
    expect(html).not.toContain("pdf-incident-source-vals");
    expect(html).toMatch(/~[\d\s]+€/);
    expect(html).not.toContain("vid.");
  });

  it("renders damage zones and top-down silhouette on incident cards", () => {
    const p = {
      internalComment: "Kopsavilkums",
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.carvertical,
          mileageRows: [],
          incidentRows: [{ csngDate: "01.06.2024", lossAmount: "5001 € – 10 000 €", incidentNo: "Šveice" }],
          comments: "",
          damageDetails: [
            {
              date: "01.06.2024",
              country: "Šveice",
              lossAmount: "5001 € – 10 000 €",
              damagedSides: "Kreisā puse Priekšpuse",
              damageGroups: "Ārējās virsbūves detaļas",
            },
          ],
        },
      ],
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ unifiedIncidents: true });
    const html = buildUnifiedIncidentsTableHtml(p, vis);
    expect(html).toContain("01.06.2024");
    expect(html).toContain("pdf-incident-card--with-dmg");
    expect(html).toContain("pdf-incident-card__main");
    expect(html).toContain("pdf-incident-card__body");
    expect(html).toContain("pdf-inc-amount");
    expect(html).toContain("pdf-dmg-sil");
    expect(html).toContain("pdf-incident-chips");
    expect(html).not.toContain("Bojājumu zonas");
    expect(html).not.toContain("Bojājumu grupas");
    expect(html).toContain("Kreisā puse");
    expect(html).toContain("Priekšpuse");
    expect(html).toContain("Ārējās virsbūves detaļas");
    expect(html).not.toContain("pdf-cv-damage-sub");
    expect(html).not.toContain("pdf-cv-damage-chart");
  });

  it("renders silhouette from AutoDNA sourceRaw when damageDetails were never saved", () => {
    const p = {
      manualVendorBlocks: [
        {
          title: "AutoDNA",
          mileageRows: [],
          incidentRows: [{ csngDate: "01.10.2020", lossAmount: "1300 - 1400 EUR", incidentNo: "Latvija" }],
          comments: "",
          sourceRaw: `
10.2020
Transportlīdzekļa zaudējumu apjoms
Summa 1 300 - 1 400 EUR
Detaļu grupa - Virsbūves ārējās daļas
Valsts Latvija
Bojājumu zona
- Priekšpuse
- Labā sāna priekšpuse
- Kreisā sāna priekšpuse
`,
        },
      ],
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ unifiedIncidents: true });
    const html = buildUnifiedIncidentsTableHtml(p, vis);
    expect(html).toContain("pdf-dmg-sil");
    expect(html).toContain("pdf-incident-chips");
    expect(html).not.toContain("Bojājumu zonas");
    expect(html).toContain("Priekšpuse");
  });

  it("always draws the car silhouette even when the incident has no zone data", () => {
    const p = {
      manualVendorBlocks: [
        {
          title: "CarVertical",
          mileageRows: [],
          incidentRows: [{ csngDate: "01.02.2023", lossAmount: "2376", incidentNo: "Spānija" }],
          comments: "",
        },
      ],
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ unifiedIncidents: true });
    const html = buildUnifiedIncidentsTableHtml(p, vis);
    expect(html).toContain("pdf-dmg-sil");
    expect(html).toContain("01.02.2023");
    expect(html).toContain("Spānija");
    expect(html).not.toContain("pdf-incident-chips");
  });
});

describe("CITI AVOTI and Outvin PDF labels", () => {
  it("renders Auto Records Servisa vēsture in client PDF", () => {
    const autoRecords = {
      ...createDefaultSourceBlocks().auto_records,
      serviceHistoryNotes: "12.03.2019 | 87450 km | Eļļas maiņa\n01.06.2020 | 102300 km | Bremžu kluči",
      comments: "",
    };
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        autoRecordsBlock: autoRecords,
        pdfVisibility: mergePdfVisibility({ auto_records: true }),
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("Servisa vēsture");
    expect(doc).toContain("Eļļas maiņa");
    expect(doc).toContain("102300");
  });

  it("renders Auto Records Eļļas maiņas intervāli in client PDF", () => {
    const autoRecords = {
      ...createDefaultSourceBlocks().auto_records,
      oilChangeIntervalNotes:
        "Fiksētas 3 eļļas maiņas. Intervāli 18 000-22 000 km pret ražotāja 15 000 km.",
      comments: "",
    };
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        autoRecordsBlock: autoRecords,
        pdfVisibility: mergePdfVisibility({ auto_records: true }),
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("Eļļas maiņas intervāli");
    expect(doc).toContain("18 000-22 000 km");
  });

  it("renders Auto Records service works table in client PDF", () => {
    const autoRecords = {
      ...createDefaultSourceBlocks().auto_records,
      serviceWorks: [
        {
          date: "01.06.2023",
          odometer: "26276",
          location: "",
          works: "Regulārā apkope: Eļļas maiņa",
        },
        {
          date: "01.12.2023",
          odometer: "47521",
          location: "Niederlassung Bonn BMW AG, Bonn",
          works: "Regulārā apkope: Salona gaisa filtra maiņa, Eļļas maiņa",
        },
      ],
      comments: "",
    };
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        autoRecordsBlock: autoRecords,
        pdfVisibility: mergePdfVisibility({ auto_records: true }),
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("Servisa un remontu vēsture");
    expect(doc).toContain("pdf-svc-visit");
    expect(doc).toContain("47 521 km");
    expect(doc).toContain("Salona gaisa filtra maiņa");
    expect(doc).toContain("Niederlassung Bonn BMW AG, Bonn");
    expect(doc).not.toContain("pdf-mileage-history-table--service");
    const serviceZone = doc.slice(doc.indexOf("Servisa un remontu vēsture"));
    const visits = serviceZone.slice(serviceZone.indexOf("pdf-svc-visit"));
    expect(visits.indexOf("01.12.2023")).toBeLessThan(visits.indexOf("01.06.2023"));
  });

  it("keeps service works inline and wraps long descriptions instead of clipping", () => {
    const autoRecords = {
      ...createDefaultSourceBlocks().auto_records,
      serviceWorks: [
        {
          date: "21.06.2018",
          odometer: "181383",
          location: "B&K Deutschland GmbH, Osnabrück",
          works: "Navigācijas karšu atjaunināšana (DVD Road Map Europe Professional)",
        },
      ],
      comments: "",
    };
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        autoRecordsBlock: autoRecords,
        pdfVisibility: mergePdfVisibility({ auto_records: true }),
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const serviceZone = doc.slice(doc.indexOf("Servisa un remontu vēsture"));
    expect(serviceZone).toContain("Navigācijas karšu atjaunināšana (DVD Road Map Europe Professional)");
    expect(serviceZone).toContain("pdf-svc-work");
  });

  it("moves dealer names out of works into the Vieta column", () => {
    const autoRecords = {
      ...createDefaultSourceBlocks().auto_records,
      serviceWorks: [
        {
          date: "05.09.2019",
          odometer: "198833",
          location: "",
          works: "B&K Deutschland GmbH, Osnabrück: detalizēts darbu saraksts atskaitē nav pieejams",
        },
        {
          date: "12.04.2012",
          odometer: "80000",
          location: "",
          works:
            "BMW Mobiler Service Einsatzleitzentrale, München: detalizēts darbu saraksts atskaitē nav pieejams",
        },
      ],
      comments: "",
    };
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        autoRecordsBlock: autoRecords,
        pdfVisibility: mergePdfVisibility({ auto_records: true }),
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("B&amp;K Deutschland GmbH, Osnabrück");
    expect(doc).toContain("BMW Mobiler Service Einsatzleitzentrale, München");
    expect(doc).toContain("Detalizēts darbu saraksts atskaitē nav pieejams");
    expect(doc).not.toMatch(/pdf-svc-work[^>]*>B&amp;K Deutschland GmbH/);
    expect(doc).not.toMatch(/pdf-svc-work[^>]*>BMW Mobiler Service/);
  });

  it("dealer-only report prints official dealer data and omits other sources", () => {
    const csdd = emptyCsddFields();
    csdd.makeModel = "BMW 530d";
    const autoRecords = {
      ...createDefaultSourceBlocks().auto_records,
      serviceWorks: [
        {
          date: "01.12.2023",
          odometer: "47521",
          location: "Niederlassung Bonn BMW AG, Bonn",
          works: "Regulārā apkope: Eļļas maiņa",
        },
      ],
    };
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        pdfReportKind: "dealer",
        csddForm: csdd,
        autoRecordsBlock: autoRecords,
        iriss: "Pilns kopsavilkums no visiem avotiem.",
        tehniskoRiskuAnalize: "Tehniskais risks no CSDD.",
        manualLtabBlock: {
          rows: [],
          comments: "LTAB komentārs nedrīkst parādīties.",
          certificate: { ...emptyLtabCertificate(), accidentCount: "2" },
        },
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("PROVIN DĪLERIS");
    expect(doc).toContain("pdf-dealer-cover");
    expect(doc).toContain("BMW 530d");
    expect(doc).toContain("OFICIĀLĀ DĪLERA DATI");
    expect(doc).toContain("Niederlassung Bonn BMW AG, Bonn");
    expect(doc).not.toContain("TRANSPORTLĪDZEKĻA AUDITS");
    expect(doc).not.toContain(PDF_LIFECYCLE_TITLE);
    expect(doc).not.toContain("APPROVED BY IRISS");
    expect(doc).not.toContain("Pilns kopsavilkums no visiem avotiem.");
    expect(doc).not.toContain("LTAB komentārs nedrīkst parādīties.");
    expect(doc).not.toContain('class="pdf-csdd');
  });

  it("citi avoti subheads use manual label only, without CITI AVOTI prefix", () => {
    const p = {
      citiAvoti: {
        sections: [
          { ...emptyCitiAvotiSection(), label: "Mans avots", comments: "Teksts" },
        ],
      },
    } as ClientReportPayload;
    const vis = mergePdfVisibility({ citi_avoti: true, unifiedMileage: false, unifiedIncidents: false });
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        citiAvoti: p.citiAvoti,
        pdfVisibility: vis,
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("Mans avots");
    expect(doc).not.toContain("CITI AVOTI — Mans avots");
  });

  it("PDF footer is a document colophon without website marketing or issuer personal data", () => {
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload(),
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("Atruna");
    expect(doc).toContain("Konfidencialitāte");
    expect(doc).toContain("digitāls datu apkopojums");
    expect(doc).toContain("kategoriski aizliegts pavairot");
    expect(doc).toContain("PROVIN AUDITS");
    expect(doc).toContain("VIN WVWZZZ1JZXW000001");
    expect(doc).toContain('class="pdf-doc-footer"');
    expect(doc).not.toContain("pdf-doc-footer__issuer");
    expect(doc).not.toContain("pdf-doc-footer__accent");
    expect(doc).not.toContain(" ·  provin.lv");
    expect(doc).toContain("pdf-doc-footer__logo");
    expect(doc).toContain('aria-label="PROVIN.LV"');
    expect(doc).not.toContain("SVARĪGA INFORMĀCIJA");
    expect(doc).not.toContain("Standarta vēstures atskaites");
    expect(doc).not.toContain("Lietošanas noteikumi");
    expect(doc).not.toContain("Personas datu apstrāde");
    expect(doc).not.toContain("Nils Valainis");
    expect(doc).not.toContain("091187");
    expect(doc).not.toContain("Jana iela");
    expect(doc).not.toContain("getCompanyLegal");
  });

  it("listing analysis photos render in two-column grid under Fotogrāfiju analīze", () => {
    const dataUrls = new Map<string, string>([
      ["la_ph_aabbccddeeff001122334455", "data:image/jpeg;base64,/9j/4AAQ"],
      ["la_ph_112233445566778899aabbcc", "data:image/jpeg;base64,/9j/4AAQ"],
    ]);
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        listingAnalysis: {
          ...createDefaultSourceBlocks().listing_analysis,
          photoAnalysis: "<p><strong>Rūsa</strong> uz sliežu.</p>",
          photoGroups: [
            {
              id: "la_phg_aabbccddeeff001122334455",
              title: "2024-06-12 — ss.com",
              photos: [{ id: "la_ph_aabbccddeeff001122334455" }, { id: "la_ph_112233445566778899aabbcc" }],
            },
          ],
          photos: [{ id: "la_ph_aabbccddeeff001122334455" }, { id: "la_ph_112233445566778899aabbcc" }],
        },
        pdfVisibility: mergePdfVisibility({ sludinajums: true }),
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
      listingAnalysisPhotoDataUrls: dataUrls,
    });
    expect(doc).toContain("Fotogrāfiju analīze");
    expect(doc).toContain("pdf-listing-photo-grid");
    expect(doc).toContain("pdf-subhead--photo");
    expect(doc).toContain("2024-06-12 — ss.com");
    expect(doc).toContain("Rūsa");
    expect((doc.match(/class="pdf-listing-photo-img"/g) ?? []).length).toBe(2);
  });

  it("auto records photos print as a numbered two-column appendix", () => {
    const dataUrls = new Map<string, string>([
      ["ar_ph_aabbccddeeff001122334455", "data:image/jpeg;base64,/9j/4AAQ"],
      ["ar_ph_112233445566778899aabbcc", "data:image/jpeg;base64,/9j/4AAQ"],
      ["ar_ph_aabbccddeeff998877665544", "data:image/jpeg;base64,/9j/4AAQ"],
    ]);
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        autoRecordsBlock: {
          ...createDefaultSourceBlocks().auto_records,
          photoGroups: [
            {
              id: "ar_phg_aabbccddeeff001122334455",
              title: "Dīlera foto",
              photos: [
                { id: "ar_ph_aabbccddeeff001122334455" },
                { id: "ar_ph_112233445566778899aabbcc" },
                { id: "ar_ph_aabbccddeeff998877665544" },
              ],
            },
          ],
          photos: [
            { id: "ar_ph_aabbccddeeff001122334455" },
            { id: "ar_ph_112233445566778899aabbcc" },
            { id: "ar_ph_aabbccddeeff998877665544" },
          ],
        },
        pdfVisibility: mergePdfVisibility({ auto_records: true }),
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
      autoRecordsPhotoDataUrls: dataUrls,
    });
    expect(doc).toContain("Fotogrāfiju pielikums");
    expect(doc).toContain("pdf-listing-photo-grid--appendix");
    expect(doc).toMatch(/\.pdf-listing-photo-grid--appendix\{[^}]*grid-template-columns:1fr 1fr/);
    expect(doc).toContain("pdf-listing-photo-cap");
    expect(doc).toContain(">01</figcaption>");
    expect(doc).toContain(">03</figcaption>");
    expect((doc.match(/class="pdf-listing-photo-img"/g) ?? []).length).toBe(3);
  });

  it("outvin vehicle info uses single-column pdf-v1-kv", () => {
    const report = emptyOutvinDealerReport();
    report.vehicleInfo.vinCode = "WVWZZZ";
    report.vehicleInfo.model = "Golf";
    const html = buildOutvinDealerReportPdfInnerHtml(report);
    expect(html).toContain("pdf-v1-kv");
    expect(html).not.toContain("mirror-table--outvin-vehicle");
    expect(html).not.toContain("pdf-outvin-equipment-grid");
  });

  it("outvin equipment prints as pills without a dash between code and text", () => {
    const report = emptyOutvinDealerReport();
    report.equipment = [{ code: "S403A", description: "Panorāmas stikla jumts" }];
    const html = buildOutvinDealerReportPdfInnerHtml(report);
    expect(html).toContain("pdf-dealer-eq");
    expect(html).toContain("S403A");
    expect(html).toContain("Panorāmas stikla jumts");
    expect(html).not.toContain("\u2014");
    expect(html).not.toContain("\u2013");
  });

  it("APPROVED BY IRISS prints technical risks before inspection and summary", () => {
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        tehniskoRiskuAnalize: "<p>Tech risks body</p>",
        apskatesPlāns: "<p>Inspection body</p>",
        iriss: "<p>Summary body</p>",
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    const iTech = doc.indexOf("1. Tehnisko risku analīze");
    const iInsp = doc.indexOf("2. Ieteikumi klātienes apskatei");
    const iSum = doc.indexOf("3. Kopsavilkums");
    expect(iTech).toBeGreaterThan(-1);
    expect(iInsp).toBeGreaterThan(iTech);
    expect(iSum).toBeGreaterThan(iInsp);
    expect(doc).toContain("Tech risks body");
  });

  it("prints car.info owners, status and notes in the source PDF section", () => {
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.carinfo,
            mileageRows: [{ date: "09.06.2023", odometer: "298540", country: "Zviedrija" }],
            incidentRows: [],
            comments: "",
            ownersSummary: "6 īpašnieki",
            statusRecords: "Satiksmē: nē\nKrāsa: melna, metālika",
            autoNotes: "Eksportēts no Zviedrijas (11.10.2023).",
          },
        ],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain(SOURCE_BLOCK_LABELS.carinfo);
    expect(doc).toContain("Satiksmē: nē");
    expect(doc).toContain("Eksportēts no Zviedrijas");
    expect(doc).toContain("Statuss");
    expect(doc).toContain("Piezīmes");
    expect(doc).toContain("Īpašnieku skaits");
    expect(doc).toContain("Zviedrijā 6");
    expect(doc).not.toContain("6 īpašnieki");
    expect(doc).not.toContain("⚠");
    expect(doc).not.toContain("RED FLAG");
  });

  it("prints tjekbil owners, status and notes in the source PDF section", () => {
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload({
        manualVendorBlocks: [
          {
            title: SOURCE_BLOCK_LABELS.tjekbil,
            mileageRows: [{ date: "19.09.2024", odometer: "106869", country: "Dānija" }],
            incidentRows: [],
            comments: "",
            ownersSummary: "2 īpašnieki (pēc OCTA polišu maiņām)",
            statusRecords: "Izmantošanas veids: TAKSOMETRS",
            autoNotes: "Īpašais statuss: TAKSOMETRS.",
          },
        ],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain(SOURCE_BLOCK_LABELS.tjekbil);
    expect(doc).toContain("2 īpašnieki");
    expect(doc).toContain("TAKSOMETRS");
    expect(doc).toContain("Īpašnieku skaits");
    expect(doc).toContain("Statuss");
    expect(doc).toContain("Piezīmes");
    expect(doc).not.toContain("⚠");
  });
});
