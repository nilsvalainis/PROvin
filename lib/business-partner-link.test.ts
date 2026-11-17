import { describe, expect, it } from "vitest";
import { parseB2bPartnerEmbed } from "@/lib/b2b-partner-embed";
import { buildBusinessLinkCheckoutSessionParams, parseBusinessLinkRecord } from "@/lib/business-link";
import {
  checkPartnerClick,
  listingHtmlHasPlate,
  listingHtmlHasVehicleId,
  listingHtmlHasVin,
  refererMatchesListing,
  newPartnerBusinessLinkRecord,
  parsePartnerClickParams,
} from "@/lib/business-partner-link";

const VIN = "WAUZZZ8R0AA012345";
const partner = {
  status: "active" as const,
  businessEmbed: parseB2bPartnerEmbed({ enabled: true, domains: ["percunbrauc.lv"] }),
};
const params = (q: string) => parsePartnerClickParams(new URLSearchParams(q));
const good = params(`vin=${VIN}&url=${encodeURIComponent("https://percunbrauc.lv/cars/audi-q5")}`);

describe("partnera pastāvīgā saite", () => {
  it("atveras tikai no partnera sludinājuma ar derīgu VIN", () => {
    expect(checkPartnerClick({ partner, referer: "https://percunbrauc.lv/cars/audi-q5", params: good })).toEqual({ ok: true });
  });

  it("tieši atvērta (bez Referer) vai no citas vietnes neatveras", () => {
    expect(checkPartnerClick({ partner, referer: null, params: good })).toEqual({ ok: false, reason: "referer" });
    expect(checkPartnerClick({ partner, referer: "https://www.google.com/", params: good })).toEqual({
      ok: false,
      reason: "referer",
    });
  });

  it("sludinājumam jābūt partnera domēnā", () => {
    const p = params(`vin=${VIN}&url=${encodeURIComponent("https://ss.lv/msg/123")}`);
    expect(checkPartnerClick({ partner, referer: "https://percunbrauc.lv/", params: p })).toEqual({
      ok: false,
      reason: "listing",
    });
  });

  it("bez derīga VIN, ar izslēgtu pogu vai bloķētu partneri neatveras", () => {
    const noVin = params(`vin=WAUZZZ&url=${encodeURIComponent("https://percunbrauc.lv/cars/x")}`);
    expect(checkPartnerClick({ partner, referer: "https://percunbrauc.lv/", params: noVin }).ok).toBe(false);
    const off = { ...partner, businessEmbed: { ...partner.businessEmbed, enabled: false } };
    expect(checkPartnerClick({ partner: off, referer: "https://percunbrauc.lv/", params: good }).ok).toBe(false);
    expect(checkPartnerClick({ partner: { ...partner, status: "disabled" }, referer: "https://percunbrauc.lv/", params: good }).ok).toBe(false);
    expect(checkPartnerClick({ partner: null, referer: "https://percunbrauc.lv/", params: good }).ok).toBe(false);
  });

  it("VIN jābūt sludinājuma lapā (tekstā vai pogas data-vin)", () => {
    expect(listingHtmlHasVin(`<div data-vin="${VIN.toLowerCase()}"></div>`, VIN)).toBe(true);
    expect(listingHtmlHasVin("<html>Audi Q5, VIN pēc pieprasījuma</html>", VIN)).toBe(false);
  });

  it("auto dati no pogas tiek iztīrīti: tikai https bilde, gads un km cipari", () => {
    const p = params(
      `vin=${VIN}&url=x&title=${encodeURIComponent("Audi <b>Q5</b>")}&img=${encodeURIComponent("http://x.lv/a.jpg")}&year=2010&km=${encodeURIComponent("370 225 km")}`,
    );
    expect(p.car).toEqual({ title: "Audi <b>Q5</b>", imageUrl: "", year: "2010", mileageKm: "370225", fuel: "", gearbox: "" });
  });

  it("izveidotā saite ir vienreizēja, piesaistīta VIN, derīga 1 h un saglabā partneri", () => {
    const now = Date.parse("2026-11-05T10:00:00.000Z");
    const rec = newPartnerBusinessLinkRecord({
      tokenHash: "a".repeat(64),
      partnerId: "ptr_0123456789abcdef",
      params: good,
      listingVerified: true,
      nowMs: now,
    });
    expect(rec.status).toBe("open");
    expect(rec.prefillVin).toBe(VIN);
    expect(rec.expiresAt).toBe("2026-11-05T11:00:00.000Z");
    const roundTrip = parseBusinessLinkRecord(JSON.parse(JSON.stringify(rec)));
    expect(roundTrip?.partnerId).toBe("ptr_0123456789abcdef");
    expect(roundTrip?.listingUrl).toBe("https://percunbrauc.lv/cars/audi-q5");
    expect(roundTrip?.listingVerified).toBe(true);
  });

  it("apmaksā partneris ir partner_ref (uzskaitei), nevis partner_id (kredītam)", () => {
    const p = buildBusinessLinkCheckoutSessionParams({
      origin: "https://provin.lv",
      token: "t",
      tokenHash: "a".repeat(64),
      resolved: { email: "a@b.lv", vin: VIN, listingUrl: "", phone: "", companyName: "", companyReg: "", companyAddress: "" },
      partnerRef: "ptr_0123456789abcdef",
    });
    expect(p.metadata.partner_ref).toBe("ptr_0123456789abcdef");
    expect(p.metadata.partner_id).toBeUndefined();
    expect(p.line_items[0].price_data.unit_amount).toBe(6999);
  });
});

describe("partnera saites aizsardzība", () => {
  it("ja Referer ir pilna adrese, tai jāsakrīt ar sludinājumu", () => {
    expect(checkPartnerClick({ partner, referer: "https://percunbrauc.lv/cars/cita-masina", params: good })).toEqual({
      ok: false,
      reason: "referer",
    });
    expect(refererMatchesListing("https://www.percunbrauc.lv/cars/audi-q5/", "https://percunbrauc.lv/cars/audi-q5")).toBe(true);
  });

  it("sludinājuma adrese ar VIN (meklēšanas lapa) neder", () => {
    const p = params(`vin=${VIN}&url=${encodeURIComponent(`https://percunbrauc.lv/?s=${VIN}`)}`);
    expect(checkPartnerClick({ partner, referer: "https://percunbrauc.lv/", params: p })).toEqual({ ok: false, reason: "listing" });
  });

  it("VIN sludinājuma adreses ceļā der (dīleri tā veido adreses)", () => {
    const listing = `https://www.dzintarzemeauto.lv/lv/auto-katalogs/audi-q5-6-2017-${VIN.toLowerCase()}-diesel-257436km/`;
    const dza = { status: "active" as const, businessEmbed: parseB2bPartnerEmbed({ enabled: true, domains: ["dzintarzemeauto.lv"] }) };
    const p = params(`vin=${VIN}&url=${encodeURIComponent(listing)}`);
    expect(checkPartnerClick({ partner: dza, referer: listing, params: p })).toEqual({ ok: true });
  });

  it("sludinājumam jābūt https un standarta portā", () => {
    const http = params(`vin=${VIN}&url=${encodeURIComponent("http://percunbrauc.lv/cars/audi-q5")}`);
    const port = params(`vin=${VIN}&url=${encodeURIComponent("https://percunbrauc.lv:8080/cars/audi-q5")}`);
    expect(checkPartnerClick({ partner, referer: "https://percunbrauc.lv/", params: http }).ok).toBe(false);
    expect(checkPartnerClick({ partner, referer: "https://percunbrauc.lv/", params: port }).ok).toBe(false);
  });
});

describe("partnera saite bez VIN (numurzīme)", () => {
  const url = encodeURIComponent("https://percunbrauc.lv/cars/audi-q5");
  it("numurzīme der VIN vietā, ja VIN nav dots", () => {
    const p = parsePartnerClickParams(new URLSearchParams(`plate=oj-2452&url=${url}`));
    expect(p.plate).toBe("OJ2452");
    expect(checkPartnerClick({ partner, referer: "https://percunbrauc.lv/", params: p })).toEqual({ ok: true });
  });

  it("numurzīmei jābūt sludinājuma lapā (ar vai bez defises)", () => {
    expect(listingHtmlHasPlate("<p>Numurs: OJ-2452</p>", "OJ2452")).toBe(true);
    expect(listingHtmlHasPlate("<p>OJ 2452</p>", "oj-2452")).toBe(true);
    expect(listingHtmlHasPlate("<p>Numurs pēc pieprasījuma</p>", "OJ2452")).toBe(false);
  });

  it("numurzīmi nemeklē HTML atribūtos, stilos vai vārdu vidū", () => {
    expect(listingHtmlHasPlate('<div class="oj2452"></div><style>.a{color:#OJ2452}</style>', "OJ2452")).toBe(false);
    expect(listingHtmlHasPlate("<p>XOJ2452Y</p>", "OJ2452")).toBe(false);
  });

  it("numurzīme sludinājuma adresē neder", () => {
    const p = parsePartnerClickParams(new URLSearchParams(`plate=OJ2452&url=${encodeURIComponent("https://percunbrauc.lv/?s=OJ-2452")}`));
    expect(checkPartnerClick({ partner, referer: "https://percunbrauc.lv/", params: p }).ok).toBe(false);
  });

  it("ja VIN dots, sludinājumā meklē VIN, nevis numurzīmi", () => {
    expect(listingHtmlHasVehicleId(`<b>${VIN}</b>`, { vin: VIN, plate: "OJ2452" })).toBe(true);
    expect(listingHtmlHasVehicleId("<b>OJ-2452</b>", { vin: VIN, plate: "OJ2452" })).toBe(false);
  });

  it("ja VIN nav noteikts, saitē paliek numurzīme (VIN nosaka pēc apmaksas)", () => {
    const p = parsePartnerClickParams(new URLSearchParams(`plate=OJ-2452&url=${url}`));
    const rec = newPartnerBusinessLinkRecord({ tokenHash: "b".repeat(64), partnerId: "ptr_0123456789abcdef", params: p, listingVerified: true });
    expect(rec.prefillVin).toBe("OJ2452");
  });
});

describe("partnera pirkumu uzskaite", () => {
  it("partnera pirkumam partner_ref un VIN ir arī PaymentIntent metadatos", () => {
    const p = buildBusinessLinkCheckoutSessionParams({
      origin: "https://provin.lv",
      token: "t",
      tokenHash: "a".repeat(64),
      resolved: { email: "a@b.lv", vin: VIN, listingUrl: "", phone: "", companyName: "", companyReg: "", companyAddress: "" },
      partnerRef: "ptr_0123456789abcdef",
    });
    expect(p.payment_intent_data?.metadata).toEqual({ partner_ref: "ptr_0123456789abcdef", vin: VIN });
  });

  it("admina /b/ saitei (bez partnera) PaymentIntent metadatu nav", () => {
    const p = buildBusinessLinkCheckoutSessionParams({
      origin: "https://provin.lv",
      token: "t",
      tokenHash: "a".repeat(64),
      resolved: { email: "a@b.lv", vin: VIN, listingUrl: "", phone: "", companyName: "", companyReg: "", companyAddress: "" },
    });
    expect(p.payment_intent_data).toBeUndefined();
    expect(p.metadata.partner_ref).toBeUndefined();
  });
});
