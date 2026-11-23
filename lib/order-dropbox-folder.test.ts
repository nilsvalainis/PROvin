import { describe, expect, it } from "vitest";

import {
  makeModelPart,
  orderDropboxCategory,
  orderDropboxFolderName,
  orderDropboxFolderPath,
  orderDropboxShouldRename,
  parseOrderDropboxRecord,
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
      "/_PROv/AUDITI/LAND ROVER DISCOVERY_RO8544_SALLAAAM6FA743824_2026-11-23_AUDITS",
    );
  });
  it("dīlera dati citā virsmapē un ar citu produktu nosaukumā", () => {
    const p = orderDropboxFolderPath({ ...base, category: "dealer", make: "BMW", model: "530d", vin: "WBA5R1C0XLFH42873" }, {});
    expect(p).toBe("/_PROv/DILERA DATI/BMW 530D_WBA5R1C0XLFH42873_2026-11-23_DILERA DATI");
  });
  it("marka vēl nav zināma -> numurs/VIN; ja nav nekā - īss id", () => {
    expect(orderDropboxFolderName({ ...base, category: "audits", plate: "RO8544" })).toBe("RO8544_2026-11-23_AUDITS");
    expect(orderDropboxFolderName({ ...base, category: "audits" })).toBe("2026-11-23_AUDITS_e5f6g7");
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
    expect(orderDropboxFolderPath({ ...base, category: "mini", plate: "AB123" }, { PROV_ORDERS_DROPBOX_ROOT: "Tests/" })).toBe("/Tests/MINI/AB123_2026-11-23_MINI");
  });
  it("pārdēvē tikai uz bagātāku nosaukumu", () => {
    expect(orderDropboxShouldRename("RO8544_2026-11-23_AUDITS", "LAND ROVER DISCOVERY_RO8544_2026-11-23_AUDITS")).toBe(true);
    expect(orderDropboxShouldRename("LAND ROVER DISCOVERY_RO8544_2026-11-23_AUDITS", "RO8544_2026-11-23_AUDITS")).toBe(false);
    expect(orderDropboxShouldRename("A", "A")).toBe(false);
  });
});

describe("ieraksts", () => {
  it("parse", () => {
    expect(parseOrderDropboxRecord({ sessionId: "x", category: "audits", state: "ok", path: "/p", orderCreatedMs: 5 })?.orderCreatedMs).toBe(5);
    expect(parseOrderDropboxRecord({ sessionId: "x", category: "iriss" })).toBeNull();
  });
});
