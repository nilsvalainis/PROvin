import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, isIzvilkumsReport, type ClientReportPayload } from "@/lib/client-report-html";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  buildIzvilkumsWatermarkHtml,
  IZVILKUMS_WATERMARK_ANGLE_DEG,
  izvilkumsFooterNote,
  izvilkumsWatermarkFontPx,
  izvilkumsWordUpper,
  PDF_IZVILKUMS_CSS,
} from "@/lib/pdf-izvilkums";
import { clientReportRunningPageCss } from "@/lib/pdf-running-page";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

function payload(vis: Record<string, boolean> = {}, extra: Partial<ClientReportPayload> = {}): ClientReportPayload {
  return {
    sessionId: "cs_test",
    vin: "WBAVU71070KG92022",
    created: Date.UTC(2026, 10, 25) / 1000,
    amountTotal: 9999,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: "Jānis Bērziņš",
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
    csddForm: emptyCsddFields(),
    pdfVisibility: mergePdfVisibility(vis),
    ...extra,
  } as unknown as ClientReportPayload;
}

function doc(p: ClientReportPayload, lang: ClientReportLang = "lv"): string {
  return buildClientReportDocumentHtml({
    payload: p,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
    lang,
  });
}

/** Satura daļa (bez <style>), lai pārbaudītu redzamos tekstus. */
function body(html: string): string {
  return html.slice(html.indexOf("<body"));
}

describe("Izvilkums - klienta PDF", () => {
  it("pdfVisibility: vecie dati bez lauka = izslēgts, ķeksītis saglabājas", () => {
    expect(mergePdfVisibility({}).izvilkums).toBe(false);
    expect(mergePdfVisibility(null).izvilkums).toBeFalsy();
    expect(mergePdfVisibility({ izvilkums: true }).izvilkums).toBe(true);
    expect(mergePdfVisibility({ izvilkums: "jā" }).izvilkums).toBe(false);
  });

  it("bez ķeksīša - nekādas ūdenszīmes, piezīmes vai «Izvilkums»", () => {
    const html = doc(payload());
    expect(html).not.toContain("pdf-izvilkums-wm");
    expect(html).not.toContain("Izvilkums");
    expect(html).not.toContain("IZVILKUMS");
    expect(html).not.toMatch(/plašāka datu pārbaude/);
    expect(isIzvilkumsReport(payload())).toBe(false);
  });

  it("ar ķeksīti - ūdenszīme (fiksēta, atkārtojas katrā lapā), kājenes rinda, galvene un kolofons", () => {
    const html = doc(payload({ izvilkums: true }));
    // Viens fiksēts elements: Chromium drukā to atkārto katrā lapā.
    expect(body(html).match(/class="pdf-izvilkums-wm"/g)).toHaveLength(1);
    expect(html).toMatch(/\.pdf-izvilkums-wm\{[^}]*position:fixed/);
    expect(html).toContain(">IZVILKUMS</span>");
    // Kājene katrā lapā (@page margin box) - otrā rinda zem esošās.
    expect(html).toMatch(/@bottom-left\{content:"[^"]*\\A Izvilkums - sagatavots individuāli no daļas PROVIN avotu/);
    expect(html).toContain("plašāka datu pārbaude un ieteikumi");
    // 1. lapas galvene: produkta vārda vietā «Izvilkums».
    expect(html).toMatch(/class="pdf-top6__kind"><b>Izvilkums<\/b> · Datu atskaite · /);
    expect(html).not.toContain("<b>Transportlīdzekļa audits</b>");
    // Kolofons beigās.
    expect(html).toContain('<p class="pdf-doc-footer__product">IZVILKUMS</p>');
    expect(html).not.toContain("PROVIN AUDITS");
  });

  it("Business + ķeksītis: «Business» aizstāts ar «Izvilkums»", () => {
    const html = doc(payload({ izvilkums: true }, { pdfReportKind: "business" }));
    expect(html).toMatch(/<b>Izvilkums<\/b> · Datu atskaite/);
    expect(html).not.toContain("<b>Business</b>");
    expect(html).toContain('<p class="pdf-doc-footer__product">IZVILKUMS</p>');
  });

  it("dīlera un ASV atskaitēm Izvilkums neattiecas", () => {
    expect(isIzvilkumsReport({ pdfVisibility: mergePdfVisibility({ izvilkums: true }), pdfReportKind: "dealer" })).toBe(false);
    expect(isIzvilkumsReport({ pdfVisibility: mergePdfVisibility({ izvilkums: true }), pdfReportKind: "asv" })).toBe(false);
  });

  it.each([
    ["en", "EXTRACT", "Extract", "Extract - prepared individually from part of PROVIN sources"],
    ["ru", "ВЫПИСКА", "Выписка", "Выписка - подготовлена индивидуально"],
    ["de", "AUSZUG", "Auszug", "Auszug - individuell aus einem Teil der PROVIN-Quellen erstellt"],
  ] as const)("%s: tulkota ūdenszīme, galvene un kājene", (lang, upper, word, note) => {
    const html = doc(payload({ izvilkums: true }), lang);
    expect(html).toContain(`>${upper}</span>`);
    expect(html).toContain(`<b>${word}</b>`);
    expect(html).toContain(`<p class="pdf-doc-footer__product">${upper}</p>`);
    expect(izvilkumsFooterNote(lang)).toContain(note);
    expect(html).not.toContain("IZVILKUMS");
    expect(html).not.toContain("plašāka datu pārbaude");
  });

  it("kājenes teksts bez avotu skaita un bez «pirkt / nepirkt»", () => {
    for (const lang of ["lv", "en", "ru", "de"] as const) {
      const t = izvilkumsFooterNote(lang);
      expect(t).not.toMatch(/\d/);
      expect(t.toLowerCase()).not.toMatch(/nepirkt|buy|купить|kaufen/);
    }
  });

  it("ūdenszīme: lapas diagonāles leņķis un ~70 % garums", () => {
    expect(IZVILKUMS_WATERMARK_ANGLE_DEG).toBeCloseTo(-54.73, 1);
    expect(PDF_IZVILKUMS_CSS).toContain("rotate(-54.74deg)");
    expect(PDF_IZVILKUMS_CSS).toContain("rgba(29,29,31,0.055)");
    expect(PDF_IZVILKUMS_CSS).toContain("pointer-events:none");
    for (const lang of ["lv", "en", "ru", "de"] as const) {
      const px = izvilkumsWatermarkFontPx(izvilkumsWordUpper(lang));
      expect(px).toBeGreaterThan(80);
      expect(px).toBeLessThan(240);
    }
    expect(buildIzvilkumsWatermarkHtml("lv")).toContain('aria-hidden="true"');
  });

  it("kājenes CSS bez piezīmes nemainās", () => {
    const a = clientReportRunningPageCss({ header: "PROVIN.LV", footer: "VIN · 25.11.2026", lang: "lv" });
    expect(a).not.toContain("\\A ");
    expect(a).not.toContain("white-space");
  });
});
