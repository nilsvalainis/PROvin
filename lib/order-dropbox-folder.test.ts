import { describe, expect, it } from "vitest";

import {
  makeModelPart,
  orderDropboxCategory,
  orderDropboxCategoryFromReportFilename,
  orderDropboxFolderName,
  orderDropboxFolderPath,
  orderDropboxNameWithCategory,
  orderDropboxShouldRename,
  makeFromVinForFolder,
  parseOrderDropboxRecord,
  matchPartnerFolderName,
  partnerFolderName,
  orderDropboxParentPath,
  provPartnersPath,
  dropboxParentDir,
} from "@/lib/order-dropbox-folder";

const created = Date.parse("2026-11-23T10:00:00+02:00");
const base = { sessionId: "cs_live_a1B2c3D4e5F6g7", createdMs: created };

describe("kategorija (dīlera dati strikti atsevišķi)", () => {
  it("produkti", () => {
    expect(orderDropboxCategory({ checkoutLine: "audit" })).toBe("audits");
    expect(orderDropboxCategory({ checkoutLine: "premium" })).toBe("audits");
    expect(orderDropboxCategory({ checkoutLine: "dealer" })).toBe("dealer");
    expect(orderDropboxCategory({ checkoutLine: "audit", isDealerData: true })).toBe("dealer");
    expect(orderDropboxCategory({ checkoutLine: "mini" })).toBe("mini");
    expect(orderDropboxCategory({ checkoutLine: "business" })).toBe("business");
    expect(orderDropboxCategory({ checkoutLine: "audit", fulfillment: "client_link" })).toBe("audits");
    expect(orderDropboxCategory({ checkoutLine: "business", fulfillment: "business_link" })).toBe("business");
  });
  it("bez mapes: SELECT, B2B paka, maks, Telegram", () => {
    expect(orderDropboxCategory({ checkoutLine: "provin_select" })).toBeNull();
    expect(orderDropboxCategory({ checkoutLine: "dealer", fulfillment: "b2b_pack" })).toBeNull();
    expect(orderDropboxCategory({ checkoutLine: "audit", fulfillment: "b2b_wallet_topup" })).toBeNull();
    expect(orderDropboxCategory({ checkoutLine: "audit", amountTotalCents: 999 })).toBeNull();
    expect(orderDropboxCategory({ checkoutLine: "audit", fulfillment: "order_upsell" })).toBeNull();
  });
});

describe("nosaukums: marka modelis vispirms", () => {
  it("pilns", () => {
    const name = orderDropboxFolderName({ ...base, category: "audits", make: "Land Rover", model: "Discovery", plate: "ro-8544", vin: "SALLAAAM6FA743824" });
    expect(name).toBe("LAND ROVER DISCOVERY_RO8544_SALLAAAM6FA743824_2026-11-23_AUDITS");
    expect(orderDropboxFolderPath({ ...base, category: "audits", make: "Land Rover", model: "Discovery", plate: "RO8544", vin: "SALLAAAM6FA743824" }, {})).toBe(
      "/_PROv/LAND ROVER DISCOVERY_RO8544_SALLAAAM6FA743824_2026-11-23_AUDITS",
    );
  });
  it("dīlera dati citā virsmapē un ar citu produktu nosaukumā", () => {
    const p = orderDropboxFolderPath({ ...base, category: "dealer", make: "BMW", model: "530d", vin: "WBA5R1C0XLFH42873" }, {});
    expect(p).toBe("/_PROv/DĪLERA DATU ARHĪVS/BMW 530D_WBA5R1C0XLFH42873_2026-11-23_DILERA DATI");
  });
  it("marka vēl nav zināma -> numurs/VIN; ja nav nekā - īss id", () => {
    expect(orderDropboxFolderName({ ...base, category: "audits", plate: "RO8544" })).toBe("RO8544_2026-11-23_AUDITS");
    expect(orderDropboxFolderName({ ...base, category: "audits" })).toBe("2026-11-23_AUDITS_e5f6g7");
  });
  it("Nils 27.11: bez CSDD markas mape sākas ar marku no VIN (WMI), nevis ar VIN", () => {
    expect(orderDropboxFolderName({ ...base, category: "dealer", vin: "WAUZZZ8R9CA137496" })).toBe("AUDI_WAUZZZ8R9CA137496_2026-11-23_DILERA DATI");
    expect(orderDropboxFolderName({ ...base, category: "audits", vin: "WDB2200261A291096" })).toBe("MERCEDES-BENZ_WDB2200261A291096_2026-11-23_AUDITS");
    expect(orderDropboxFolderName({ ...base, category: "dealer", vin: "SJNFFAJ11U2507806" })).toBe("NISSAN_SJNFFAJ11U2507806_2026-11-23_DILERA DATI");
    // CSDD marka/modelis ir noteicošā
    expect(orderDropboxFolderName({ ...base, category: "audits", make: "VW", model: "Passat", vin: "WVWZZZ3CZNE054721" })).toBe(
      "VW PASSAT_WVWZZZ3CZNE054721_2026-11-23_AUDITS",
    );
    expect(makeFromVinForFolder("")).toBe("");
    expect(makeFromVinForFolder("RO8544")).toBe("");
  });
  it("modelis neatkārto marku; slīpsvītras un _ netiek mapē", () => {
    expect(makeModelPart("BMW", "BMW 640i")).toBe("BMW 640I");
    expect(makeModelPart("VW", "Golf/Variant_1.6")).toBe("VW GOLF VARIANT 1.6");
  });
  it("datums Rīgas laikā", () => {
    const late = Date.parse("2026-11-23T23:30:00+02:00");
    expect(orderDropboxFolderName({ ...base, createdMs: late, category: "audits", plate: "RO8544" })).toBe("RO8544_2026-11-23_AUDITS");
  });
  it("root no env", () => {
    expect(orderDropboxFolderPath({ ...base, category: "mini", plate: "AB123" }, { PROV_ORDERS_DROPBOX_ROOT: "Tests/" })).toBe("/Tests/AB123_2026-11-23_MINI");
  });
  it("pārdēvē tikai uz bagātāku nosaukumu", () => {
    expect(orderDropboxShouldRename("RO8544_2026-11-23_AUDITS", "LAND ROVER DISCOVERY_RO8544_2026-11-23_AUDITS")).toBe(true);
    expect(orderDropboxShouldRename("LAND ROVER DISCOVERY_RO8544_2026-11-23_AUDITS", "RO8544_2026-11-23_AUDITS")).toBe(false);
    expect(orderDropboxShouldRename("A", "A")).toBe(false);
    // marka no VIN -> CSDD marka + modelis (īsāks, bet bagātāks)
    expect(orderDropboxShouldRename("VOLKSWAGEN_WVWZZZ3CZNE054721_2026-11-23_AUDITS", "VW PASSAT_WVWZZZ3CZNE054721_2026-11-23_AUDITS")).toBe(true);
    // ne atpakaļ uz marku no VIN, ne zaudējot numuru
    expect(orderDropboxShouldRename("AUDI Q5_WAUZZZ8R9CA137496_2026-11-23_DILERA DATI", "AUDI_WAUZZZ8R9CA137496_2026-11-23_DILERA DATI")).toBe(false);
    expect(orderDropboxShouldRename("VOLKSWAGEN_OR9970_WVWZZZ3CZNE054721_2026-11-23_AUDITS", "VW PASSAT_WVWZZZ3CZNE054721_2026-11-23_AUDITS")).toBe(false);
  });
});

describe("ieraksts", () => {
  it("parse", () => {
    expect(parseOrderDropboxRecord({ sessionId: "x", category: "audits", state: "ok", path: "/p", orderCreatedMs: 5 })?.orderCreatedMs).toBe(5);
    expect(parseOrderDropboxRecord({ sessionId: "x", category: "iriss" })).toBeNull();
  });
});

describe("manuālā pasūtījuma produkts pēc atskaites PDF nosaukuma", () => {
  it("Business / Dīlera dati / AUDITS / MINI visās valodās un ar v2- priedēkli", () => {
    expect(orderDropboxCategoryFromReportFilename("PROVIN_BUSINESS_WBA00000000000001.pdf")).toBe("business");
    expect(orderDropboxCategoryFromReportFilename("v2-PROVIN_BUSINESS_WBA00000000000001_EN.pdf")).toBe("business");
    expect(orderDropboxCategoryFromReportFilename("OFICIALA_DILERA_DATI_WBA00000000000001.pdf")).toBe("dealer");
    expect(orderDropboxCategoryFromReportFilename("OFFIZIELLE_HAENDLERDATEN_WBA00000000000001_DE.pdf")).toBe("dealer");
    expect(orderDropboxCategoryFromReportFilename("PROVIN_AUDITS_WBA00000000000001.pdf")).toBe("audits");
    expect(orderDropboxCategoryFromReportFilename("PROVIN_AUDIT_IZVILKUMS_WBA00000000000001_RU.pdf")).toBe("audits");
    expect(orderDropboxCategoryFromReportFilename("PROVIN_MINI_WBA00000000000001.pdf")).toBe("mini");
  });
  it("nezināms / ASV / izsoļu arhīvs - mapi nepārvieto", () => {
    expect(orderDropboxCategoryFromReportFilename("PROVIN_ASV_WBA00000000000001.pdf")).toBeNull();
    expect(orderDropboxCategoryFromReportFilename("IZSOLU_ARHIVS_WBA00000000000001.pdf")).toBeNull();
    expect(orderDropboxCategoryFromReportFilename("Atskaite.pdf")).toBeNull();
    expect(orderDropboxCategoryFromReportFilename("")).toBeNull();
  });
});

describe("produkta vārds mapes nosaukumā", () => {
  it("nomaina tikai produkta daļu", () => {
    expect(orderDropboxNameWithCategory("BMW 325_WBA00000000000001_2026-11-23_AUDITS", "audits", "business")).toBe(
      "BMW 325_WBA00000000000001_2026-11-23_BUSINESS",
    );
    expect(orderDropboxNameWithCategory("AB1234_2026-11-23_AUDITS_abc123", "audits", "dealer")).toBe("AB1234_2026-11-23_DILERA DATI_abc123");
    expect(orderDropboxNameWithCategory("Veca mape", "audits", "business")).toBe("Veca mape_BUSINESS");
  });
});

describe("partneru mapes (Nils 27.11)", () => {
  const existing = ["AM Cars SIA", "SIA RZ Autoparks", "Pērc un brauc (RKG GROUP)", "Auto2000 Import-Export GmbH"];
  it("atrod esošo mapi pēc uzņēmuma nosaukuma (forma, diakritika, iekavas)", () => {
    expect(matchPartnerFolderName(existing, "RKG GROUP SIA")).toBe("Pērc un brauc (RKG GROUP)");
    expect(matchPartnerFolderName(existing, "SIA AM Cars")).toBe("AM Cars SIA");
    expect(matchPartnerFolderName(existing, "RZ Autoparks")).toBe("SIA RZ Autoparks");
    expect(matchPartnerFolderName(existing, "Auto2000 Import-Export GmbH")).toBe("Auto2000 Import-Export GmbH");
    expect(matchPartnerFolderName(existing, "Perc un brauc")).toBe("Pērc un brauc (RKG GROUP)");
  });
  it("nav atbilstības - null; jauna mape pēc nosaukuma", () => {
    expect(matchPartnerFolderName(existing, "Jauns Auto SIA")).toBeNull();
    expect(matchPartnerFolderName(existing, "SIA")).toBeNull();
    expect(partnerFolderName("  Jauns   Auto SIA ")).toBe("Jauns Auto SIA");
  });
  it("virsmapes: sakne, DĪLERA DATU ARHĪVS, PARTNERI", () => {
    expect(orderDropboxParentPath("audits", {})).toBe("/_PROv");
    expect(orderDropboxParentPath("business", {})).toBe("/_PROv");
    expect(orderDropboxParentPath("mini", {})).toBe("/_PROv");
    expect(orderDropboxParentPath("dealer", {})).toBe("/_PROv/DĪLERA DATU ARHĪVS");
    expect(provPartnersPath({})).toBe("/_PROv/PARTNERI");
    expect(dropboxParentDir("/_PROv/AUDITU ARHĪVS/X")).toBe("/_PROv/AUDITU ARHĪVS");
  });
});
