import { describe, expect, it } from "vitest";
import { translateAuctionTerms } from "@/lib/auction-terms-i18n";
import { buildCcVinPdfInnerHtml } from "@/lib/cc-vin-pdf-html";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";

describe("translateAuctionTerms (Nils 27.11 - izsoļu termini klienta valodā)", () => {
  it("tulko bojājumu kombinācijas ar «+» LV/RU/DE, EN paliek", () => {
    expect(translateAuctionTerms("Front end + Unknown", "lv")).toBe("Priekšpuse + nezināms");
    expect(translateAuctionTerms("Front end + Unknown", "ru")).toBe("Передняя часть + неизвестно");
    expect(translateAuctionTerms("Front end + Unknown", "de")).toBe("Front + Unbekannt");
    expect(translateAuctionTerms("Front end + Unknown", "en")).toBe("Front end + Unknown");
  });

  it("modeļa nosaukumu netulko, statusu aiz «·» tulko", () => {
    const s = "2013 BMW 5 Series, 535I Xdrive · Sold";
    expect(translateAuctionTerms(s, "lv")).toBe("2013 BMW 5 Series, 535I Xdrive · Pārdots");
    expect(translateAuctionTerms(s, "ru")).toBe("2013 BMW 5 Series, 535I Xdrive · Продан");
    expect(translateAuctionTerms(s, "de")).toBe("2013 BMW 5 Series, 535I Xdrive · Verkauft");
    expect(translateAuctionTerms(s, "en")).toBe(s);
  });

  it("IAAI/Copart kodi ar dažādu rakstību", () => {
    expect(translateAuctionTerms("FRONT END", "lv")).toBe("Priekšpuse");
    expect(translateAuctionTerms("Minor Dent/Scratches", "lv")).toBe("Nelieli ieliekumi / skrāpējumi");
    expect(translateAuctionTerms("Water/Flood", "de")).toBe("Wasserschaden / Überflutung");
    expect(translateAuctionTerms("Burn - Engine", "lv")).toBe("Ugunsbojājums (dzinējs)");
    expect(translateAuctionTerms("Burn - Interior", "ru")).toBe("Повреждение огнём (салон)");
    expect(translateAuctionTerms("Run & Drive", "lv")).toBe("Iedarbojas un brauc");
    expect(translateAuctionTerms("Not Sold", "lv")).toBe("Nav pārdots");
    expect(translateAuctionTerms("On Approval", "de")).toBe("Wartet auf Verkäuferfreigabe");
    expect(translateAuctionTerms("Keys Available", "ru")).toBe("Ключи есть");
    expect(translateAuctionTerms("Replaced VIN", "lv")).toBe("Nomainīts VIN");
    expect(translateAuctionTerms("Rear End, Side", "lv")).toBe("Aizmugure, sāns");
    expect(translateAuctionTerms("Hail; Roof", "de")).toBe("Hagel; Dach");
  });

  it("nezināmu terminu atstāj oriģinālā (bez izdomājumiem)", () => {
    expect(translateAuctionTerms("Front End + Bumper scuffed", "lv")).toBe("Priekšpuse + Bumper scuffed");
    expect(translateAuctionTerms("Crushed by forklift", "ru")).toBe("Crushed by forklift");
    expect(translateAuctionTerms("", "lv")).toBe("");
  });

  it("LV PDF neaiztiek jau latvisku tekstu; EN/RU/DE PDF mūsu LV formas pārtulko", () => {
    expect(translateAuctionTerms("Priekšpuses bojājums", "lv")).toBe("Priekšpuses bojājums");
    expect(translateAuctionTerms("Pārdots", "lv")).toBe("Pārdots");
    expect(translateAuctionTerms("Pārdots", "en")).toBe("Sold");
    expect(translateAuctionTerms("priekšpuse, sāns", "ru")).toBe("Передняя часть, бок");
  });

  it("noņem «(oriģināls)» atzīmi, ja termins tagad zināms", () => {
    expect(translateAuctionTerms("Hail (oriģināls)", "lv")).toBe("Krusa");
  });
});

describe("IZSOĻU PORTĀLU ARHĪVS PDF tabulas", () => {
  const block = () => {
    const b = emptyCcVinBlock();
    b.damages = [{ date: "12.05.2022", region: "IAAI", amount: "", description: "Front end + Unknown" }];
    b.sales = [{ date: "12.05.2022", venue: "IAAI", odometer: "120000", price: "", status: "2013 BMW 5 Series, 535I Xdrive · Sold" }];
    return b;
  };

  it("LV PDF (noklusējums) rāda latviski", () => {
    const html = buildCcVinPdfInnerHtml(block());
    expect(html).toContain("Priekšpuse + nezināms");
    expect(html).toContain("2013 BMW 5 Series, 535I Xdrive · Pārdots");
    expect(html).not.toContain("Unknown");
    expect(html).not.toContain("· Sold");
  });

  it("RU/DE PDF rāda klienta valodā, EN paliek angliski", () => {
    expect(buildCcVinPdfInnerHtml(block(), { lang: "ru" })).toContain("Передняя часть + неизвестно");
    expect(buildCcVinPdfInnerHtml(block(), { lang: "de" })).toContain("535I Xdrive · Verkauft");
    const en = buildCcVinPdfInnerHtml(block(), { lang: "en" });
    expect(en).toContain("Front end + Unknown");
    expect(en).toContain("535I Xdrive · Sold");
  });
});
