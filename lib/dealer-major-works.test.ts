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
    ["EN engine replaced", "Engine replaced", "engine"],
    ["EN engine replacement", "Engine replacement", "engine"],
    ["DE Motor erneuert", "Motor erneuert", "engine"],
    ["DE Motorwechsel", "Motorwechsel", "engine"],
    ["LV dzinēja maiņa", "Dzinēja maiņa", "engine"],
    ["RU замена двигателя", "Замена двигателя", "engine"],
    ["RU капитальный ремонт", "Капитальный ремонт двигателя", "engine"],
    ["EN timing chain", "Timing chain kit replaced (Steuerkette)", "timing_chain"],
    ["EN transfer case replaced", "Transfer case replaced", "transfer_case"],
    ["EN differential overhaul", "Differential overhaul", "differential"],
    ["LV reduktora nomaiņa", "Reduktora nomaiņa", "differential"],
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

  it("crankshaft seal + timing belt is significant, but not engine replacement", () => {
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT, "engine")).toBe(false);
    expect(isMajorAssemblyRepairWork(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT, "timing_chain")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(VOLVO_XC90_WARRANTY_SEAL_TIMING_BELT)).toBe(false);
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

  it("the full RAW journal has no Lielie darbi hits", () => {
    for (const row of VOLVO_XC90_RAW_ROWS) {
      expect(hasAnyMajorAssemblyRepair(row.works), row.date).toBe(false);
    }
  });
});
