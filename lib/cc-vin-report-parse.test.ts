import { describe, expect, it } from "vitest";

import { looksLikeCcVinReport, parseCcVinReportText } from "@/lib/cc-vin-report-parse";

/**
 * Fikstūra atkārto reālo PDF teksta slāni: salauztās ligatūras (`ti` → U+099E, `ft` → `[`),
 * kolonnu pārklāšanos starp lapām un statusu straumi pirms atzīmju nosaukumiem.
 */
const US_REPORT = [
  "Main/VIN Decoder And Lookup Database Used Car/BMW/3-Series/WBA5R1C0XLFH42873",
  "Vehicle history report",
  "BMW 3-Series, 2020",
  "VIN:",
  "WBA5R1C0XLFH42873",
  "Report Date:",
  "13/07/2026",
  "General Information",
  "8/12 attention marks",
  "Odometer records",
  "49,890 km",
  "Vehicle damages",
  "2 damage(s)",
  "Accidents",
  "Found problem(s)",
  "Theft records",
  "No problems found",
  "Lien / impound / export",
  "records",
  "No problems found",
  "Junk / salvage / insurance records",
  "Found problem(s)",
  "Title history",
  "4 problem(s)",
  "Number of owners",
  "4 owner(s)",
  "Taxi",
  "No problems found",
  "Found 10 photos",
  "Vehicle Speci\ufb01cations",
  "Year2020CountryGermany",
  "Source: Checkcar.vin",
  "Vehicle damages",
  "06/08/2020",
  "DAMAGE INFO",
  " Damage 1Front Damage",
  " Damage 2None",
  "Mileages",
  "6 record(s)",
  "50,000",
  "19/09/2019",
  "16 km",
  "20/11/2019",
  "5660 km",
  "28/05/2020",
  "20477 km",
  "11/08/2020",
  "49890 km",
  "Junk / salvage / insurance records",
  "3 registra\u099eon(s)",
  "18/03/2020",
  " IAA",
  "DETAILS",
  "Loca\u099eonWESTCHESTER",
  "Phone7084927000",
  "Disposi\u099eonSOLD",
  "IntendedNO",
  "16/03/2020",
  " STATE FARM INSURANCE",
  "DETAILS",
  "Loca\u099eonBLOOMINGTON",
  "Disposi\u099eonSALVAGE",
  "Intended-",
  "Title records",
  "4 record(s)",
  "Record #4",
  " 28/05/2020 California 20477 km",
  "Record #1",
  " 19/09/2019 California 16 km",
  "Salvage auc\u099eon records",
  "2 record(s)",
  "11/08/2020",
  " 31,000 km",
  "Primary Damage: Front end",
  "Secondary Damage: None",
  "Accident records",
  "No records found",
  "Auc\u099eon sale history",
  "2 record(s)",
  "SOLD #2",
  "49,890 kmIAAI11/08/2020",
  "SOLD #1",
  "38745 USD",
  "5,660 kmBmw Of Murrieta (Murrieta, CA)20/11/2019",
  "Title checks",
  "1 record(s)",
  "No records found",
  "No records found",
  "No records found",
  "Record found!",
  "Brand Date28/05/2020BrandCALIFORNIA",
  "No records found",
  "Flood damage",
  "A flood damage record means the vehicle damaged by freshwater flood.",
  "Record of Junk?",
  "The vehicle can only be sold as parts.",
  "Record of Vehicle Rebuilt?",
  "The vehicle, previously branded \"salvage\", has passed an\u099e-the[ inspec\u099eons.",
  "Salvage: Damage or Not Speci\ufb01ed",
  "Any vehicle which has been wrecked, destroyed or damaged.",
  "Salvage: Stolen",
  "Any vehicle the repor\u099eng jurisdic\u099eon considers salvage.",
  "Safety recall campaigns",
  "No records found",
  "Complaints",
  "No records found",
].join("\n");

const EU_REPORT = [
  "Vehicle history report",
  "Ford RANGER, 2021",
  "VIN:",
  "6FPPXXMJ2PMR24461",
  "Report Date:",
  "14/08/2026",
  "General Information",
  "1/12 atten\u099eon marks",
  "Odometer records",
  "999,999 km",
  "Vehicle damages",
  "No problems found",
  "Accidents",
  "No problems found",
  "Sales history",
  "1 record(s)",
  "Taxi",
  "No records found",
  "Found 79 photos",
  "Mileages",
  "2 record(s)",
  "01/10/2021",
  "200 km",
  "24/09/2025",
  "999999 km",
  "Auc\u099eon sale history",
  "1 record(s)",
  "SOLD #1",
  "7 662 EUR",
  "999,999 kmAUTOROLA24/09/2025",
].join("\n");

describe("cc-vin (starptautiskā vēsture) PDF parseris", () => {
  it("atpazīst atskaiti pēc galvenes", () => {
    expect(looksLikeCcVinReport(US_REPORT, "WBA5R1C0XLFH42873_BMW_3-SERIES_2020_EN.pdf")).toBe(true);
    expect(looksLikeCcVinReport("Servisa izdruka BMW", "bmw.pdf")).toBe(false);
  });

  it("nolasa galveni, atzīmju skaitu un īpašnieku skaitu", () => {
    const p = parseCcVinReportText(US_REPORT);
    expect(p.vin).toBe("WBA5R1C0XLFH42873");
    expect(p.vehicleLine).toBe("BMW 3-Series, 2020");
    expect(p.reportDate).toBe("13.07.2026");
    expect(p.attentionMarks).toBe("8/12");
    expect(p.ownersCount).toBe("4");
  });

  it("tulko reģistru pārbaudes un atzīmē tikai tās ar ierakstiem", () => {
    const p = parseCcVinReportText(US_REPORT);
    const byLabel = new Map(p.checks.map((c) => [c.label, c]));
    expect(byLabel.get("Odometra ieraksti")).toEqual({
      label: "Odometra ieraksti",
      status: "49 890 km",
      severity: "alert",
    });
    expect(byLabel.get("Fiksētie bojājumi")?.status).toBe("2 bojājumi");
    expect(byLabel.get("Zādzību ieraksti")?.severity).toBe("ok");
    expect(byLabel.get("Ķīlas, aresta un eksporta ieraksti")?.status).toBe("Nav atrastu problēmu");
    expect(byLabel.get("Īpašnieku skaits")?.status).toBe("4 īpašnieki");
    expect(p.checks.filter((c) => c.severity === "alert")).toHaveLength(6);
  });

  it("savāc odometra rādījumus no visām sadaļām un apvieno dublikātus", () => {
    const p = parseCcVinReportText(US_REPORT);
    expect(p.mileage).toEqual([
      { date: "11.08.2020", odometer: "49890", country: "ASV" },
      { date: "11.08.2020", odometer: "31000", country: "ASV" },
      { date: "28.05.2020", odometer: "20477", country: "ASV" },
      { date: "20.11.2019", odometer: "5660", country: "ASV" },
      { date: "19.09.2019", odometer: "16", country: "ASV" },
    ]);
  });

  it("nolasa bojājumus un izsoles bojājumu aprakstus latviski", () => {
    const p = parseCcVinReportText(US_REPORT);
    expect(p.damages).toEqual([
      { date: "06.08.2020", region: "", amount: "", description: "Priekšpuses bojājums" },
      {
        date: "11.08.2020",
        region: "",
        amount: "",
        description: "Norakstīto auto izsole: Priekšpuses bojājums",
      },
    ]);
  });

  it("nolasa apdrošinātāju ierakstus ar statusu un vietu", () => {
    const p = parseCcVinReportText(US_REPORT);
    expect(p.insurance).toEqual([
      { date: "18.03.2020", label: "IAA", detail: "Statuss: Pārdots · Vieta: Westchester" },
      {
        date: "16.03.2020",
        label: "State Farm Insurance",
        detail: "Statuss: Norakstīts (salvage) · Vieta: Bloomington",
      },
    ]);
  });

  it("sasaista atrasto īpašumtiesību atzīmi ar pareizo nosaukumu", () => {
    const p = parseCcVinReportText(US_REPORT);
    expect(p.brands).toEqual([
      {
        date: "28.05.2020",
        label: "Norakstīts pēc bojājumiem (salvage)",
        detail: "Reģistrēts: California (ASV)",
      },
    ]);
    expect(p.notes).toHaveLength(0);
  });

  it("nolasa title ierakstus un izsoļu pārdošanas", () => {
    const p = parseCcVinReportText(US_REPORT);
    expect(p.titles).toEqual([
      { date: "28.05.2020", region: "California (ASV)", odometer: "20477", note: "" },
      { date: "19.09.2019", region: "California (ASV)", odometer: "16", note: "" },
    ]);
    expect(p.sales).toEqual([
      { date: "11.08.2020", venue: "IAAI", odometer: "49 890", price: "", status: "Pārdots" },
      {
        date: "20.11.2019",
        venue: "Bmw Of Murrieta (Murrieta, CA)",
        odometer: "5 660",
        price: "38 745 USD",
        status: "Pārdots",
      },
    ]);
  });

  it("neatkārto vienu bojājumu, ja izsoles ieraksts to apraksta tajā pašā datumā", () => {
    const text = [
      "Vehicle history report",
      "BMW 3-Series, 2020",
      "Vehicle damages",
      "06/08/2020",
      "DAMAGE INFO",
      " Damage 1Front Damage",
      "Salvage auc\u099eon records",
      "1 record(s)",
      "06/08/2020",
      " IAAI",
      " 49,890 km",
      "Primary Damage: Front damage",
      "Secondary Damage: None",
    ].join("\n");
    expect(parseCcVinReportText(text).damages).toEqual([
      {
        date: "06.08.2020",
        region: "IAAI",
        amount: "",
        description: "Norakstīto auto izsole: Priekšpuses bojājums",
      },
    ]);
  });

  it("tīrā EU atskaitē nav sarkano karogu, bet ir odometrs un pārdošana", () => {
    const p = parseCcVinReportText(EU_REPORT);
    expect(p.vin).toBe("6FPPXXMJ2PMR24461");
    expect(p.attentionMarks).toBe("1/12");
    expect(p.brands).toHaveLength(0);
    expect(p.damages).toHaveLength(0);
    expect(p.mileage).toEqual([
      { date: "24.09.2025", odometer: "999999", country: "" },
      { date: "01.10.2021", odometer: "200", country: "" },
    ]);
    expect(p.sales).toEqual([
      { date: "24.09.2025", venue: "AUTOROLA", odometer: "999 999", price: "7 662 EUR", status: "Pārdots" },
    ]);
  });

  it("nolasa Eiropas CheckCar Accident #N ar CountryDE un remonta tāmi", () => {
    const text = [
      "Vehicle history report",
      "BMW 535, 2015",
      "VIN:",
      "WBA5K71050G295219",
      "Report ID:",
      "dd7bb9b04cf7c69986ecf08414bef70c",
      "Source: Checkcar.vin",
      "Accident records",
      "1 accident(s)",
      "01/06/2016",
      "Accident #1",
      "CountryDE",
      "Total Repair (es\u099emate) cost1,360 USD",
      "Mileages",
      "2 record(s)",
      "01/05/2016",
      "27000 km",
      "01/06/2016",
      "29000 km",
    ].join("\n");
    expect(looksLikeCcVinReport(text, "WBA5K71050G295219_BMW_535_2015_EN.pdf")).toBe(true);
    const p = parseCcVinReportText(text);
    expect(p.damages).toEqual([
      {
        date: "01.06.2016",
        region: "Vācija",
        amount: "1 360 USD",
        description: "Negadījums",
      },
    ]);
    expect(p.mileage).toEqual([
      { date: "01.06.2016", odometer: "29000", country: "" },
      { date: "01.05.2016", odometer: "27000", country: "" },
    ]);
  });

  it("nolasa CheckCar izsoli arī tad, ja cena, km, vieta un datums ir atsevišķās rindās", () => {
    const glued = [
      "Vehicle history report",
      "Report ID:",
      "abc",
      "Source: Checkcar.vin",
      "Auction sale history",
      "1 record(s)",
      "SOLD #1",
      "3,989 USD",
      "304,900 kmAUTOBID10/06/2026",
    ].join("\n");
    const split = [
      "Vehicle history report",
      "Report ID:",
      "abc",
      "Source: Checkcar.vin",
      "Auction sale history",
      "1 record(s)",
      "SOLD #1",
      "3,989 USD",
      "304,900 km",
      "AUTOBID",
      "10/06/2026",
      "VEHICLE INFO",
      "MakeBMW",
    ].join("\n");
    for (const text of [glued, split]) {
      const p = parseCcVinReportText(text);
      expect(p.sales).toEqual([
        {
          date: "10.06.2026",
          venue: "AUTOBID",
          odometer: "304 900",
          price: "3 989 USD",
          status: "Pārdots",
        },
      ]);
      expect(p.mileage).toEqual([{ date: "10.06.2026", odometer: "304900", country: "Vācija" }]);
    }
  });
});
