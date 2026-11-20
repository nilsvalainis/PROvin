/**
 * Efektīvie Autoparka auto lauki (20.11 pabeigtības audits).
 *
 * Pamatdatu labojumi (VIN, numurzīme, marka/modelis, gads, krāsa, īpašnieks, nobraukums) glabājas tikai v2
 * (`AutoparksCarV2.fields` / `tech.mileageKm`), v1 lauki paliek nemainīti (J29 C dizains). Visas vietas,
 * kas auto attēlo vai saskaņo (CSDD reģistrs, pavadzīmes, PD, publiskā saite, cenu lapa), lasa šo pašu
 * vērtību, ko rāda kabinets (`autoparksV2Basics`): v2 vērtība, ja aizpildīta, citādi v1.
 *
 * SVARĪGI: atgrieztā kopija ir TIKAI lasīšanai - to nedrīkst ierakstīt atpakaļ v1 krātuvē
 * (citādi v2 labojumi kļūtu par v1 datiem bez migrācijas lēmuma).
 */

import { isAutoparksOwner, type AutoparksCar, type AutoparksOwner } from "@/lib/iriss-autoparks";
import type { AutoparksCarV2, AutoparksV2State } from "@/lib/iriss-autoparks-v2";

export type AutoparksV2Overlay = { fields?: Partial<AutoparksCarV2["fields"]>; tech?: Partial<Pick<AutoparksCarV2["tech"], "mileageKm">> };

/** Efektīvais īpašnieks: v2 labotais, citādi v1 (vecajos ierakstos nav -> IRISS). */
export function effectiveAutoparksOwner(car: Pick<AutoparksCar, "owner">, v2?: AutoparksV2Overlay | null): AutoparksOwner {
  const o = v2?.fields?.owner;
  if (isAutoparksOwner(o)) return o;
  return isAutoparksOwner(car.owner) ? car.owner : "IRISS";
}

/** Efektīvais nobraukums - tā pati secība kā `autoparksV2Basics`: ar roku -> CSDD reģistrs -> v1. */
export function effectiveAutoparksMileage(car: Pick<AutoparksCar, "mileageKm" | "registry">, v2?: AutoparksV2Overlay | null): number | null {
  const manual = v2?.tech?.mileageKm;
  if (typeof manual === "number" && Number.isFinite(manual)) return manual;
  const reg = car.registry?.odometerKm;
  if (typeof reg === "number" && Number.isFinite(reg)) return reg;
  return car.mileageKm ?? null;
}

/** Auto kopija ar efektīvajiem pamatdatiem (tikai lasīšanai). Bez v2 - tas pats auto. */
export function effectiveAutoparksCar<T extends AutoparksCar>(car: T, v2?: AutoparksV2Overlay | null): T {
  if (!v2) return car;
  const f = v2.fields ?? {};
  const pick = (key: "vin" | "plate" | "make" | "model" | "year" | "color") => (f[key] ? String(f[key]) : car[key]);
  return {
    ...car,
    vin: pick("vin"),
    plate: pick("plate"),
    make: pick("make"),
    model: pick("model"),
    year: pick("year"),
    color: pick("color"),
    owner: effectiveAutoparksOwner(car, v2),
    mileageKm: effectiveAutoparksMileage(car, v2),
  };
}

/** Saraksts ar efektīvajiem laukiem no v2 stāvokļa (tikai lasīšanai). */
export function effectiveAutoparksCars<T extends AutoparksCar>(cars: ReadonlyArray<T>, v2: Pick<AutoparksV2State, "cars"> | null | undefined): T[] {
  if (!v2?.cars) return [...cars];
  return cars.map((car) => effectiveAutoparksCar(car, v2.cars[car.id]));
}
