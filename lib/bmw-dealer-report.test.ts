import { describe, expect, it } from "vitest";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { extractDealerReport, looksLikeDealerReport } from "@/lib/dealer-report-extract";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import { buildVendorCopilotActions } from "@/lib/vendor-pdf-agent-merge";

/** BMW dīlera portāla izdrukas teksts — kolonnas un rindas salīp tāpat kā īstajā PDF. */
const BMW_TEXT = `BMW E61
MODEL SERIES
E61
VIN
WBAPX51050CU09550
VEHICLE TYPE
PX61
TRANSMISSION
AUT
STEERING
LL
ENGINE
M57/T2
ENGINE NUMBER
23956863
BODY
TOU
DRIVE
HECK
POWER
145 kW
INTEGRATION LEVEL
E060-08-03-550
CURRENT I LEVEL
E060-16-11-500
DEVELOPMENT CODE
E61
MODEL CODE
PX61
PRODUCTION DATE
02/06/2008
FIRST REGISTRATION
29/07/2008
WARRANTY START DATE
25/07/2008
COUNTRY/REGION
EUR
COLOUR
black-sapphire metallic
COLOUR CODE
0475
UPHOLSTERY
Leather "Dakota"/natural brown
UPHOLSTERY CODE
LCNG

Specifications & Options
CodeDescription
0205Automatic transmission
0255Sports leather steering wheel
02BYBMW LA wheel,double spoke 278/flat-runn.

Service History
26/01/201638,758 mi / 62,375 kmAutohaus Karl + Co., Mainz-Kastel
IconComponentStatusServicedDue DateRemaining Distance
Engine oil-
✓
--
Front brake-
-
--
Microfilter-
✓
--

Key Read History
12/05/2026188,858 mi / 303,938 km
IconComponentStatusDue DateRemaining Distance
Standard scope--
Brake FluidNot due
10/08/2026-
Engine oil--17398 mi
Statutory vehicle inspectionNot due
05/08/2027-
Engine oilOverdue
01/05/2025-11185 mi
Fuel filterNot due01/05/20256835 mi

Repair History

12/05/2026188,658 mi / 303,616 kmDealer ID: 00863-3Order: 140893-00|1260512
No additional details available.
08/01/202596,332 mi / 155,000 kmNiederlassung Bonn BMW AG, BonnOrder: 221100
Part NamePart NumberQuantity
BMW cleaning fluid with antifreeze83125A66D571
Order
Set, microfilter/carbon canister643191718582
Ölzuschlag für Service Inclusive
Nachrüstung Service-Inclusive
Kundenloyalisiereung siehe Mail
Relay, make contact, white green
Original BMW AGM-battery
Pipe, Exhaust gas radiator high temperature
05/09/2019123,549 mi / 198,833 kmB&K Deutschland GmbH, OsnabrückOrder: WAU19508516
Part NamePart NumberQuantity
Kontaktschutzfett KF1FT999922952127/07/2019122,513 mi / 197,165 kmBMW Mobiler Service Einsatzleitzentrale, MünchenOrder: 5582973
No additional details available.
23/10/201474,860 mi / 120,475 kmB&K Deutschland GmbH, OsnabrückOrder: WAU14011777
Part NamePart NumberQuantity
Beide Vorderräder auswuchtenFTT361
Castrol Magnatec Prof. MP 5W-30 LL04FT9999000007
Set oil-filter element114285133771
Microfilter/activated Carbon container643191718582
02/01/2013-Autohaus Karl + Co. GmbH & Co. KG, RüsselsheimOrder: 620527
Part NamePart NumberQuantity
Cover, windshield, top51317258053-1
`;

/** auto-records.com izdruka: divas komplektācijas kolonnas salīp vienā rindā. */
const AUTO_RECORDS_TEXT = `VEHICLE INFORMATION
VIN Code:
WBABV91050PJ84272
Model:
330CD
Series:
3
Generation:
E46
Type code:
BV91
Engine code:
M57/TU
Steering side:
Left
Color:
Mystic-blau metallic (L0A07)
Interior:
Leather Montana/basic equip/schwarz (PN6SW)
Transmission:
Manual

ODOMETER CHECK
StatusEvent DateEvent LocationOdometer ReadingEvent Detail
2016-03-16Saint-Grégoire, France238,563 kmServiceVisit
2010-01-14-154,198 kmServiceVisit

ACCIDENT CHECK
No records found.

STOLEN VEHICLE DATABASE
No records found.

EQUIPMENT LIST
S0710 - M LEATHER STEERING WHEELS0785 - WHITE DIRECTION INDICATOR LIGHTS
S0A07 - MYSTIC-BLAU METALLIC
`;

describe("BMW dealer PDF", () => {
  it("is detected as an official dealer printout", () => {
    expect(looksLikeDealerReport(BMW_TEXT)).toBe(true);
    expect(looksLikeDealerReport(AUTO_RECORDS_TEXT)).toBe(true);
  });

  it("extracts every vehicle information field with dates as DD.MM.YYYY", () => {
    const vi = extractDealerReport(BMW_TEXT).vehicleInfo;
    expect(vi).toMatchObject({
      model: "BMW E61",
      modelSeries: "E61",
      vinCode: "WBAPX51050CU09550",
      vehicleType: "PX61",
      transmission: "AUT",
      steeringSide: "LL",
      engineCode: "M57/T2",
      engineNumber: "23956863",
      body: "TOU",
      drive: "HECK",
      power: "145 kW",
      integrationLevel: "E060-08-03-550",
      currentILevel: "E060-16-11-500",
      developmentCode: "E61",
      modelCode: "PX61",
      productionDate: "02.06.2008",
      firstRegistration: "29.07.2008",
      warrantyStartDate: "25.07.2008",
      countryRegion: "EUR",
      color: "black-sapphire metallic",
      colorCode: "0475",
      interior: 'Leather "Dakota"/natural brown',
      interiorCode: "LCNG",
    });
  });

  it("stores odometer readings in kilometres and splits glued visit rows", () => {
    const extract = extractDealerReport(BMW_TEXT);
    expect(extract.mileage[0]).toEqual({ date: "12.05.2026", odometer: "303938", country: "" });

    const dates = extract.serviceHistory.map((e) => e.date);
    expect(dates).toContain("27.07.2019");
    expect(dates).toContain("23.10.2014");

    const visit = extract.serviceHistory.find((e) => e.date === "23.10.2014");
    expect(visit?.odometer).toBe("120475");
    expect(visit?.country).toBe("Vācija");
    // Servisa punkts ir atsevišķi, nevis darbu tekstā
    expect(visit?.location).toBe("B&K Deutschland GmbH, Osnabrück");
    expect(visit?.category).toBe("");
    expect(visit?.works.join(" | ")).not.toContain("B&K");
    expect(visit?.works).toEqual([
      "Priekšējo riteņu balansēšana",
      "Castrol Magnatec Prof. MP 5W-30 LL04",
      "Eļļas filtra komplekts",
      "Salona filtrs (ar aktivēto ogli)",
    ]);
  });

  it("never reads the „Remaining Distance” column as an odometer value", () => {
    const extract = extractDealerReport(BMW_TEXT);
    // „01/05/2025-11185 mi” un „01/05/20256835 mi” ir termiņi, nevis nobraukuma ieraksti.
    expect(extract.mileage.some((r) => r.date === "01.05.2025")).toBe(false);
    expect(extract.mileage.map((r) => r.odometer)).not.toContain("18001");
    expect(extract.mileage.map((r) => r.odometer)).not.toContain("11000");
    // Termiņa datums no tās pašas rindas joprojām tiek nolasīts.
    expect(extract.serviceHistoryNotes).toContain("Motoreļļa — 01.05.2025");
  });

  it("reads the Service History table as serviced components, not as table text", () => {
    const visit = extractDealerReport(BMW_TEXT).serviceHistory.find((e) => e.date === "26.01.2016");
    expect(visit?.odometer).toBe("62375");
    expect(visit?.location).toBe("Autohaus Karl + Co., Mainz-Kastel");
    // Ķeksītis ir tikai motoreļļai un salona filtram; priekšējām bremzēm tā nav.
    expect(visit?.works).toEqual(["Motoreļļa", "Salona filtrs"]);
    expect(visit?.works.join(" ")).not.toContain("Icon");
  });

  it("tulko BMW ETK darbu rindas latviski un izmet Order/numurus", () => {
    const visit = extractDealerReport(BMW_TEXT).serviceHistory.find((e) => e.date === "08.01.2025");
    expect(visit?.odometer).toBe("155000");
    expect(visit?.location).toBe("Niederlassung Bonn BMW AG, Bonn");
    expect(visit?.works).toEqual([
      "BMW stiklu mazgāšanas šķidrums ar pretfrostu",
      "Salona filtrs (ar aktivēto ogli)",
      "Eļļas piemaksa (Service Inclusive)",
      "Service Inclusive pievienošana",
      "Klienta lojalitātes akcija (sk. e-pastu)",
      "Relejs (slēdzošais, balti zaļš)",
      "Oriģinālais BMW AGM akumulators",
      "Izplūdes gāzu radiatora caurule (augsta temperatūra)",
    ]);
    expect(visit?.works.join(" ")).not.toMatch(/Order|83125|cleaning fluid|microfilter/i);
  });

  it("keeps a visit that has no odometer and strips part numbers with quantity", () => {
    const visit = extractDealerReport(BMW_TEXT).serviceHistory.find((e) => e.date === "02.01.2013");
    expect(visit?.odometer).toBe("");
    expect(visit?.location).toBe("Autohaus Karl + Co. GmbH & Co. KG, Rüsselsheim");
    expect(visit?.works).toEqual(["Vējstikla augšējā apdare"]);
  });

  it("summarises only facts into the service history comment", () => {
    const notes = extractDealerReport(BMW_TEXT).serviceHistoryNotes;
    expect(notes).toContain("VIN WBAPX51050CU09550");
    expect(notes).toContain("pirmā reģistrācija 29.07.2008");
    expect(notes).toContain("Bremžu šķidrums — 10.08.2026");
  });

  it("overwrites AutoDNA / CarVertical dealer fields and fills the service table", () => {
    const blocks = createDefaultSourceBlocks();
    const before = emptyOutvinDealerReport();
    before.vehicleInfo.color = "Melns";
    before.vehicleInfo.vinCode = "OLDVIN000000000";
    blocks.auto_records.outvinReport = before;

    const extract = extractDealerReport(BMW_TEXT);
    const actions = buildVendorCopilotActions(extract, "auto_records");
    const { sourceBlocks } = applyCopilotActions(blocks, actions, { onlyAuto: false });
    const report = sourceBlocks.auto_records.outvinReport!;

    expect(report.vehicleInfo.vinCode).toBe("WBAPX51050CU09550");
    expect(report.vehicleInfo.color).toBe("black-sapphire metallic");
    expect(report.equipment.length).toBe(3);

    const works = sourceBlocks.auto_records.serviceWorks;
    const visitRow = works.find((r) => r.date === "23.10.2014" && r.odometer === "120475");
    expect(visitRow?.location).toBe("B&K Deutschland GmbH, Osnabrück");
    expect(visitRow?.works).toContain("Eļļas filtra komplekts");
    expect(visitRow?.works).not.toContain("Osnabrück");
    expect(sourceBlocks.auto_records.serviceHistoryNotes).toContain("Oficiālā dīlera dati");
  });

  it("splits glued auto-records.com equipment columns", () => {
    const extract = extractDealerReport(AUTO_RECORDS_TEXT);
    expect(extract.equipment).toEqual([
      { code: "S0710", description: "M LEATHER STEERING WHEEL" },
      { code: "S0785", description: "WHITE DIRECTION INDICATOR LIGHTS" },
      { code: "S0A07", description: "MYSTIC-BLAU METALLIC" },
    ]);
    expect(extract.accidentCheck).toBe("Nav ierakstu.");
    expect(extract.vehicleInfo.modelSeries).toBe("E46");
    expect(extract.mileage[0]).toEqual({
      date: "16.03.2016",
      odometer: "238563",
      country: "Francija",
    });
  });
});
