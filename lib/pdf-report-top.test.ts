import { describe, expect, it } from "vitest";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { createDefaultSourceBlocks, emptyAutoRecordsBlock, emptyCsddFields } from "@/lib/admin-source-blocks";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { applyClientReportDynamicTranslations } from "@/lib/client-report-dynamic-i18n";
import { formatLatviaTenureShort } from "@/lib/latvia-registration-tenure";
import {
  PDF_SOURCE_LOGO_TONE,
  PDF_TOP6_CSS,
  PDF_TOP_TITLE_SAFETY,
  pdfTopTextEm,
  buildPdfTopKeyCards,
  buildPdfTopSectionHtml,
  pdfSymmetricGridPlacement,
  pdfSymmetricGridRows,
  pdfTopAgeLabel,
  pdfTopFitPx,
  pdfTopMakeLogoUri,
  recolorSvgToTone,
  resolvePdfTopPhoto,
} from "@/lib/pdf-report-top";
import type { PdfSummaryTile } from "@/lib/pdf-report-summary";

const AUC = "data:image/jpeg;base64,/9j/auction";
const LA = "data:image/jpeg;base64,/9j/listing";
const TIRGUS = "data:image/jpeg;base64,/9j/tirgus";

function ccWithAuction() {
  return {
    ...emptyCcVinBlock(),
    sales: [{ date: "01.10.2026", venue: "Openlane", odometer: "210 648 km", price: "", status: "" }],
    photoGroups: [
      {
        id: "g1",
        title: "Openlane · 2026-10-01",
        photos: [
          { id: "ih_ph_1", sourceUrl: "https://img/1.jpg", contentHash: "h1" },
          { id: "ih_ph_2", sourceUrl: "https://img/2.jpg", contentHash: "h2" },
        ],
      },
      { id: "g0", title: "Autobid · 2025-03-02", photos: [{ id: "ih_ph_0", sourceUrl: "https://img/0.jpg", contentHash: "h0" }] },
    ],
    thecarapiRecords: [
      { site: "autobid", id: "a", date: "2025-03-02", venue: "Autobid", photoDate: "2025-03-02", photoUrls: ["https://img/0.jpg"], fields: [], raw: null, rawHistory: null, rawDetail: null, rawImages: null, photos: [] },
      { site: "openlane", id: "b", date: "2026-10-01", venue: "Openlane", photoDate: "2026-10-01", photoUrls: ["https://img/2.jpg", "https://img/1.jpg"], fields: [], raw: null, rawHistory: null, rawDetail: null, rawImages: null, photos: [] },
    ],
  } as unknown as ReturnType<typeof emptyCcVinBlock>;
}

describe("foto prioritāte", () => {
  const maps = {
    ccVinPhotoDataUrls: new Map([["ih_ph_0", AUC + "0"], ["ih_ph_1", AUC + "1"], ["ih_ph_2", AUC + "2"]]),
    listingAnalysisPhotoDataUrls: new Map([["la_1", LA]]),
    sourceBlockPhotoDataUrls: new Map([["sbp_1", TIRGUS]]),
  };
  const listingAnalysis = { coverPhoto: { id: "la_1" }, photos: [] };
  const tirgusForm = { photoGroups: [{ title: "ss.com · 12.11.2026", photos: [{ id: "sbp_1" }] }] };

  it("1) jaunākās izsoles pirmā bilde", () => {
    const p = resolvePdfTopPhoto({ ccVinBlock: ccWithAuction(), ...maps, listingAnalysis, tirgusForm });
    expect(p).toMatchObject({ src: AUC + "2", kind: "auction", where: "Openlane", date: "01.10.2026" });
  });

  it("izsoles grupa bez TheCarApi ieraksta - jaunākā grupa pēc virsraksta datuma", () => {
    const cc = { ...ccWithAuction(), thecarapiRecords: [] };
    const p = resolvePdfTopPhoto({ ccVinBlock: cc, ...maps });
    expect(p).toMatchObject({ src: AUC + "1", where: "Openlane", date: "01.10.2026" });
  });

  it("2) sludinājuma analīzes foto, ja izsoles bildes nav", () => {
    const p = resolvePdfTopPhoto({ ccVinBlock: emptyCcVinBlock(), ...maps, listingAnalysis, tirgusForm, listingUrl: "https://www.ss.com/msg/1.html" });
    expect(p).toMatchObject({ src: LA, kind: "listing", where: "ss.com", listingCoverId: "la_1" });
  });

  it("3) sludinājuma vēstures titulbilde", () => {
    const p = resolvePdfTopPhoto({ ccVinBlock: null, ...maps, listingAnalysis: null, tirgusForm });
    expect(p).toMatchObject({ src: TIRGUS, kind: "listingHistory" });
  });

  it("4) bez foto - null, foto bloka nav vispār (Nils 24.11), divu kolonnu izkārtojums", () => {
    expect(resolvePdfTopPhoto({ ccVinBlock: null, listingAnalysis: null, tirgusForm: null })).toBeNull();
    const html = doc({}, "lv");
    expect(html).not.toContain(`class="pdf-top6__ph`);
    expect(html).not.toContain("Foto nav pieejams");
    expect(html).toContain("pdf-top6__hero--nophoto");
  });
});

describe("simetriskais režģis (Nila likums 24.11)", () => {
  it.each([
    [1, [1]],
    [2, [2]],
    [3, [3]],
    [4, [4]],
    [5, [5]],
    [6, [3, 3]],
    [7, [4, 3]],
    [8, [4, 4]],
    [9, [3, 3, 3]],
  ])("%i kartītes → %j", (n, rows) => {
    expect(pdfSymmetricGridRows(n)).toEqual(rows);
  });

  it("visas kartītes vienā platumā, īsākā rinda pie kreisās malas", () => {
    const { cols, cells } = pdfSymmetricGridPlacement(7);
    expect(cols).toBe(4);
    expect(cells.slice(0, 4).map((c) => c.col)).toEqual([1, 3, 5, 7]);
    // 3 kartītes 8 pusšūnās: 1-2, 3-4, 5-6 → pie kreisās malas, zem augšējās rindas kartītēm.
    expect(cells.slice(4).map((c) => c.col)).toEqual([1, 3, 5]);
    expect(cells.slice(4).every((c) => c.row === 2)).toBe(true);
  });

  it("«Bez neatbilstībām» 5 kartīšu rindā ietilpst vienā rindā", () => {
    const inner = (700 - 40) / 5 - 30;
    expect(pdfTopFitPx("Bez neatbilstībām", inner, 12, 8.5)).not.toBeNull();
  });
});

describe("galvenās kartītes", () => {
  const tiles: PdfSummaryTile[] = [
    { id: "incidents", label: "Negadījumi un bojājumi", value: "3 bojājumu ieraksti", note: "Jaunākais: 04.2026", tone: "alert" },
    { id: "mileage", label: "Nobraukums", value: "210 648 km", note: "18 rādījumi bez pretrunām", tone: "ok", readings: 18 },
    { id: "owners", label: "Īpašnieku skaits", value: "Nav ierakstu", note: "", tone: "neutral" },
    { id: "service", label: "Servisa vēsture", value: "15 ieraksti", note: "", tone: "ok", latestDate: "16.09.2026" },
  ];
  it("5 kartītes maketa secībā, statuss vārdos, risks / nav datu toņi", () => {
    const cards = buildPdfTopKeyCards({ baseTiles: tiles, ccVinBlock: ccWithAuction(), auctionsVisible: true, auctionsHaveData: true, lang: "lv" });
    expect(cards.map((c) => [c.label, c.value, c.note, c.tone])).toEqual([
      ["Bojājumi", "3 bojājumu ieraksti", "Jaunākais: 04.2026", "risk"],
      ["Odometrs", "Bez neatbilstībām", "18 rādījumi", "plain"],
      ["Īpašnieki", "Nav ierakstu", "", "none"],
      ["Izsoles", "2 izsoles", "Openlane · 01.10.2026", "plain"],
      ["Serviss", "15 ieraksti", "Pēdējais 16.09.2026", "plain"],
    ]);
  });
  it("izsoļu arhīvs bez izsolēm - «Nav atrastas»; bez arhīva datiem - «Nav datu»", () => {
    const none = buildPdfTopKeyCards({ baseTiles: [], ccVinBlock: emptyCcVinBlock(), auctionsVisible: true, auctionsHaveData: true, lang: "lv" });
    expect(none[0]).toMatchObject({ value: "Nav atrastas", tone: "plain" });
    const nodata = buildPdfTopKeyCards({ baseTiles: [], ccVinBlock: null, auctionsVisible: true, auctionsHaveData: false, lang: "de" });
    expect(nodata[0]).toMatchObject({ label: "Auktionen", value: "Keine Daten", tone: "none" });
  });
});

describe("kartīte «Serviss» ar markas logo (Nils 25.11, makets A)", () => {
  const svc = (dealerRecords: number): PdfSummaryTile[] => [
    { id: "service", label: "Servisa vēsture", value: "15 ieraksti", note: "", tone: "ok", latestDate: "16.09.2026", dealerRecords },
  ];
  const html = (cards: ReturnType<typeof buildPdfTopKeyCards>) =>
    buildPdfTopSectionHtml({
      lang: "lv",
      logoSvg: "<svg></svg>",
      kindTitle: "Business",
      dateLabel: "25.11.2026",
      makeModel: "BMW 320d",
      vin: "WBA5R1C0XLFH42873",
      specLine: "",
      photo: null,
      odometer: null,
      age: "",
      firstReg: null,
      cards,
      sources: [],
      totals: { paid: 0, pub: 0, other: 0 },
      wordmarkHtml: "",
    });
  const card = (h: string) => h.match(/<div class="pdf-top6-card pdf-top6-card--service"[^]*?<\/div>/)?.[0] ?? "";

  it("BMW ar dīlera ierakstiem - logo ir etiķetē, teksts nelūst", () => {
    const uri = pdfTopMakeLogoUri("BMW 320d")!;
    expect(uri).toBeTruthy();
    for (const lang of ["lv", "en", "ru", "de"] as const) {
      const cards = buildPdfTopKeyCards({ baseTiles: svc(15), auctionsVisible: false, auctionsHaveData: false, serviceLogoUri: uri, lang });
      expect(cards[0]!.labelLogoUri).toBe(uri);
      const c = card(html(cards));
      expect(c).toMatch(/<p class="pdf-top6__lab" style="display:flex;align-items:center;gap:6px;font-size:7\.5px"><img src="data:image\/svg\+xml;base64,[^"]+" alt="" style="height:13px;width:auto/);
      expect(c).not.toContain("white-space:normal");
    }
  });
  it("servisa dati nav no dīlera - bez logo", () => {
    const cards = buildPdfTopKeyCards({ baseTiles: svc(0), auctionsVisible: false, auctionsHaveData: false, serviceLogoUri: pdfTopMakeLogoUri("BMW 320d"), lang: "lv" });
    expect(cards[0]!.labelLogoUri).toBeUndefined();
    expect(card(html(cards))).not.toContain("<img");
  });
  it("nezināma marka - bez logo", () => {
    expect(pdfTopMakeLogoUri("ZZTOP X1")).toBeNull();
    const cards = buildPdfTopKeyCards({ baseTiles: svc(15), auctionsVisible: false, auctionsHaveData: false, serviceLogoUri: pdfTopMakeLogoUri("ZZTOP X1"), lang: "lv" });
    expect(card(html(cards))).not.toContain("<img");
  });
  it("pilnā dokumentā: dīlera servisa ieraksti + BMW → logo kartītē «Serviss»", () => {
    const h = doc(
      {
        csddForm: { ...emptyCsddFields(), makeModel: "BMW 320D", registrationStatus: "Reģistrēts" },
        autoRecordsBlock: {
          ...emptyAutoRecordsBlock(),
          serviceHistory: [{ date: "16.09.2026", odometer: "120000", country: "DE" }],
        } as ClientReportPayload["autoRecordsBlock"],
      },
      "lv",
    );
    const c = card(h);
    expect(c).toContain("Serviss");
    expect(c).toContain("<img");
  });
});

describe("logo", () => {
  it("noklusējumā oriģinālās krāsas (Nila izvēle 24.11)", () => {
    expect(PDF_SOURCE_LOGO_TONE).toBeNull();
    const html = doc({ csddForm: { ...emptyCsddFields(), registrationStatus: "Reģistrēts", ownerCountLatvia: "1" } }, "lv");
    const csdd = /alt="CSDD"/.test(html) ? html.match(/src="data:image\/svg\+xml;base64,([^"]+)"[^>]*alt="CSDD"/)?.[1] : null;
    expect(csdd).toBeTruthy();
    expect(Buffer.from(csdd!, "base64").toString("utf8")).toContain("#006225");
  });
  it("pārslēgšana uz vienu toni saglabā balto «caurumu»", () => {
    const svg = '<svg><path fill="#0073F0"/><path style="fill:#FFFFFF"/><path fill="#000"/></svg>';
    expect(recolorSvgToTone(svg, "#48484a")).toBe('<svg><path fill="#48484a"/><path style="fill:#FFFFFF"/><path fill="#48484a"/></svg>');
  });
  it("markas logo apgriezts līdz zīmei", () => {
    const uri = pdfTopMakeLogoUri("OPEL VIVARO")!;
    const svg = Buffer.from(uri.split(",")[1]!, "base64").toString("utf8");
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="190.352" height="118.202" viewBox="32.824 68.899 190.352 118.202">/);
  });
});

describe("vecums", () => {
  it("«5 g. 11 mēn.» 4 valodās", () => {
    const from = Date.UTC(2020, 11, 9);
    const now = Date.UTC(2026, 10, 24);
    expect(pdfTopAgeLabel(from, now, "lv")).toBe("5 g. 11 mēn.");
    expect(pdfTopAgeLabel(from, now, "en")).toBe("5 yrs 11 mos");
    expect(pdfTopAgeLabel(from, now, "ru")).toBe("5 г. 11 мес.");
    expect(pdfTopAgeLabel(from, now, "de")).toBe("5 J. 11 Mon.");
  });
});

function doc(extra: Partial<ClientReportPayload>, lang: ClientReportLang): string {
  return buildClientReportDocumentHtml({
    payload: {
      sessionId: "cs_test",
      vin: "VXEVFAHKKM7805359",
      created: Date.now() / 1000,
      amountTotal: 6999,
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
      listingAnalysis: createDefaultSourceBlocks().listing_analysis,
      ...extra,
    } as ClientReportPayload,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
    lang,
  });
}

describe("4 valodas", () => {
  it.each([
    ["lv", "Galvenā informācija", "Izsoles foto", "atskaites ģenerēšanā izmantotie avoti"],
    ["en", "Key information", "Auction photo", "Sources used for the"],
    ["ru", "Основная информация", "Фото с аукциона", "Источники, использованные в отчёте"],
    ["de", "Wichtigste Informationen", "Auktionsfoto", "-Bericht verwendete Quellen"],
  ] as const)("%s", (lang, keyInfo, photo, sources) => {
    const html = doc({ ccVinBlock: ccWithAuction() }, lang);
    expect(html).toContain(keyInfo);
    expect(html).toContain(sources);
    expect(html).not.toContain("ATSKAITES KOPSAVILKUMS");
    const withPhoto = buildClientReportDocumentHtml({
      payload: { ...docPayload(), ccVinBlock: ccWithAuction() } as ClientReportPayload,
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
      ccVinPhotoDataUrls: new Map([["ih_ph_2", AUC]]),
      lang,
    });
    expect(withPhoto).toContain(`${photo} · Openlane · 01.10.2026`);
    // Augšdaļa ir viens nepārtraucams bloks.
    expect(withPhoto).toMatch(/\.pdf-top6\{[^}]*break-inside:avoid/);
  });
});

function docPayload(): Partial<ClientReportPayload> {
  return {
    sessionId: "cs_test",
    vin: "VXEVFAHKKM7805359",
    created: Date.now() / 1000,
    amountTotal: 6999,
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
  };
}

describe("iPhone 25.11: tituls kolonnā, A4 priekšskatījums, reģistrācijas ilgums", () => {
  const LONG = ["BMW 530D XDRIVE", "MERCEDES-BENZ GLE 350 D 4MATIC", "VOLKSWAGEN PASSAT VARIANT"];

  it.each(LONG.flatMap((m) => [[m, true], [m, false]] as const))("tituls «%s» (foto: %s) ietilpst ar rezervi", (model, foto) => {
    const html = buildPdfTopSectionHtml({
      lang: "lv",
      logoSvg: "",
      kindTitle: "Audits",
      kindSub: "",
      dateLabel: "25.11.2026",
      makeModel: model,
      vin: "WBAJN51050G000001",
      specLine: "",
      photo: foto ? { src: AUC, kind: "auction", where: "Openlane", date: "01.10.2026" } : null,
      odometer: { value: "195 501 km", sub: "" },
      age: "",
      firstReg: null,
      cards: [],
      sources: [],
      totals: { paid: 0, pub: 0, other: 0 },
      wordmarkHtml: "PROVIN",
    } as unknown as Parameters<typeof buildPdfTopSectionHtml>[0]);
    const W = foto ? 246 : 330;
    const m = /<h1 class="pdf-top6__model" data-fit-min="18" style="font-size:([\d.]+)px(;white-space:nowrap)?"/.exec(html);
    expect(m).not.toBeNull();
    const px = Number(m![1]);
    const lines = m![2] ? 1 : 2;
    // Aplēstais platums (vienā vai divās rindās) nepārsniedz kolonnu ar 8 % rezervi.
    expect((pdfTopTextEm(model) * px) / lines).toBeLessThanOrEqual(W * PDF_TOP_TITLE_SAFETY + 0.5);
  });

  it("CSS: kolonnas minmax(0,1fr), min-width:0, tituls lūzt drošā vietā", () => {
    expect(PDF_TOP6_CSS).toContain(".pdf-top6__hero--nophoto{grid-template-columns:minmax(0,1fr) minmax(0,1fr)");
    expect(PDF_TOP6_CSS).toContain(".pdf-top6__id,.pdf-top6__photo{min-width:0;}");
    expect(PDF_TOP6_CSS).toMatch(/\.pdf-top6__model\{[^}]*overflow-wrap:anywhere/);
  });

  it("dokumentā: A4 viewport, ekrāna platums 210 mm, pielāgošana pirms «fonts ready»", () => {
    const html = doc({ csddForm: { ...emptyCsddFields(), makeModel: "BMW 530D XDRIVE", registrationStatus: "Reģistrēts" } }, "lv");
    expect(html).toContain('<meta name="viewport" content="width=794"/>');
    expect(html).toMatch(/@media screen\{\s*body\.provin-report-doc\{width:210mm;max-width:none;padding:10mm 12mm/);
    const fit = html.indexOf("try{provinFitTop6();}");
    expect(fit).toBeGreaterThan(0);
    expect(fit).toBeLessThan(html.indexOf('setAttribute("data-provin-fonts","ready")'));
  });

  it("reģistrācijas ilgums: dienas līdz 1 mēn., tālāk mēn./g.", () => {
    expect(formatLatviaTenureShort(1, 0)).toBe("1 diena");
    expect(formatLatviaTenureShort(27, 0)).toBe("27 dienas");
    expect(formatLatviaTenureShort(163, 5)).toBe("5 mēn.");
    expect(formatLatviaTenureShort(400, 13)).toBe("1 g. 1 mēn.");
    expect(formatLatviaTenureShort(731, 24)).toBe("2 g.");
  });

  it.each([
    ["en", "1 yrs 3 mos", "5 mos", "12 days"],
    ["ru", "1 г. 3 мес.", "5 мес.", "12 дн."],
    ["de", "1 J. 3 Mon.", "5 Mon.", "12 Tage"],
  ] as const)("ilguma tulkojums %s", (lang, ym, mo, d) => {
    const html = `<body><p class="pdf-top6-card__v">1 g. 3 mēn.</p><p>5 mēn.</p><p>12 dienas</p><p>Ilgums 5 mēn. kopš</p></body>`;
    const out = applyClientReportDynamicTranslations(html, lang);
    expect(out).toContain(`>${ym}<`);
    expect(out).toContain(`>${mo}<`);
    expect(out).toContain(`>${d}<`);
    // Tikai viss teksta mezgls - teikumi netiek aiztikti.
    expect(out).toContain(">Ilgums 5 mēn. kopš<");
  });
});
