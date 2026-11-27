import { describe, expect, it } from "vitest";
import {
  checkoutIpCountryMetadata,
  clientLangDecisionLabel,
  clientLangSignalsFromSession,
  decideClientLangForOrder,
  decideOrderClientLang,
  latvianClientReasons,
  orderFieldLvPlate,
  parseClientLangStoredSignals,
} from "@/lib/client-lang-detect";
import { resolveOrderClientLang } from "@/lib/email/client-lang-email-copy";
import { buildB2bWalletOrderNoteParts } from "@/lib/b2b-wallet";

const b2bNotes = (lang: "lv" | "en" | "ru" | "de") =>
  buildB2bWalletOrderNoteParts({ txnId: "wtx_1_1_abc", product: "dealer_pro", priceCents: 1999, reportLang: lang }).join(" · ");

describe("klienta valoda - Latvijas signāli", () => {
  it("EN vietne + IP LV + LV numurs -> LV ar iemeslu", () => {
    const d = decideOrderClientLang({ locale: "en", signals: { ipCountry: "LV", orderPlate: "AB1234" } });
    expect(d.lang).toBe("lv");
    expect(d.source).toBe("auto_lv");
    expect(clientLangDecisionLabel(d)).toBe("LV - pēc: IP LV, LV numurs");
  });

  it("maksātāja valsts LV viena pati -> LV (spēcīgs)", () => {
    expect(decideOrderClientLang({ locale: "en", signals: { billingCountry: "lv" } }).lang).toBe("lv");
  });

  it("kartes valsts LV viena pati -> LV (spēcīgs)", () => {
    expect(decideOrderClientLang({ locale: "de", signals: { cardCountry: "LV" } }).lang).toBe("lv");
  });

  it("viens vidējs signāls nepietiek (paliek EN)", () => {
    expect(decideOrderClientLang({ locale: "en", signals: { ipCountry: "LV" } }).lang).toBe("en");
    expect(decideOrderClientLang({ locale: "en", signals: { phones: ["+371 29 123 456"] } }).lang).toBe("en");
    expect(decideOrderClientLang({ locale: "en", signals: { emails: ["janis@inbox.lv"] } }).lang).toBe("en");
  });

  it("vidējs + vājš (vārds ar garumzīmēm) nepietiek; divi vidēji - LV", () => {
    expect(
      decideOrderClientLang({ locale: "en", signals: { phones: ["+37129123456"], customerName: "Jānis Bērziņš" } }).lang,
    ).toBe("en");
    expect(
      decideOrderClientLang({ locale: "en", signals: { phones: ["0037129123456"], emails: ["a@inbox.lv"] } }).lang,
    ).toBe("lv");
  });

  it("tikai vārds ar garumzīmēm - nepietiek", () => {
    expect(decideOrderClientLang({ locale: "en", signals: { customerName: "Kārlis Ozoliņš" } }).lang).toBe("en");
  });

  it("RU vietne paliek RU pat ar spēcīgiem LV signāliem", () => {
    const d = decideOrderClientLang({ locale: "ru", signals: { billingCountry: "LV", ipCountry: "LV", orderPlate: "AB1234" } });
    expect(d.lang).toBe("ru");
    expect(d.source).toBe("site");
  });

  it("ārzemju signāli - paliek vietnes valoda", () => {
    expect(
      decideOrderClientLang({
        locale: "de",
        signals: { billingCountry: "DE", ipCountry: "DE", phones: ["+49 151 1234567"], emails: ["max@web.de"] },
      }).lang,
    ).toBe("de");
  });

  it("LV vietne paliek LV; nezināma locale -> LV", () => {
    expect(decideOrderClientLang({ locale: "lv", signals: {} }).lang).toBe("lv");
    expect(decideOrderClientLang({ locale: "auto" }).lang).toBe("lv");
  });

  it("admina izvēle ir svarīgāka par signāliem; partnera valoda svarīgāka par admina izvēli", () => {
    expect(decideOrderClientLang({ locale: "en", override: "ru", signals: { billingCountry: "LV" } })).toMatchObject({
      lang: "ru",
      source: "manual",
    });
    expect(decideOrderClientLang({ locale: "lv", override: "en" }).lang).toBe("en");
    expect(decideOrderClientLang({ notes: b2bNotes("de"), locale: "en", override: "lv" })).toMatchObject({
      lang: "de",
      source: "partner",
    });
    // Tukša izvēle = automātiski.
    expect(decideOrderClientLang({ locale: "en", override: "", signals: { billingCountry: "LV" } }).source).toBe("auto_lv");
  });

  it("vecie pasūtījumi bez IP valsts - strādā pēc pārējiem signāliem", () => {
    const d = decideClientLangForOrder(
      {
        locale: "en",
        vin: "WBA5R1C0XLFH42873",
        customerEmail: "janis@inbox.lv",
        phone: "+371 29 000 000",
        customerName: "Jānis",
        clientLangSignals: null,
      },
      { orderEdits: {} },
    );
    expect(d.lang).toBe("lv");
    expect(d.reasons).toEqual(["phone", "email", "name"]);
  });

  it("melnraksta numurzīme (pasūtīts pēc numura) skaitās", () => {
    const d = decideClientLangForOrder(
      { locale: "en", vin: "WBA5R1C0XLFH42873", clientLangSignals: { ipCountry: "LV" } },
      { orderEdits: { licensePlate: "KX-1234" } },
    );
    expect(d.reasons).toEqual(["ip", "plate"]);
    expect(d.lang).toBe("lv");
  });

  it("melnraksta izvēle un piezīmes no draft", () => {
    expect(decideClientLangForOrder({ locale: "en" }, { orderEdits: { clientLangOverride: "de" } }).lang).toBe("de");
    expect(decideClientLangForOrder({ locale: "en" }, { orderEdits: { notes: b2bNotes("ru") } }).lang).toBe("ru");
  });

  it("numurzīme: VIN nav numurzīme", () => {
    expect(orderFieldLvPlate("WBA5R1C0XLFH42873")).toBeNull();
    expect(orderFieldLvPlate("ab-1234")).toBe("AB1234");
    expect(orderFieldLvPlate("")).toBeNull();
  });

  it("e-pasts: tikai .lv domēns", () => {
    expect(latvianClientReasons({ emails: ["x@lv.example.com"] })).toEqual([]);
    expect(latvianClientReasons({ emails: ["x@gmail.com", "y@tet.lv"] })).toEqual(["email"]);
  });
});

describe("Stripe sesijas signāli", () => {
  it("valsts kodi un numurzīme no sesijas; kartes valsts no izvērsta payment_method", () => {
    const sig = clientLangSignalsFromSession({
      metadata: { ip_country: "lv", vin: "AB1234" },
      customer_details: { address: { country: "LV" } },
      payment_intent: { payment_method: { card: { country: "LV" } } },
    });
    expect(sig).toEqual({ ipCountry: "LV", billingCountry: "LV", cardCountry: "LV", orderPlate: "AB1234" });
  });

  it("neizvērsts payment_intent (string) - bez kartes valsts; nederīgs kods ignorēts", () => {
    expect(clientLangSignalsFromSession({ metadata: { ip_country: "XX1" }, payment_intent: "pi_123" })).toEqual({});
  });

  it("parse no JSON: tikai zināmi lauki", () => {
    expect(parseClientLangStoredSignals({ ipCountry: "LV", ip: "1.2.3.4", orderPlate: "WBA5R1C0XLFH42873" })).toEqual({
      ipCountry: "LV",
    });
    expect(parseClientLangStoredSignals(null)).toBeNull();
  });

  it("checkout: tikai valsts kods, nekad IP adrese", () => {
    const h = new Headers({ "x-vercel-ip-country": "LV", "x-forwarded-for": "1.2.3.4" });
    expect(checkoutIpCountryMetadata(h)).toEqual({ ip_country: "LV" });
    expect(checkoutIpCountryMetadata(new Headers())).toEqual({});
  });
});

describe("resolveOrderClientLang (saderība)", () => {
  it("vecā uzvedība bez signāliem nemainās", () => {
    expect(resolveOrderClientLang({ notes: b2bNotes("de"), locale: "en" })).toBe("de");
    expect(resolveOrderClientLang({ locale: "de-DE" })).toBe("de");
    expect(resolveOrderClientLang({ locale: "fr" })).toBe("lv");
    expect(resolveOrderClientLang({})).toBe("lv");
  });
  it("ar signāliem un izvēli", () => {
    expect(resolveOrderClientLang({ locale: "en", signals: { billingCountry: "LV" } })).toBe("lv");
    expect(resolveOrderClientLang({ locale: "en", override: "de", signals: { billingCountry: "LV" } })).toBe("de");
  });
});
