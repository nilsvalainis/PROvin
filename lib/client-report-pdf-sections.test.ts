import { describe, expect, it } from "vitest";
import {
  createDefaultSourceBlocks,
  emptyAutoRecordsBlock,
  emptyCsddFields,
  emptyCitiAvotiSection,
  SOURCE_BLOCK_LABELS,
} from "@/lib/admin-source-blocks";
import { buildVehicleLifecycleEvents, PDF_LIFECYCLE_TITLE } from "@/lib/vehicle-lifecycle-timeline";
import {
  buildUnifiedIncidentsTableHtml,
  buildUnifiedMileageTableHtml,
  buildClientReportDocumentHtml,
  type ClientReportPayload,
} from "@/lib/client-report-html";
import { buildOutvinDealerReportPdfInnerHtml } from "@/lib/outvin-dealer-pdf-html";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import { PDF_HERO_BRAND_LOGO_DATA_URI } from "@/lib/pdf-hero-brand-logos";
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
    expect(html).toContain("Īpašnieki Latvijā: 2");
    expect(html).toContain("Kas tika pārbaudīts");
    expect(html).toContain("pdf-src-dot pdf-src-dot--autodna");
    expect(html).toContain("PAR ŠO ATSKAITI");
    expect(html.indexOf("ATSKAITES KOPSAVILKUMS")).toBeLessThan(html.indexOf("Kas tika pārbaudīts"));
    expect(html.indexOf("Kas tika pārbaudīts")).toBeLessThan(html.indexOf("PAR ŠO ATSKAITI"));
    expect(html.indexOf("PAR ŠO ATSKAITI")).toBeLessThan(html.indexOf("NOBRAUKUMA VĒSTURE"));
  });

  it("puts reconciled Latvia + Sweden owner counts on the registration tile", () => {
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
    expect(html).toContain("Reģistrācija");
    expect(html).toContain("Uzskaitē");
    expect(html).toContain("Īpašnieki Latvijā: 2 + Īpašnieki Zviedrijā: 6");
    expect(html).not.toContain("Īpašnieki Latvijā: 2 + Īpašnieki Zviedrijā: 6 + ");
    expect(html).toContain(SOURCE_BLOCK_LABELS.carinfo);
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
    expect(html).toContain(".pdf-src-zone--autodna{border-top-color:#1E3A8A;}");
    expect(html).toContain('class="pdf-ico pdf-ico--brand-logo"');
    expect(html).toContain("pdf-sec-ico-wrap--brand-logo");
    expect(html).toContain(PDF_HERO_BRAND_LOGO_DATA_URI.autodna);
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
    // Paneļu galvai vairs nav atsevišķas zilās kreisās strīpas
    const panelHead = html.slice(html.indexOf(".pdf-v1-panel-head{"));
    expect(panelHead.slice(0, 160)).not.toContain("border-left");
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

describe("Ekspluatācijas hronoloģija", () => {
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
    expect(gap!.title).toBe("Bez ierakstiem");
    expect(gap!.tone).toBe("warn");
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
    expect(html).toContain("Pirmā reģistrācija");
    // Avoti laikposmā — tikai krāsu punkti atsevišķā kolonnā + leģenda sadaļas apakšā.
    expect(html).toContain('<span class="pdf-life-srcs">');
    expect(html).toContain("pdf-life-rail");
    expect(html).not.toContain("pdf-life-tags");
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
    expect(html).toContain("pdf-mileage-history-row--anomaly");
    expect(html).toContain("pdf-num-warn--red");
    expect(html).toMatch(/\.pdf-life-item--alert\{[^}]*background:#FFF1F2/);
    expect(html).toContain("pdf-life-alert-edge");
    expect(html).not.toContain("pdf-life-alert-edge--end");
    expect(html).toMatch(/\.pdf-life-item--alert\{[^}]*margin-left:-10px/);
    expect(html).toMatch(/\.pdf-life-item--alert\{[^}]*padding-left:10px/);
    expect(html).not.toMatch(/\.pdf-life-alert-edge--end/);
    expect(html).toMatch(/\.pdf-mileage-history-row--anomaly td\{[^}]*background:#FFF1F2/);
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
    expect(service!.title).toBe("Apkope / remonts");
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
    expect(html).toMatch(/\.pdf-life-srcs\{[^}]*max-width:44px/);
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
    expect(html).toContain("Negadījumi:");
    expect(html.indexOf("pdf-listing-price-history-foot")).toBeLessThan(html.indexOf("pdf-incident-card"));
    expect(html).not.toContain("Apvienotie negadījumi");
    expect(html).not.toContain("Vidējā zaudējumu summa pa avotiem");
    expect(html).not.toContain("Kopā:");
    expect(html).not.toContain("Vidēji:");
    expect(html.indexOf("pdf-incident-history-card")).toBeLessThan(html.indexOf("Kopsavilkuma teksts"));
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
    expect(html).toContain("pdf-dmg-sil");
    expect(html).toContain("Bojājumu zonas");
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
    expect(html).toContain("Bojājumu zonas");
    expect(html).toContain("Priekšpuse");
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
    expect(doc).toContain("pdf-mileage-history-table--service");
    expect(doc).toContain("Veiktie darbi");
    expect(doc).toContain("47 521 km");
    expect(doc).toContain("Salona gaisa filtra maiņa");
    // Servisa punkts ir atsevišķā kolonnā, ne darbu šūnā
    expect(doc).toContain("pdf-service-cell-place");
    expect(doc).toContain("Niederlassung Bonn BMW AG, Bonn");
    // Jaunākais augšā — tikai servisa tabulā (ekspluatācijas hronoloģija augstāk iet hronoloģiski)
    const serviceTable = doc.slice(doc.indexOf("Servisa un remontu vēsture"));
    expect(serviceTable.indexOf("01.12.2023")).toBeLessThan(serviceTable.indexOf("01.06.2023"));
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
    expect(doc).toContain('class="pdf-service-cell-place">B&amp;K Deutschland GmbH, Osnabrück</td>');
    expect(doc).toContain(
      'class="pdf-service-cell-place">BMW Mobiler Service Einsatzleitzentrale, München</td>',
    );
    expect(doc).toContain("detalizēts darbu saraksts atskaitē nav pieejams");
    expect(doc).not.toContain(
      'class="pdf-service-cell-works">B&amp;K Deutschland GmbH, Osnabrück:',
    );
    expect(doc).not.toContain(
      'class="pdf-service-cell-works">BMW Mobiler Service Einsatzleitzentrale, München:',
    );
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

  it("PDF footer includes bold confidentiality notice under SVARĪGA INFORMĀCIJA", () => {
    const doc = buildClientReportDocumentHtml({
      payload: minimalPayload(),
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(doc).toContain("SVARĪGA INFORMĀCIJA");
    expect(doc).toContain("digitāls datu apkopojums");
    expect(doc).toContain('class="pdf-site-footer__confidentiality"');
    expect(doc).toContain("kategoriski aizliegts pavairot");
    expect(doc).toContain(`© ${new Date().getFullYear()} PROVIN.LV`);
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

  it("auto records photos render in the same two-column PDF grid", () => {
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
    expect(doc).toContain("pdf-listing-photo-grid");
    expect(doc).not.toContain("pdf-source-photo-stack");
    expect(doc).not.toContain("pdf-listing-photo-img--wide");
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
    expect(doc).toContain("6 īpašnieki");
    expect(doc).toContain("Satiksmē: nē");
    expect(doc).toContain("Eksportēts no Zviedrijas");
    expect(doc).toContain("Īpašnieku skaits");
    expect(doc).toContain("Statuss");
    expect(doc).toContain("Piezīmes");
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
