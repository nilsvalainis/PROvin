import { describe, expect, it, vi } from "vitest";
import { isPlausibleListingVin } from "@/lib/iriss-listings-extract";
import { listingVinCardState } from "@/lib/iriss-listings-card";
import {
  findRecentDuplicateIrissPd,
  irissPdCreateIdentityKey,
  irissPdDisplayVin,
  irissPdEffectiveSource,
  irissPdListPrice,
  irissPdSourceFromUrl,
} from "@/lib/iriss-piedavajumi-list-display";
import { irissPdRowForDisplay, irissPdRowNeedsRecord, irissPdRowsForDisplay } from "@/lib/iriss-piedavajumi-list-rows";
import { irissPdToListRow } from "@/lib/iriss-piedavajumi";
import { emptyIrissPiedavajums, type IrissPdListRow } from "@/lib/iriss-piedavajumi-types";

vi.mock("server-only", () => ({}));

const HASH = "23631FD56A3D73DC7";

function row(p: Partial<IrissPdListRow> = {}): IrissPdListRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    number: 1,
    status: "draft",
    title: "Skoda Kodiaq",
    vin: "",
    clientName: "",
    clientOrderId: "",
    source: "manual",
    sourceRef: "",
    sourceKey: "",
    sourceUrl: "",
    hasAuto1: false,
    price: "",
    validUntil: "",
    approvedOrderId: "",
    cover: null,
    updatedAt: "2026-11-20T10:00:00.000Z",
    openQuestions: 0,
    ...p,
  };
}

describe("PD saraksts: VIN", () => {
  it("izsoles hash (17 hex, sakrīt kontrolcipars) netiek rādīts kā VIN", () => {
    expect(isPlausibleListingVin(HASH)).toBe(false);
    expect(irissPdDisplayVin(HASH)).toBe("");
    expect(listingVinCardState({ vin: HASH })).toBeNull();
  });

  it("derīgs VIN paliek, I/O/Q un garums - nē", () => {
    expect(irissPdDisplayVin("tmbjj7ns5m8012345")).toBe("TMBJJ7NS5M8012345");
    expect(irissPdDisplayVin("TMBJJ7NS5M801234")).toBe("");
    expect(irissPdDisplayVin("TMBJJ7NS5M80123O4")).toBe("");
    expect(irissPdDisplayVin("")).toBe("");
  });
});

describe("PD saraksts: avots un cena", () => {
  it("avots pēc izsoles saites", () => {
    expect(irissPdSourceFromUrl("https://ecarstrade.com/cars/8812345")).toBe("ecarstrade");
    expect(irissPdSourceFromUrl("https://www.auto1.com/en/app/merchant/car/DE48213")).toBe("auto1");
    expect(irissPdSourceFromUrl("")).toBeNull();
    expect(irissPdEffectiveSource("auto1", "https://ecarstrade.com/cars/8812345")).toBe("ecarstrade");
    expect(irissPdEffectiveSource("auto1", "")).toBe("auto1");
    expect(irissPdEffectiveSource("autoparks", "https://ecarstrade.com/cars/1")).toBe("autoparks");
  });

  it("cena: gala cena, citādi cenu bloka summa", () => {
    expect(irissPdListPrice({ price: "18500" })).toBe("18500");
    expect(irissPdListPrice({ price: "", purchasePrice: "15000", logisticsCost: "900", commission: "1000" })).toBe("16900");
    expect(irissPdListPrice({ price: "" })).toBe("");
  });

  it("jaunā indeksa rinda satur cenu un saiti; rādīšanā hash VIN un avots salaboti", () => {
    const rec = {
      ...emptyIrissPiedavajums("22222222-2222-4222-8222-222222222222", "2026-11-20T10:00:00.000Z"),
      source: "auto1" as const,
      sourceUrl: "https://ecarstrade.com/cars/8812345",
      purchasePrice: "14000",
    };
    rec.vehicle = { ...rec.vehicle, vin: HASH };
    const r = irissPdToListRow(rec);
    expect(r.price).toBe("14000");
    expect(r.sourceUrl).toBe("https://ecarstrade.com/cars/8812345");
    const shown = irissPdRowForDisplay(r);
    expect(shown.vin).toBe("");
    expect(shown.source).toBe("ecarstrade");
  });

  it("vecā indeksa rinda (bez sourceUrl) papildināta no ieraksta, jaunā - nelasa", async () => {
    const old = row({ source: "auto1", vin: HASH });
    delete (old as Partial<IrissPdListRow>).sourceUrl;
    expect(irissPdRowNeedsRecord(old)).toBe(true);
    expect(irissPdRowNeedsRecord(row())).toBe(false);
    const rec = {
      ...emptyIrissPiedavajums(old.id, "2026-11-20T10:00:00.000Z"),
      source: "auto1" as const,
      sourceUrl: "https://ecarstrade.com/cars/8812345",
      price: "21000",
    };
    let reads = 0;
    const out = await irissPdRowsForDisplay([old, row({ id: "33333333-3333-4333-8333-333333333333" })], async () => {
      reads += 1;
      return rec;
    });
    expect(reads).toBe(1);
    expect(out[0]!.price).toBe("21000");
    expect(out[0]!.source).toBe("ecarstrade");
    expect(out[0]!.vin).toBe("");
  });
});

describe("PD izveide: dublikāti", () => {
  const now = Date.parse("2026-11-20T10:05:00.000Z");
  const ident = { sourceRef: "listing:abc", source: "" as const, sourceKey: "", orderId: "44444444-4444-4444-8444-444444444444" };

  it("tas pats sludinājums + pasūtījums pēdējās 10 min -> esošais", () => {
    const rows = [row({ sourceRef: "listing:abc", clientOrderId: ident.orderId })];
    expect(findRecentDuplicateIrissPd(rows, ident, now)).toBe(rows[0]!.id);
  });

  it("cits pasūtījums, vecs, noraidīts vai beidzies -> jauns", () => {
    expect(findRecentDuplicateIrissPd([row({ sourceRef: "listing:abc" })], ident, now)).toBeNull();
    expect(
      findRecentDuplicateIrissPd([row({ sourceRef: "listing:abc", clientOrderId: ident.orderId, updatedAt: "2026-11-20T09:00:00.000Z" })], ident, now),
    ).toBeNull();
    expect(findRecentDuplicateIrissPd([row({ sourceRef: "listing:abc", clientOrderId: ident.orderId, status: "declined" })], ident, now)).toBeNull();
  });

  it("izsoles saite: avots + atslēga", () => {
    const link = { sourceRef: "", source: "auto1" as const, sourceKey: "de48213", orderId: "" };
    const rows = [row({ source: "auto1", sourceKey: "DE48213" })];
    expect(findRecentDuplicateIrissPd(rows, link, now)).toBe(rows[0]!.id);
    expect(irissPdCreateIdentityKey(link)).toBe("auto1:DE48213|");
    expect(irissPdCreateIdentityKey(ident)).toBe(`listing:abc|${ident.orderId}`);
  });
});
