import { describe, expect, it } from "vitest";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { createDefaultSourceBlocks, emptyCsddFields } from "@/lib/admin-source-blocks";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  PDF_SOURCE_LOGO_TONE,
  buildPdfTopKeyCards,
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
