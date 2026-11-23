/**
 * Business PDF audits 23.11.2026 (Opel Vivaro furgons) - dīlera tehniskie lauki, CSDD bloks, ieteikumi,
 * atruna un pasūtījuma dati (A9, A10, A21, B22-B27, C33, C34, D35, D41, D44).
 */
import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, csddFormHasRegistryContent, type ClientReportPayload } from "@/lib/client-report-html";
import { buildOutvinDealerReportPdfInnerHtml } from "@/lib/outvin-dealer-pdf-html";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import {
  formatDealerEngineCode,
  formatDealerTransmissionCode,
  translateDealerVehicleValue,
} from "@/lib/dealer-vehicle-value-i18n";
import { formatPdfCustomerFullName, formatPdfPreparedByName } from "@/lib/pdf-prepared-by-name";
import { buildPdfAboutReportBlock } from "@/lib/client-report-pdf-layout-draft";
import { MILEAGE_PDF_SOURCE_LEGEND } from "@/lib/pdf-mileage-source";

function vivaroReport() {
  const r = emptyOutvinDealerReport();
  Object.assign(r.vehicleInfo, {
    model: "Opel Vivaro",
    vinCode: "VXEVFAHKKM0000001",
    vehicleType: "Furgons",
    transmission: "ML6CV (STT TYPE 6-SPEED MANUAL GEARBOX )",
    steeringSide: "LHD (left-hand drive)",
    engineCode: "(10 DY3M 4074562) DIESEL DW10FE FAP 90KW",
    body: "Furgons",
    power: "90 kW (121 hp / 122 PS)",
    countryRegion: "France",
    color: "Banquise white paint",
    colorCode: "EWP",
    interior: "(FX)",
    fuel: "diesel",
    displacement: "2 l",
  });
  return r;
}

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
}

describe("Business PDF audits 23.11 - dīlera lauki", () => {
  const t = textOf(buildOutvinDealerReportPdfInnerHtml(vivaroReport()));

  it("A21: viena jauda, nevis «121 ZS / 122 ZS»", () => {
    expect(t).toContain("|90 kW (122 ZS)|");
    expect(translateDealerVehicleValue("power", "90 kW (121 hp / 122 PS)", "en")).toBe("90 kW (121 hp)");
    expect(translateDealerVehicleValue("power", "90 kW (122 PS / 121 hp)", "de")).toBe("90 kW (122 PS)");
    expect(translateDealerVehicleValue("power", "190 kW (258 PS)", "lv")).toBe("190 kW (258 ZS)");
  });

  it("B22: «Kreisā stūre» bez atkārtojuma iekavās", () => {
    expect(t).toContain("|Kreisā stūre|");
    expect(t).not.toContain("(Kreisā stūre)");
  });

  it("B23: ātrumkārba «Manuāla, 6 pakāpju (ML6CV)»", () => {
    expect(t).toContain("|Manuāla, 6 pakāpju (ML6CV)|");
    expect(formatDealerTransmissionCode("ZF8HP45", "lv")).toBeNull();
  });

  it("B24: dzinējs bez sērijas numura", () => {
    expect(t).toContain("|2,0 dīzelis DW10FE, 90 kW|");
    expect(t).not.toContain("4074562");
    expect(formatDealerEngineCode("N57D30A", "", "lv")).toBe("N57D30A");
  });

  it("B25/B26/B27: krāsa bez «paint», salona kods bez apraksta nerādās, tips = virsbūve nedublējas", () => {
    expect(t).toContain("|Banquise balts|");
    expect(t).not.toContain("paint");
    expect(t).not.toContain("Interjers");
    expect(t).not.toContain("Transportlīdzekļa tips");
    expect(t).toContain("|Virsbūve|Furgons|");
  });

  it("A9: Outvin valsts = ražošanas valsts tikai, ja to apstiprina VIN; citādi nerādās", () => {
    expect(t).toContain("|Ražošanas valsts|Francija|");
    expect(t).not.toContain("Valsts / reģions");
    const other = vivaroReport();
    other.vehicleInfo.countryRegion = "Germany";
    const t2 = textOf(buildOutvinDealerReportPdfInnerHtml(other));
    expect(t2).not.toContain("Ražošanas valsts");
    expect(t2).not.toContain("Vācija");
  });
});

function payload(overrides: Partial<ClientReportPayload> = {}): ClientReportPayload {
  return {
    sessionId: "cs_test",
    vin: "VXEVFAHKKM0000001",
    created: Date.UTC(2026, 10, 23) / 1000,
    amountTotal: null,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: "A.BĒRZIŅŠ",
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

function doc(p: ClientReportPayload): string {
  return buildClientReportDocumentHtml({
    payload: p,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
  });
}

describe("Business PDF audits 23.11 - CSDD, ieteikumi, atruna, pasūtījums", () => {
  it("A10/D35/D41: CSDD ar tikai VIN un VIN modeļa gadu nav CSDD dati", () => {
    const csdd = emptyCsddFields();
    csdd.vin = "VXEVFAHKKM0000001";
    csdd.modelYear = "2021";
    expect(csddFormHasRegistryContent(csdd)).toBe(false);
    const html = doc(payload({ csddForm: csdd, csdd: "VIN: VXEVFAHKKM0000001\nIzlaiduma gads: 2021", pdfReportKind: "business" }));
    expect(html).not.toContain("Izlaiduma gads");
    expect(html).not.toContain("Publiskas Eiropas datubāzes");
    csdd.firstRegistration = "2020-12-09";
    expect(csddFormHasRegistryContent(csdd)).toBe(true);
  });

  it("C33/C34: Business atskaitē nav «Ieteikumi klātienes apskatei» un atrunā nav «sniedzam ieteikumus»", () => {
    const business = doc(payload({ pdfReportKind: "business" }));
    expect(business).not.toContain("Virsbūves stāvoklis un krāsas biezums");
    expect(business).not.toContain("sniedzam ieteikumus");
    expect(business).toContain("PROVIN.LV Business atskaite ir digitāls");
    const full = doc(payload({ pdfReportKind: "full" }));
    expect(full).toContain("Virsbūves stāvoklis un krāsas biezums");
    expect(full).toContain("sniedzam ieteikumus");
  });

  it("D44: bez summas nav tukša «Maksājums»; vārds «A. Bērziņš»", () => {
    const html = buildPdfAboutReportBlock({
      order: payload() as unknown as Parameters<typeof buildPdfAboutReportBlock>[0]["order"],
      money: "-",
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      show: { payment: true, vehicle: true, client: true, notes: false },
    });
    expect(html).not.toContain("Maksājums");
    expect(html).toContain(">Pasūtījums<");
    expect(html).toContain("A. Bērziņš");
    expect(formatPdfCustomerFullName("J.KALNIŅŠ")).toBe("J. Kalniņš");
    expect(formatPdfPreparedByName("J.KALNIŅŠ")).toBe("J. Kalniņš");
    expect(formatPdfPreparedByName("Anna Bērziņa")).toBe("Anna B.");
    expect(formatPdfCustomerFullName("SIA AUTO CENTRS")).toBe("SIA AUTO CENTRS");
  });

  it("D39: avotu nosaukumi leģendā kā avotu sarakstā", () => {
    expect(MILEAGE_PDF_SOURCE_LEGEND.carvertical.full).toBe("CarVertical");
    expect(MILEAGE_PDF_SOURCE_LEGEND.dealer.full).toBe("OFICIĀLĀ DĪLERA DATI");
  });
});
