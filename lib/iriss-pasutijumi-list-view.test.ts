import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { irissPasutijumsToListRow } from "@/lib/iriss-pasutijumi-list-row";
import {
  countIrissNewHitsByOrder,
  formatIrissExpiredOfferLabel,
  formatIrissListKm,
  formatIrissListLinksLabel,
  formatIrissListNextStep,
  formatIrissListPhoneText,
  formatIrissListSpecBrief,
  irissListBudgetText,
  irissListCriteriaRows,
  irissListMailtoHref,
  irissListShowCallAction,
  irissListShowEmailAction,
  irissPhoneWhatsAppDigits,
} from "@/lib/iriss-pasutijumi-list-view";

describe("IRISS 01 pasūtījumu saraksta skats", () => {
  it("shows Zvanīt only on the phone viewport", () => {
    expect(irissListShowCallAction(true)).toBe(true);
    expect(irissListShowCallAction(false)).toBe(false);
  });

  it("shows E-pasts only when an address exists", () => {
    expect(irissListShowEmailAction("")).toBe(false);
    expect(irissListShowEmailAction("-")).toBe(false);
    expect(irissListShowEmailAction("anna")).toBe(false);
    expect(irissListShowEmailAction("anna@example.com")).toBe(true);
    expect(irissListMailtoHref("anna@example.com")).toBe("mailto:anna@example.com");
    expect(irissListMailtoHref("")).toBeNull();
  });

  it("keeps WhatsApp digits for a Latvian number", () => {
    expect(irissPhoneWhatsAppDigits("20000000")).toBe("37120000000");
    expect(irissPhoneWhatsAppDigits("-")).toBeNull();
  });

  it("formats mileage with km", () => {
    expect(formatIrissListKm("150000")).toBe("150 000 km");
    expect(formatIrissListKm("120 000 km")).toBe("120 000 km");
    expect(formatIrissListKm("")).toBe("");
    expect(formatIrissListKm("-")).toBe("");
  });

  it("builds a short spec, not the long criteria dump", () => {
    const rec = emptyIrissPasutijums("a", "2026-04-22T10:00:00.000Z");
    rec.brandModel = "Audi A6";
    rec.productionYears = "2012-2015";
    rec.engineType = "3.0 TDI";
    rec.maxMileage = "200000";
    rec.transmission = "Automāts";
    rec.bodyType = "Sedans";
    rec.preferredColors = "Melna";
    rec.dealEkki = true;
    rec.equipmentRequired = "140 kW, ACC";
    const row = irissPasutijumsToListRow(rec);
    const brief = formatIrissListSpecBrief(row);
    expect(brief).toContain("2012-2015");
    expect(brief).toContain("140 kW");
    expect(brief).toContain("200 000 km");
    expect(brief).not.toContain("Sedans");
    expect(brief).not.toContain("EKKI");
    expect(brief).not.toContain("Melna");
    expect(brief).not.toMatch(/\u2014|\u2013/);
  });

  it("uses IrissOrderRoomNextSteps for the current step", () => {
    const rec = emptyIrissPasutijums("a", "2026-04-22T10:00:00.000Z");
    rec.phone = "20000000";
    rec.vin = "";
    const row = irissPasutijumsToListRow(rec);
    expect(formatIrissListNextStep(row, 18)).toBe("Apskatīt 18 jaunus sludinājumus");
    expect(formatIrissListNextStep(row, 1)).toBe("Apskatīt 1 jaunu sludinājumu");
    expect(formatIrissListNextStep(row, 0)).toBe("Sagatavot pirmo piedāvājumu");
    rec.vin = "WVWZZZ1JZ3W386752";
    rec.offers = [];
    const withVin = irissPasutijumsToListRow(rec);
    withVin.hasExpiredOffer = true;
    withVin.latestOfferValidUntil = "2026-08-10";
    expect(formatIrissListNextStep(withVin, 0)).toBe("Sazināties ar klientu");
  });

  it("counts jauns matches per order like Jaunas atbilstības", () => {
    expect(
      countIrissNewHitsByOrder([
        { orderId: "a", status: "jauns" },
        { orderId: "a", status: "jauns" },
        { orderId: "a", status: "skatits" },
        { orderId: "b", status: "jauns" },
        { orderId: "", status: "jauns" },
      ]),
    ).toEqual({ a: 2, b: 1 });
  });

  it("labels expired offers with a date and uses ASCII dash for empty budget", () => {
    expect(formatIrissExpiredOfferLabel("2026-12-10")).toBe("Piedāvājums beidzies 10.12");
    expect(formatIrissExpiredOfferLabel("")).toBe("Piedāvājums beidzies");
    expect(irissListBudgetText("")).toBe("-");
    expect(irissListBudgetText("\u2014")).toBe("-");
    expect(irissListBudgetText("līdz 12 000 €")).toBe("līdz 12 000 €");
    // Nils 28.10: tīrs skaitlis -> "40 000 €".
    expect(irissListBudgetText("40000")).toBe("40 000 €");
    expect(irissListBudgetText("15 500")).toBe("15 500 €");
    expect(irissListBudgetText("23000 EUR")).toBe("23 000 €");
    expect(formatIrissListLinksLabel(0)).toBe("Nav saišu");
    expect(formatIrissListLinksLabel(1)).toBe("1 saite");
    expect(formatIrissListLinksLabel(5)).toBe("5 saites");
  });
});

describe("IRISS 01 list chrome", () => {
  it("keeps the top panel scrolling and hides desktop Zvanīt", () => {
    const list = readFileSync("components/admin/IrissPasutijumiListClient.tsx", "utf8");
    const page = readFileSync("app/admin/iriss/pasutijumi/page.tsx", "utf8");
    const row = readFileSync("components/admin/IrissPasutijumiListRow.tsx", "utf8");
    expect(list).not.toMatch(/sticky top-0/);
    expect(list).not.toMatch(/am-topbar-sticky/);
    expect(list).not.toMatch(/IrissPasutijumiNewFab/);
    expect(page).not.toMatch(/IrissPasutijumiNewFab/);
    expect(page).not.toMatch(/#F8F8F9/);
    expect(list).toContain("AdminCollapsedMenuButton");
    expect(list).toMatch(/Jauns pasūtījums/);
    // Nils 30.10: masveida eCarsTrade saišu aizstāšana visiem pasūtījumiem noņemta.
    expect(list).not.toMatch(/Atjaunot eCarsTrade saites/);
    expect(list).not.toMatch(/Aizstātas eCarsTrade saites/);
    expect(list).not.toMatch(/\u2014|\u2013/);
    expect(row).toMatch(/irissListShowCallAction/);
    // Nils 28.10: telefonā redzama poga "Zvanīt" un "Kritēriji"; datorā zvana ikonas nav.
    expect(row).toMatch(/Zvanīt/);
    expect(row).toMatch(/Kritēriji/);
    expect(row).toMatch(/aria-label="Atvērt WhatsApp"/);
    expect(row).not.toMatch(/IrissBrandLogoSlot/);
    expect(row).not.toMatch(/IrissAuctionLogo/);
    expect(row).toMatch(/Atvērt visas saites/);
    expect(row).toMatch(/Piespraust/);
    expect(row).toContain("iriss-pas-hits");
    expect(row).not.toMatch(/sticky top-0/);
  });
});

describe("Tālrunis sarakstā (Nils 28.10)", () => {
  it("Latvijas numuri vienotā formā, ārzemju - kā ievadīti", () => {
    expect(formatIrissListPhoneText("29796840")).toBe("+371 29 796 840");
    expect(formatIrissListPhoneText("+37129172540")).toBe("+371 29 172 540");
    expect(formatIrissListPhoneText("+371 26 357 321")).toBe("+371 26 357 321");
    expect(formatIrissListPhoneText("+49 151 1234567")).toBe("+49 151 1234567");
    expect(formatIrissListPhoneText("")).toBe("");
  });
});

describe("Kritēriji telefonā (Nils 28.10)", () => {
  it("rāda aizpildītos kritērijus, tukšos izlaiž", () => {
    const rows = irissListCriteriaRows({
      productionYears: "2019-2020",
      maxMileage: "150000",
      engineType: "Dīzelis",
      transmission: "Automāts",
      driveType: "",
      bodyType: "-",
      seatCount: "",
      preferredColors: "melna",
      nonPreferredColors: "sarkana",
      interiorFinish: "",
    });
    expect(rows).toEqual([
      { label: "Gadi", value: "2019-2020" },
      { label: "Nobraukums", value: "150 000 km" },
      { label: "Degviela · kārba", value: "Dīzelis · Automāts" },
      { label: "Krāsas", value: "melna · ne sarkana" },
    ]);
  });
});
