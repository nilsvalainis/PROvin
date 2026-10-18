import { describe, expect, it } from "vitest";
import {
  dealerMajorAssembliesInWork,
  hasAnyMajorAssemblyRepair,
  hasNonCampaignRepairAction,
  isCheckNoFaultWork,
  isCourtesyCarWork,
  isDealerSoftwareWork,
  isMajorAssemblyRepairWork,
  isRoutineMaintenanceWork,
} from "@/lib/dealer-major-works";
import {
  AUDI_LV_ADBLUE_REDUKTORS,
  BMW_CLUTCH_KIT_TWIN_MASS_PART_LIST,
  BMW_REMAN_GEARBOX_WITH_OIL_LINE,
  BMW_RP_REMAN_TRANSFER_BOX,
  BMW_SCHEIBENKLAR_WASHER,
  BMW_WINDSCREEN_CHIP_CHECK,
  BMW_WINDSCREEN_REPLACED,
  DE_SIDE_WINDOW_ERNEUERT,
  DE_STONE_CHIP_REPAIR,
  DE_WINDSCREEN_ERNEUERT,
  DE_WIPER_BLADES,
  EN_STONE_CHIP_REPAIR,
  EN_WINDOW_GLASS_REPLACED,
  LV_SIDE_WINDOW_REPLACED,
  LV_WINDSCREEN_REPLACED,
  RU_WINDSCREEN_REPLACED,
  BMW_V99966_D15_TWINPOWER_OIL_REPAIR_KIT,
  JEEP_LV_DOOR_TRIM_AND_PROPSHAFT,
  JEEP_LV_DOOR_TRIM_PANEL,
  JEEP_LV_PROPSHAFT_TO_REAR_AXLE,
  JEEP_PROPSHAFT_TRANSFER_CASE_PART_LIST,
  VOLVO_D14_CHARGE_AIR_COOLER_HOSE,
  VOLVO_D4_ENGINE_TURBO_WARRANTY,
} from "@/lib/dealer-major-works.prod-corpus.fixture";
import {
  VOLVO_XC90_CLIMATE_DRAIN_NO_FAULT,
  VOLVO_XC90_HEADER,
  VOLVO_XC90_QB_BLEED_AND_CHARGE_AIR_HOSE,
  VOLVO_XC90_QB_COOLING,
  VOLVO_XC90_QB_FUEL_LINE,
  VOLVO_XC90_RAW_ROWS,
  VOLVO_XC90_SOFTWARE_DOWNLOAD,
  VOLVO_XC90_SUNROOF_DEFLECTOR,
  VOLVO_XC90_SUNROOF_MECHANISM,
  VOLVO_XC90_TJ_BOILERPLATE,
  VOLVO_XC90_TOTAL_UPGRADE,
  VOLVO_XC90_UPHOLSTERY,
  VOLVO_XC90_VCM_UPGRADE,
  VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT,
} from "@/lib/dealer-major-works.volvo-xc90.fixture";

const BMW_RU_ATF =
  "Автоматическая коробка передач: замена масла и фильтра";

describe("dealer major works vs routine maintenance", () => {
  it("BMW RU ATF/filter change is apkope, not gearbox replacement", () => {
    expect(isMajorAssemblyRepairWork(BMW_RU_ATF, "gearbox")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(BMW_RU_ATF)).toBe(false);
    expect(dealerMajorAssembliesInWork(BMW_RU_ATF)).toEqual([]);
    expect(isRoutineMaintenanceWork(BMW_RU_ATF)).toBe(true);
  });

  it.each([
    ["EN transmission oil and filter", "Automatic transmission: oil and filter change"],
    ["EN transmission fluid", "Transmission fluid change"],
    ["EN ATF flush", "ATF flush"],
    ["EN gearbox oil top-up", "Gearbox oil top-up"],
    ["EN transmission service", "Transmission service"],
    ["EN gearbox check", "Gearbox check"],
    ["DE Automatikgetriebe oil", "Automatikgetriebe: Öl- und Filterwechsel"],
    ["DE Getriebeölwechsel", "Getriebeölwechsel"],
    ["DE Getriebe-Service", "Getriebe-Service"],
    ["FR vidange boîte", "Vidange boîte automatique et filtre"],
    ["IT cambio olio", "Cambio olio e filtro del cambio automatico"],
    ["ES aceite caja", "Cambio de aceite de la caja de cambios"],
    ["SE växellådsolja", "Byte av växellådsolja"],
    ["NL bakolie", "Versnellingsbakolie verversen"],
    ["LV kārbas eļļa", "Automātiskās ātrumkārbas eļļas un filtra maiņa"],
    ["LV kārbas eļļa short", "Kārbas eļļas maiņa"],
    ["RU ATF exact", BMW_RU_ATF],
    ["RU масло АКПП", "Замена масла в АКПП и фильтра"],
  ])("gearbox maintenance is not major: %s", (_label, works) => {
    expect(isMajorAssemblyRepairWork(works, "gearbox")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(works)).toBe(false);
  });

  it.each([
    ["EN engine oil service", "Engine oil service"],
    ["EN engine oil and filter", "Engine oil and filter change"],
    ["EN engine inspection", "Engine inspection"],
    ["DE Motorölwechsel", "Motorölwechsel"],
    ["LV dzinēja eļļa", "Dzinēja eļļas maiņa"],
    ["RU масло двигателя", "Замена масла двигателя и фильтра"],
    ["FR vidange moteur", "Vidange moteur et filtre à huile"],
    ["IT olio motore", "Sostituzione olio motore e filtro"],
    ["ES aceite motor", "Cambio de aceite de motor"],
    ["SE oljebyte", "Motoroljebyte och filter"],
    ["NL motorolie", "Motorolie verversen"],
    ["BMW TwinPower oil", "BMW TwinPower Turbo LL-19FE 0W-30"],
  ])("engine maintenance is not major: %s", (_label, works) => {
    expect(isMajorAssemblyRepairWork(works, "engine")).toBe(false);
    expect(isMajorAssemblyRepairWork(works, "turbo")).toBe(false);
  });

  it.each([
    ["EN transfer case oil", "Transfer case oil change"],
    ["DE Verteilergetriebeöl", "Ölwechsel Verteilergetriebe"],
    ["LV sadales kārbas eļļa", "Sadales kārbas eļļas maiņa"],
    ["RU раздатка масло", "Замена масла в раздаточной коробке"],
  ])("transfer case oil is not major: %s", (_label, works) => {
    expect(isMajorAssemblyRepairWork(works, "transfer_case")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(works)).toBe(false);
  });

  it.each([
    ["EN differential oil", "Differential oil change"],
    ["DE Achsölwechsel", "Achsölwechsel"],
    ["DE Differenzialöl", "Differenzialölwechsel"],
    ["LV diferenciāļa eļļa", "Diferenciāļa eļļas maiņa"],
    ["LV reduktora eļļa", "Reduktora eļļas maiņa"],
    ["RU редуктор масло", "Замена масла в редукторе"],
    ["RU дифференциал", "Замена масла в дифференциале"],
  ])("differential / reduktors oil is not major: %s", (_label, works) => {
    expect(isMajorAssemblyRepairWork(works, "differential")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(works)).toBe(false);
  });

  it.each([
    ["EN spark plugs", "Engine spark plugs replacement"],
    ["EN coolant flush", "Engine coolant flush"],
    ["EN brake fluid", "Brake fluid change"],
    ["DE Kühlmittel", "Kühlmittelwechsel Motor"],
    ["LV dzesēšanas", "Dzesēšanas šķidruma maiņa"],
    ["LV sveces", "Aizdedzes sveču maiņa"],
  ])("other consumable service is not major: %s", (_label, works) => {
    expect(hasAnyMajorAssemblyRepair(works)).toBe(false);
  });

  it.each([
    ["EN gearbox replaced", "Gearbox replaced", "gearbox"],
    ["EN transmission replacement", "Automatic transmission replacement", "gearbox"],
    ["DE Getriebe getauscht", "Getriebe getauscht", "gearbox"],
    ["DE Getriebewechsel", "Getriebewechsel", "gearbox"],
    ["DE Getriebe instandgesetzt", "Getriebe instandgesetzt", "gearbox"],
    ["LV ātrumkārbas nomaiņa", "Ātrumkārbas nomaiņa", "gearbox"],
    ["LV pārnesumkārbas kapitālais", "Pārnesumkārbas kapitālais remonts", "gearbox"],
    ["LV transmisijas maiņa", "Automātiskā pārnesumkārba. Automātiskās transmisijas maiņa.", "gearbox"],
    ["LV stikls un bamperis", "Stikla maiņa, priekšējā bampera remonts", "body_glass"],
    ["LV spārna pārkrāsošana", "Kreisā spārna pārkrāsošana", "body_glass"],
    ["RU замена коробки", "Замена коробки передач", "gearbox"],
    ["FR boîte remplacée", "Remplacement de la boîte de vitesses", "gearbox"],
    ["IT cambio sostituito", "Cambio sostituito", "gearbox"],
    ["ES caja sustituida", "Caja de cambios sustituida", "gearbox"],
    ["SE växellåda bytt", "Växellåda bytt", "gearbox"],
    ["NL bak vervangen", "Versnellingsbak vervangen", "gearbox"],
    ["EN engine replaced", "Engine replaced", "engine"],
    ["EN engine replacement", "Engine replacement", "engine"],
    ["DE Motor erneuert", "Motor erneuert", "engine"],
    ["DE Motorwechsel", "Motorwechsel", "engine"],
    ["LV dzinēja maiņa", "Dzinēja maiņa", "engine"],
    ["RU замена двигателя", "Замена двигателя", "engine"],
    ["RU капитальный ремонт", "Капитальный ремонт двигателя", "engine"],
    ["FR moteur remplacé", "Moteur remplacé", "engine"],
    ["IT motore sostituito", "Motore sostituito", "engine"],
    ["ES motor sustituido", "Motor sustituido", "engine"],
    ["EN timing chain", "Timing chain kit replaced (Steuerkette)", "timing_chain"],
    ["FR chaîne distribution", "Chaîne de distribution remplacée", "timing_chain"],
    ["IT catena distribuzione", "Catena di distribuzione sostituita", "timing_chain"],
    ["ES cadena distribución", "Cadena de distribución sustituida", "timing_chain"],
    ["DE Zahnriemen erneuert", "Zahnriemen erneuert", "timing_belt"],
    ["DE Zahnriemen ersetzt", "Zahnriemen ersetzt", "timing_belt"],
    ["DE Zahnriemen gewechselt", "Zahnriemen gewechselt", "timing_belt"],
    ["EN timing belt replace", "Timing belt replace", "timing_belt"],
    ["EN timing belt replacement", "Timing belt replacement", "timing_belt"],
    ["LV zobsiksnas maiņa", "Zobsiksnas maiņa", "timing_belt"],
    ["DE Kurbelwellendichtung", "Kurbelwellendichtung erneuert", "crankshaft_seal"],
    ["EN crankshaft seal", "Crankshaft seal front replace", "crankshaft_seal"],
    ["EN transfer case replaced", "Transfer case replaced", "transfer_case"],
    ["EN differential overhaul", "Differential overhaul", "differential"],
    ["LV tilta reduktora nomaiņa", "Aizmugurējā tilta reduktora nomaiņa", "differential"],
  ] as const)("real unit repair is major: %s", (_label, works, id) => {
    expect(isMajorAssemblyRepairWork(works, id)).toBe(true);
    expect(hasAnyMajorAssemblyRepair(works)).toBe(true);
    expect(isRoutineMaintenanceWork(works)).toBe(false);
  });

  it("mixed visit with real gearbox replacement still counts as major", () => {
    const works = "Gearbox replaced.\nEngine oil and filter change.";
    expect(isMajorAssemblyRepairWork(works, "gearbox")).toBe(true);
    expect(isMajorAssemblyRepairWork(works, "engine")).toBe(false);
  });

  it("does not infer gearbox work from a Transmission MANUAL header", () => {
    expect(hasAnyMajorAssemblyRepair("Transmission MANUAL")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(`${VOLVO_XC90_HEADER}\nEngine oil service`)).toBe(false);
  });

  it("Getriebeölverlust / TwinPower oil / inspect transmission are not major", () => {
    expect(hasAnyMajorAssemblyRepair("Automatikgetriebe. Getriebeölverlust diagnostiziert.")).toBe(false);
    expect(isMajorAssemblyRepairWork("BMW TwinPower Turbo LL-19FE 0W-30 (83215A65BF8)", "turbo")).toBe(false);
    expect(isRoutineMaintenanceWork("BMW TwinPower Turbo LL-19FE 0W-30 (83215A65BF8)")).toBe(true);
    expect(hasAnyMajorAssemblyRepair("Engine oil and filter change. Inspect transmission.")).toBe(false);
    expect(hasAnyMajorAssemblyRepair("Charge air cooler hose replacement.")).toBe(false);
    expect(hasAnyMajorAssemblyRepair("Turbocharger")).toBe(false);
    expect(hasAnyMajorAssemblyRepair("Timing chain")).toBe(false);
  });
});

describe("Volvo XC90 RAW dealer journal (YV1LCA4BCG1067242)", () => {
  it("QB cooling kit is a campaign, not a cooling-system / engine replacement", () => {
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_QB_COOLING)).toBe(false);
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_QB_COOLING, "engine")).toBe(false);
  });

  it("QB fuel line replace is a campaign, not a major assembly", () => {
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_QB_FUEL_LINE)).toBe(false);
  });

  it("charge-air hose replace is a real minor repair, not engine replacement", () => {
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_QB_BLEED_AND_CHARGE_AIR_HOSE, "engine")).toBe(false);
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_QB_BLEED_AND_CHARGE_AIR_HOSE, "turbo")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_QB_BLEED_AND_CHARGE_AIR_HOSE)).toBe(false);
    expect(hasNonCampaignRepairAction(VOLVO_XC90_QB_BLEED_AND_CHARGE_AIR_HOSE)).toBe(true);
  });

  it("crankshaft seal + timing belt is Lielie darbi, not an engine swap", () => {
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT, "engine")).toBe(false);
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT, "timing_chain")).toBe(false);
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT, "timing_belt")).toBe(true);
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT, "crankshaft_seal")).toBe(true);
    expect(dealerMajorAssembliesInWork(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT)).toEqual([
      "timing_belt",
      "crankshaft_seal",
    ]);
    expect(isCourtesyCarWork(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT)).toBe(true);
  });

  it("software downloads and module upgrades are not major works", () => {
    expect(isDealerSoftwareWork(VOLVO_XC90_SOFTWARE_DOWNLOAD)).toBe(true);
    expect(isDealerSoftwareWork(VOLVO_XC90_TOTAL_UPGRADE)).toBe(true);
    expect(isDealerSoftwareWork(VOLVO_XC90_VCM_UPGRADE)).toBe(true);
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_SOFTWARE_DOWNLOAD)).toBe(false);
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_TOTAL_UPGRADE)).toBe(false);
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_VCM_UPGRADE)).toBe(false);
  });

  it("sunroof and upholstery are body/comfort, not drivetrain", () => {
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_SUNROOF_DEFLECTOR)).toBe(false);
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_SUNROOF_MECHANISM, "engine")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_SUNROOF_MECHANISM)).toBe(false);
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_UPHOLSTERY)).toBe(false);
  });

  it("climate drain Ohne Befund is a check, not a repair", () => {
    expect(isCheckNoFaultWork(VOLVO_XC90_CLIMATE_DRAIN_NO_FAULT)).toBe(true);
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_CLIMATE_DRAIN_NO_FAULT)).toBe(false);
  });

  it("repeated TJ boilerplate does not invent a major assembly event", () => {
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_TJ_BOILERPLATE)).toBe(false);
    expect(dealerMajorAssembliesInWork(VOLVO_XC90_TJ_BOILERPLATE + "\n" + VOLVO_XC90_TJ_BOILERPLATE)).toEqual(
      [],
    );
  });

  it("the full RAW journal only lists 20.02.2018 belt and crankshaft seal", () => {
    const withMajor = VOLVO_XC90_RAW_ROWS.filter((row) => hasAnyMajorAssemblyRepair(row.works));
    expect(withMajor.map((row) => row.date)).toEqual(["20.02.2018"]);
  });
});

describe("production corpus regressions (anonymized)", () => {
  it("1 BMW REMAN 6 Gang Getriebe is gearbox even with an oil line on the same visit", () => {
    expect(isMajorAssemblyRepairWork(BMW_REMAN_GEARBOX_WITH_OIL_LINE, "gearbox")).toBe(true);
    expect(isMajorAssemblyRepairWork(BMW_REMAN_GEARBOX_WITH_OIL_LINE, "engine")).toBe(false);
    expect(dealerMajorAssembliesInWork(BMW_REMAN_GEARBOX_WITH_OIL_LINE)).toEqual(["gearbox"]);
    expect(isRoutineMaintenanceWork(BMW_REMAN_GEARBOX_WITH_OIL_LINE)).toBe(false);
  });

  it("2 BMW clutch kit + Twin Mass Flywheel part list is clutch and DMF", () => {
    expect(isMajorAssemblyRepairWork(BMW_CLUTCH_KIT_TWIN_MASS_PART_LIST, "clutch")).toBe(true);
    expect(isMajorAssemblyRepairWork(BMW_CLUTCH_KIT_TWIN_MASS_PART_LIST, "dual_mass_flywheel")).toBe(
      true,
    );
    expect(dealerMajorAssembliesInWork(BMW_CLUTCH_KIT_TWIN_MASS_PART_LIST)).toEqual([
      "clutch",
      "dual_mass_flywheel",
    ]);
  });

  it("3 BMW RP REMAN Transfer box is transfer case replacement", () => {
    expect(isMajorAssemblyRepairWork(BMW_RP_REMAN_TRANSFER_BOX, "transfer_case")).toBe(true);
    expect(dealerMajorAssembliesInWork(BMW_RP_REMAN_TRANSFER_BOX)).toEqual(["transfer_case"]);
  });

  it("4 Volvo D4 warranty engine + turbo replacement", () => {
    const works = VOLVO_D4_ENGINE_TURBO_WARRANTY.works;
    expect(isMajorAssemblyRepairWork(works, "engine")).toBe(true);
    expect(isMajorAssemblyRepairWork(works, "turbo")).toBe(true);
    expect(dealerMajorAssembliesInWork(works)).toEqual(["engine", "turbo"]);
  });

  it("5 Jeep propshaft + transfer case part list", () => {
    expect(isMajorAssemblyRepairWork(JEEP_PROPSHAFT_TRANSFER_CASE_PART_LIST, "propshaft")).toBe(true);
    expect(isMajorAssemblyRepairWork(JEEP_PROPSHAFT_TRANSFER_CASE_PART_LIST, "transfer_case")).toBe(
      true,
    );
    expect(isMajorAssemblyRepairWork(JEEP_PROPSHAFT_TRANSFER_CASE_PART_LIST, "gearbox")).toBe(false);
    expect(dealerMajorAssembliesInWork(JEEP_PROPSHAFT_TRANSFER_CASE_PART_LIST)).toEqual([
      "transfer_case",
      "propshaft",
    ]);
  });

  it("6 BMW TwinPower Turbo oil + brake Repair kit is not turbo", () => {
    const works = BMW_V99966_D15_TWINPOWER_OIL_REPAIR_KIT.works;
    expect(isMajorAssemblyRepairWork(works, "turbo")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(works)).toBe(false);
    expect(isRoutineMaintenanceWork(works)).toBe(true);
  });

  it("7 Volvo charge air cooler hose is minor, not turbo", () => {
    expect(isMajorAssemblyRepairWork(VOLVO_D14_CHARGE_AIR_COOLER_HOSE, "turbo")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(VOLVO_D14_CHARGE_AIR_COOLER_HOSE)).toBe(false);
  });

  it("8 Audi AdBlue reduktors is not a differential", () => {
    expect(isMajorAssemblyRepairWork(AUDI_LV_ADBLUE_REDUKTORS, "differential")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(AUDI_LV_ADBLUE_REDUKTORS)).toBe(false);
    expect(isMajorAssemblyRepairWork("Reduktora nomaiņa", "differential")).toBe(false);
    expect(isMajorAssemblyRepairWork("Aizmugurējā tilta reduktora nomaiņa", "differential")).toBe(
      true,
    );
  });

  it("9 Jeep door trim is not body/glass; transmission to rear axle is Kardāns", () => {
    expect(isMajorAssemblyRepairWork(JEEP_LV_DOOR_TRIM_PANEL, "body_glass")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(JEEP_LV_DOOR_TRIM_PANEL)).toBe(false);
    expect(isMajorAssemblyRepairWork(JEEP_LV_PROPSHAFT_TO_REAR_AXLE, "gearbox")).toBe(false);
    expect(isMajorAssemblyRepairWork(JEEP_LV_PROPSHAFT_TO_REAR_AXLE, "propshaft")).toBe(true);
    expect(isMajorAssemblyRepairWork(JEEP_LV_DOOR_TRIM_AND_PROPSHAFT, "body_glass")).toBe(false);
    expect(isMajorAssemblyRepairWork(JEEP_LV_DOOR_TRIM_AND_PROPSHAFT, "gearbox")).toBe(false);
    expect(dealerMajorAssembliesInWork(JEEP_LV_DOOR_TRIM_AND_PROPSHAFT)).toEqual(["propshaft"]);
  });

  it("Scheibenklar washer fluid is never body/glass", () => {
    expect(isMajorAssemblyRepairWork(BMW_SCHEIBENKLAR_WASHER, "body_glass")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(BMW_SCHEIBENKLAR_WASHER)).toBe(false);
  });
});

describe("windscreen and window glass replacement stays in Lielie darbi", () => {
  it.each([
    ["EN windscreen part list", BMW_WINDSCREEN_REPLACED],
    ["DE Windschutzscheibe erneuert", DE_WINDSCREEN_ERNEUERT],
    ["LV vējstikla maiņa", LV_WINDSCREEN_REPLACED],
    ["LV durvju stikla maiņa", LV_SIDE_WINDOW_REPLACED],
    ["DE Seitenscheibe ersetzt", DE_SIDE_WINDOW_ERNEUERT],
    ["EN side window glass", EN_WINDOW_GLASS_REPLACED],
    ["RU лобовое стекло", RU_WINDSCREEN_REPLACED],
  ])("real glass replacement is major: %s", (_label, works) => {
    expect(isMajorAssemblyRepairWork(works, "body_glass")).toBe(true);
    expect(dealerMajorAssembliesInWork(works)).toEqual(["body_glass"]);
    expect(isRoutineMaintenanceWork(works)).toBe(false);
  });

  it.each([
    ["washer Scheibenklar", BMW_SCHEIBENKLAR_WASHER],
    ["door trim", JEEP_LV_DOOR_TRIM_PANEL],
    ["chip check", BMW_WINDSCREEN_CHIP_CHECK],
    ["DE Steinschlagreparatur", DE_STONE_CHIP_REPAIR],
    ["EN stone chip repair", EN_STONE_CHIP_REPAIR],
    ["wiper blades", DE_WIPER_BLADES],
  ])("not glass replacement: %s", (_label, works) => {
    expect(isMajorAssemblyRepairWork(works, "body_glass")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(works)).toBe(false);
  });
});

