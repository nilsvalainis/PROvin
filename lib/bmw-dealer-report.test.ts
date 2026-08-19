import { describe, expect, it } from "vitest";
import { applyCopilotActions } from "@/lib/admin-copilot-apply";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { extractDealerReport, looksLikeDealerReport } from "@/lib/dealer-report-extract";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import { buildVendorCopilotActions } from "@/lib/vendor-pdf-agent-merge";
import { KEY_READ_HISTORY_LABEL } from "@/lib/vendor-service-history";

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
27/10/2024278,484 mi / 448,142 km
IconComponentStatusDue DateRemaining Distance
Brake FluidNot due
15/11/2024-

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
20/07/2018321,869 kmB&K Deutschland GmbH, OsnabrückOrder: WAU18099999
Part NamePart NumberQuantity
GEWICHTEFT9999901114
ENTSORGUNG REIFENFT9999000054
FunktionssicherungFTT21
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
    expect(extract.serviceHistoryNotes).toContain("Motoreļļa - 01.05.2025");
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

  it("nenogriež nosaukumu, kad tas VISS AUGŠĒJAIS un satur „F” pirms glāzta detaļas koda", () => {
    // Reāls defekts no BMW 525 atskaites: „ENTSORGUNG REIFEN” + kods „FT9999000054” PDF teksta
    // slānī salīp bez atstarpes; alkatīga regeksa sakritība sākās no „F” vārdā „REIFEN” pašā un
    // nogrieza „ENTSORGUNG REI”. Tāpat īsāki kodi („FTT21”, ne tikai „FTT361”) jāatpazīst pareizi.
    const visit = extractDealerReport(BMW_TEXT).serviceHistory.find((e) => e.date === "20.07.2018");
    expect(visit?.works).toEqual([
      "Balansēšanas atsvari",
      "Riepu utilizācija",
      "Funktionssicherung",
    ]);
  });

  it("summarises only facts into the service history comment", () => {
    const notes = extractDealerReport(BMW_TEXT).serviceHistoryNotes;
    expect(notes).toContain("VIN WBAPX51050CU09550");
    expect(notes).toContain("pirmā reģistrācija 29.07.2008");
    expect(notes).toContain("Bremžu šķidrums - 10.08.2026");
  });

  it("rāda termiņu tendenci pāris jaunāko Key Read nolasījumu, nevis tikai pēdējo", () => {
    // Reāls defekts: BMW 525 atskaitē bija 39 Key Read nolasījumi, bet kopsavilkumā
    // izmantoja tikai pēdējo — visa vēsture tika atmesta.
    const notes = extractDealerReport(BMW_TEXT).serviceHistoryNotes;
    expect(notes).toContain("Key Read History): 2 -");
    expect(notes).toContain("Termiņi (12.05.2026 · 303 938 km): Bremžu šķidrums - 10.08.2026");
    expect(notes).toContain("Termiņi (27.10.2024 · 448 142 km): Bremžu šķidrums - 15.11.2024");
  });

  it("Key Read nolasījumus bez remonta tabulā marķē kā Key Read History", () => {
    // BMW i4: Repair History tukšs, Service History 3 apmeklējumi, Key Read History 10 —
    // iepriekš tabulā palika tikai 3 rindas. Nolasījums ar citu km paliek atsevišķa rinda.
    const history = extractDealerReport(BMW_TEXT).serviceHistory;
    const keyRow = history.find((e) => e.date === "27.10.2024" && e.odometer === "448142");
    expect(keyRow?.works).toEqual([KEY_READ_HISTORY_LABEL]);
    const visitSameDay = history.find((e) => e.date === "12.05.2026" && e.odometer === "303616");
    expect(visitSameDay?.works.join(" ")).not.toMatch(/Atslēgas nolasījums|Key Read History/);
  });

  it("salipušu dīlera nosaukumu Key Read galvenē nolasa; visus nolasījumus atstāj tabulā", () => {
    const text = `BMW i4
MODEL SERIES
G26
Key Read History
27/05/202480,021 kmNiederlassung Bonn BMW AG, Bonn
IconComponentStatusDue DateRemaining Distance
Vehicle checkNot due
01/06/2024-
Brake FluidNot due
01/06/2024-
Hood gas spring checkNot due
01/06/2024-
27/09/202357,954 kmNiederlassung Bonn BMW AG, Bonn
IconComponentStatusDue DateRemaining Distance
Vehicle checkNot due
01/06/2024-
Brake FluidNot due
01/06/2024-
Hood gas spring checkNot due
01/06/2024-
01/04/2025109,110 kmNiederlassung Bonn BMW AG, Bonn
IconComponentStatusDue DateRemaining Distance
Vehicle checkNot due
01/06/2026-
Brake FluidNot due
01/06/2026-
Repair History
24/06/202482,431 kmAutowåx Bil AB, KarlstadOrder: 1
Part NamePart NumberQuantity
Brake FluidFT1
`;
    const extract = extractDealerReport(text);
    expect(extract.mileage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "27.09.2023", odometer: "57954" }),
        expect.objectContaining({ date: "27.05.2024", odometer: "80021" }),
        expect.objectContaining({ date: "01.04.2025", odometer: "109110" }),
      ]),
    );
    const cbsRows = extract.serviceHistory.filter((e) => e.works.includes(KEY_READ_HISTORY_LABEL));
    expect(cbsRows.map((e) => e.date).sort()).toEqual(["01.04.2025", "27.05.2024", "27.09.2023"]);
    const plateau = cbsRows.find((e) => e.date === "27.05.2024");
    expect(plateau?.location).toBe("Niederlassung Bonn BMW AG, Bonn");
    expect(plateau?.works).toEqual([KEY_READ_HISTORY_LABEL]);
    expect(extract.serviceHistory.some((e) => e.date === "01.06.2024")).toBe(false);
  });

  it("neizmet CBS nolasījumu, ja identiski termiņi sakrīt ar vēlāku apkopes vizīti", () => {
    // BMW i4 WBY31AW04NFN09888: Key Read 01.04.2025 un 10.04.2026 abi rāda 01.06.2026;
    // 10.04.2026 ir arī Service History vizīte. Plato „paturēt jaunāko” izmeta abus.
    const text = `BMW i4
MODEL SERIES
G26
Service History
10/04/202683,172 mi / 133,852 kmBilia BMU AB, Nacka, Nacka
IconComponentStatusServicedDue DateRemaining Distance
Brake FluidNot due
✓
01/06/2026-
Vehicle checkNot due
✓
01/06/2026-
24/06/202451,220 mi / 82,431 kmAutowåx Bil AB, Karlstad
IconComponentStatusServicedDue DateRemaining Distance
Brake FluidOverdue
✓
01/06/2024-
Vehicle checkOverdue
✓
01/06/2024-
Key Read History
10/04/202683,172 mi / 133,852 km
IconComponentStatusDue DateRemaining Distance
Vehicle checkNot due
01/06/2026-
Brake FluidNot due01/06/2026-
01/04/202567,798 mi / 109,110 km
IconComponentStatusDue DateRemaining Distance
Vehicle checkNot due
01/06/2026-
Brake FluidNot due01/06/2026-
24/06/202451,220 mi / 82,431 km
IconComponentStatusDue DateRemaining Distance
Vehicle checkOverdue
01/06/2024-
Brake FluidOverdue
01/06/2024-
27/05/202449,723 mi / 80,021 km
IconComponentStatusDue DateRemaining Distance
Vehicle checkDue soon
01/06/2024-
Brake FluidDue soon01/06/2024-
18/06/20224 mi / 6 km
IconComponentStatusDue DateRemaining Distance
Pre Delivery InspectionOverdue
01/06/2022-
Repair History
No repair history found.
`;
    const history = extractDealerReport(text).serviceHistory;
    const cbs = history.filter((e) => e.works.includes(KEY_READ_HISTORY_LABEL));
    expect(history.some((e) => e.date === "10.04.2026" && e.location.includes("Bilia"))).toBe(true);
    expect(history.some((e) => e.date === "10.04.2026" && e.works.includes(KEY_READ_HISTORY_LABEL))).toBe(false);
    expect(cbs.some((e) => e.date === "01.04.2025" && e.odometer === "109110")).toBe(true);
    expect(history.some((e) => e.date === "24.06.2024" && e.location.includes("Autowåx"))).toBe(true);
    expect(history.some((e) => e.date === "24.06.2024" && e.works.includes(KEY_READ_HISTORY_LABEL))).toBe(false);
    expect(cbs.some((e) => e.date === "27.05.2024" && e.odometer === "80021")).toBe(true);
    expect(cbs.some((e) => e.date === "18.06.2022" && e.odometer === "6")).toBe(true);
    expect(cbs.find((e) => e.date === "01.04.2025")?.works).toEqual([KEY_READ_HISTORY_LABEL]);
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
    expect(sourceBlocks.auto_records.serviceHistoryNotes).toBe("");
    expect(actions.some((a) => a.type === "set_service_history")).toBe(false);
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
