/**
 * Formas filtra projekcija uz esošo eCarsTrade meklēšanas filtru.
 * Pašreizējo trāpījumu salīdzināšanu šī funkcija neizsauc.
 * Krāsa netiek ielikta.
 */

import { resolveEcarstradeMake } from "@/lib/iriss-listings-ecarstrade-catalog";
import type { UnmappedCriterion } from "@/lib/iriss-listings-ecarstrade-criteria";
import {
  ECARSTRADE_BODY,
  ECARSTRADE_FUEL,
  ECARSTRADE_GEARBOX,
  type EcarstradeSearchFilter,
} from "@/lib/iriss-listings-ecarstrade-search";
import type { IrissCriteriaFilter, IrissFuelChoice, IrissGearboxChoice } from "@/lib/iriss-criteria-types";
import type { BodyGroup } from "@/lib/iriss-criteria-taxonomy";

function uniq(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const t = value.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function fuelToken(choice: IrissFuelChoice, unmapped: UnmappedCriterion[]): string[] {
  if (choice.group === "petrol") return [ECARSTRADE_FUEL.petrol];
  if (choice.group === "diesel") return [ECARSTRADE_FUEL.diesel];
  if (choice.group === "hybrid") {
    return [choice.sub === "diesel_hybrid" ? ECARSTRADE_FUEL.hybridDiesel : ECARSTRADE_FUEL.hybridPetrol];
  }
  if (choice.group === "electric") {
    if (choice.sub === "erev") {
      unmapped.push({ key: "fuel", value: "erev", reason: "ET Electric. EREV nav atsevišķs ET kods." });
    }
    return [ECARSTRADE_FUEL.electric];
  }
  if (choice.group === "gas") {
    if (choice.sub === "lpg") return [ECARSTRADE_FUEL.lpg];
    if (choice.sub === "cng") return [ECARSTRADE_FUEL.gas];
    unmapped.push({ key: "fuel", value: choice.sub ?? "gas", reason: "Gāze bez viena apakštipa: ET LPG un Natural Gas." });
    return [ECARSTRADE_FUEL.lpg, ECARSTRADE_FUEL.gas];
  }
  unmapped.push({ key: "fuel", value: choice.group, reason: "ET meklēšanā nav šīs degvielas grupas." });
  return [];
}

function gearboxToken(choice: IrissGearboxChoice): string {
  if (choice.group === "manual") return ECARSTRADE_GEARBOX.manual;
  if (choice.sub === "amt") return ECARSTRADE_GEARBOX.semi;
  return ECARSTRADE_GEARBOX.automatic;
}

function bodyToken(group: BodyGroup, unmapped: UnmappedCriterion[]): string {
  if (group === "sedan") return ECARSTRADE_BODY.saloon;
  if (group === "wagon") return ECARSTRADE_BODY.estate;
  if (group === "hatchback") return ECARSTRADE_BODY.small;
  if (group === "coupe") return ECARSTRADE_BODY.coupe;
  if (group === "cabrio") return ECARSTRADE_BODY.convertible;
  if (group === "mpv" || group === "van_bus") return ECARSTRADE_BODY.van;
  if (group === "pickup") {
    unmapped.push({ key: "body", value: "pickup", reason: "ET SUV kods ietver pickup. Atsevišķa pickup vērtība nav." });
  }
  return ECARSTRADE_BODY.suv;
}

function pushNote(unmapped: UnmappedCriterion[], key: string, value: string, reason: string): void {
  if (!value.trim()) return;
  unmapped.push({ key, value: value.slice(0, 180), reason });
}

/** Strukturētie formas lauki. Manuālais teksts un saites paliek ārpus šī filtra. */
export function filterToSearchFilter(filter: IrissCriteriaFilter): EcarstradeSearchFilter {
  const unmapped: UnmappedCriterion[] = [];
  const makeNames = uniq(filter.make.value);
  const makeIds: number[] = [];
  for (const name of makeNames) {
    const mark = resolveEcarstradeMake(name);
    if (mark && !makeIds.includes(mark.id)) makeIds.push(mark.id);
  }
  const models = uniq(filter.models.value);
  const modelName = models.length === 1 ? models[0]! : "";
  if (models.length > 1) {
    pushNote(unmapped, "models", models.join(", "), "Vairāki modeļi. ET modelName ņem tikai vienu, tāpēc šeit tas paliek tukšs.");
  }

  const fuels = uniq(filter.fuel.value.flatMap((choice) => fuelToken(choice, unmapped)));
  const gearboxes = uniq(filter.gearbox.value.map((choice) => gearboxToken(choice)));
  const bodies = uniq(filter.bodyTypes.value.map((group) => bodyToken(group, unmapped)));

  pushNote(unmapped, "priceBasis", filter.priceBasis.value ?? "", "Cenas bāze gross vai net nav ET cenas lauks.");
  pushNote(unmapped, "equipmentDesired", filter.equipmentDesired.value.join(", "), "Vēlamais aprīkojums nav obligāts ET filtrs.");
  pushNote(unmapped, "maxDamage", filter.maxDamage.value ?? "", "Bojājumu griesti nav ET URL parametrs.");
  pushNote(unmapped, "countries", filter.countries.value.join(", "), "Valstis šajā projekcijā paliek piezīme.");
  pushNote(unmapped, "manual", filter.fuel.manual, "Degvielas manuālais teksts nav otrreiz parsēts.");

  return {
    makeIds,
    makeNames,
    modelId: null,
    modelIds: [],
    modelName,
    yearFrom: filter.yearFrom.value,
    yearTo: filter.yearTo.value,
    mileageFrom: filter.mileageFrom.value,
    mileageTo: filter.mileageTo.value,
    priceFrom: filter.budgetFrom.value,
    priceTo: filter.budgetTo.value,
    powerFromKw: filter.kwFrom.value,
    powerToKw: filter.kwTo.value,
    fuels,
    gearboxes,
    bodies,
    colors: [],
    engineFromCc: filter.ccFrom.value,
    engineToCc: filter.ccTo.value,
    doorsFrom: filter.doorsFrom.value,
    doorsTo: null,
    seatsFrom: filter.seatsFrom.value,
    seatsTo: null,
    vat: filter.vatRequired.value === true ? ["reclaimable"] : filter.vatRequired.value === false ? ["not_reclaimable"] : [],
    emissionFrom: filter.emissionMin.value ?? "",
    drives: [...filter.drive.value],
    includeTokens: [],
    excludeTokens: uniq(filter.excludeModels.value),
    excludeColors: [],
    modelExtensions: [],
    unmapped,
  };
}
