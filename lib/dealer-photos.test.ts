import { describe, expect, it } from "vitest";

import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import {
  DEALER_PHOTOS_MAX,
  addDealerPhotos,
  collectDealerPhotoGalleries,
  dealerPhotoSrc,
  dealerPhotoThumbUrl,
  dealerPhotosApproxBytes,
  dealerPhotosPdfPayload,
  dealerPhotosPdfPlan,
  normalizeDealerPhotos,
  patchDealerPhoto,
  removeDealerPhoto,
  setAllDealerPhotosSend,
  toggleDealerCover,
} from "@/lib/dealer-photos";
import { dealerExtraFilesError } from "@/lib/dealer-send-extra-files";

const h = (c: string) => c.repeat(24);
const AR = `ar_ph_${h("a")}`;
const IH = `ih_ph_${h("b")}`;
const LA = `la_ph_${h("c")}`;
const INC = `inc_ph_${h("d")}`;
const SBP = `sbp_ph_${h("e")}`;
const ASV = `asv_ph_${h("f")}`;
const IMG = "data:image/jpeg;base64,AAAA";

function payload(over: Partial<ClientReportPayload> = {}): ClientReportPayload {
  return {
    sessionId: "cs_test",
    vin: "WVWZZZ1JZXW000001",
    created: Date.now(),
    amountTotal: 2499,
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
    pdfReportKind: "dealer",
    ...over,
  } as ClientReportPayload;
}

function doc(p: ClientReportPayload, urls?: Map<string, string>, lang: "lv" | "en" = "lv"): string {
  return buildClientReportDocumentHtml({
    payload: p,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
    dealerPhotoDataUrls: urls,
    lang,
  });
}

describe("dealer photos state", () => {
  it("recognises every gallery by id prefix", () => {
    expect([AR, IH, LA, INC, SBP, ASV].map(dealerPhotoSrc)).toEqual([
      "auto_records",
      "cc_vin",
      "listing_analysis",
      "incident",
      "source_block",
      "asv",
    ]);
    expect(dealerPhotoSrc("bad")).toBeNull();
    expect(dealerPhotoThumbUrl("cs_1", IH)).toContain("/api/admin/cc-vin-photo?sessionId=cs_1&photoId=");
  });

  it("adds references without duplicates, nothing selected by default", () => {
    const s = addDealerPhotos(null, [AR, IH, AR, "x"]);
    expect(s.items).toEqual([{ id: AR }, { id: IH }]);
    expect(s.coverId).toBeNull();
    const plan = dealerPhotosPdfPlan(s);
    expect(plan.load).toEqual([]);
  });

  it("blur / send / cover are independent per reference; remove keeps the rest", () => {
    let s = addDealerPhotos(null, [AR, IH, LA]);
    s = patchDealerPhoto(s, IH, { blur: true, send: true });
    s = patchDealerPhoto(s, LA, { send: true });
    s = toggleDealerCover(s, AR);
    const plan = dealerPhotosPdfPlan(s);
    expect(plan.coverId).toBe(AR);
    expect(plan.galleryIds).toEqual([IH, LA]);
    expect(plan.load).toEqual([
      { id: AR, blur: false },
      { id: IH, blur: true },
      { id: LA, blur: false },
    ]);
    expect(toggleDealerCover(s, AR).coverId).toBeNull();
    const r = removeDealerPhoto(s, AR);
    expect(r.coverId).toBeNull();
    expect(r.items.map((i) => i.id)).toEqual([IH, LA]);
    expect(setAllDealerPhotosSend(s, false).items.every((i) => !i.send)).toBe(true);
    expect(setAllDealerPhotosSend(s, false).items.find((i) => i.id === IH)?.blur).toBe(true);
  });

  it("normalizes stored state and caps the list", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ id: `ar_ph_${i.toString(16).padStart(24, "0")}`, send: true }));
    const n = normalizeDealerPhotos({ items: many, coverId: "nope" });
    expect(n?.items.length).toBe(DEALER_PHOTOS_MAX);
    expect(n?.coverId).toBeNull();
    expect(normalizeDealerPhotos(null)).toBeUndefined();
  });

  it("survives the source block normalizer (auto_records.dealerPhotos)", () => {
    const blocks = createDefaultSourceBlocks();
    const merged = mergeSourceBlocksWithDefaults(
      JSON.parse(
        JSON.stringify({
          ...blocks,
          auto_records: { ...blocks.auto_records, dealerPhotos: { items: [{ id: IH, blur: true, send: true }], coverId: IH } },
        }),
      ),
    );
    expect(merged.auto_records.dealerPhotos).toEqual({ items: [{ id: IH, blur: true, send: true }], coverId: IH });
  });

  it("payload keeps only loaded photos", () => {
    const s = toggleDealerCover(patchDealerPhoto(addDealerPhotos(null, [AR, IH]), IH, { send: true }), AR);
    const plan = dealerPhotosPdfPlan(s);
    expect(dealerPhotosPdfPayload(plan, new Map([[IH, IMG]]))).toEqual({ coverId: null, galleryIds: [IH] });
    expect(dealerPhotosPdfPayload(plan, new Map())).toBeNull();
    expect(dealerPhotosApproxBytes(new Map([[IH, "x".repeat(400)]]), [IH, IH])).toBe(300);
  });

  it("lists galleries from every source (originals untouched)", () => {
    const blocks = createDefaultSourceBlocks();
    const g = collectDealerPhotoGalleries({
      sourceBlocks: {
        ...blocks,
        cc_vin: { ...blocks.cc_vin, photoGroups: [{ id: "g1", title: "Openlane · 2026-10-01", photos: [{ id: IH }] }], photos: [{ id: IH }] },
        csdd: { ...blocks.csdd, photoGroups: [{ id: "g2", title: "", photos: [{ id: SBP }] }] },
      } as unknown as Record<string, unknown>,
      incidentPhotoGroups: [{ id: "g3", title: "Bojājums", photos: [{ id: INC }] }],
    });
    expect(g.map((x) => [x.section, x.title, x.ids])).toEqual([
      ["Izsoļu portālu arhīvs", "Openlane · 2026-10-01", [IH]],
      ["Negadījumi", "Bojājums", [INC]],
      ["CSDD", "", [SBP]],
    ]);
  });
});

describe("dealer PDF photos", () => {
  it("unchanged without selection", () => {
    const html = doc(payload());
    expect(html).not.toContain("pdf-cover-photo\"");
    expect(html).not.toContain("pdf-dealer-photos");
  });

  it("cover under the top bar and gallery before the footer", () => {
    const urls = new Map([
      [AR, `${IMG}COVER`],
      [IH, `${IMG}GAL1`],
      [LA, `${IMG}GAL2`],
    ]);
    const html = doc(payload({ dealerPhotos: { coverId: AR, galleryIds: [IH, LA] } }), urls);
    const cover = html.indexOf(`${IMG}COVER`);
    const gal = html.indexOf("pdf-dealer-photos");
    const footer = html.indexOf("pdf-doc-footer", gal);
    expect(cover).toBeGreaterThan(-1);
    expect(html.indexOf('class="pdf-cover-photo"')).toBeLessThan(cover);
    expect(gal).toBeGreaterThan(cover);
    expect(footer).toBeGreaterThan(gal);
    expect(html).toContain(`${IMG}GAL1`);
    expect(html).toContain(`${IMG}GAL2`);
    expect(html).toContain("Fotogrāfijas");
  });

  it("gallery title in client language; audit PDF ignores dealer photos", () => {
    const urls = new Map([[IH, `${IMG}GAL1`]]);
    expect(doc(payload({ dealerPhotos: { galleryIds: [IH] } }), urls, "en")).toContain("Photos");
    expect(doc(payload({ pdfReportKind: "full", dealerPhotos: { galleryIds: [IH] } }), urls)).not.toContain("pdf-dealer-photos");
  });
});

describe("dealer send size", () => {
  it("warns when the PDF alone is over the e-mail limit", () => {
    expect(dealerExtraFilesError([], 19 * 1024 * 1024)).toMatch(/PDF par lielu e-pastam/);
    expect(dealerExtraFilesError([], 5 * 1024 * 1024)).toBeNull();
  });
});
