/**
 * Pavadzīmes forma (telefons): auto saraksts.
 * Tikai CSDD tirdzniecības reģistrā pieņemtie auto - avots ir `listTradeAcceptedCars`
 * (lib/iriss-autoparks-registry.ts), to pašu lieto ikdienas reģistra sinhronizācija.
 * Atdod tikai drošus laukus - bez cenām un failiem.
 */

import { AUTOPARKS_STATUS_SHORT_LV, type AutoparksCar } from "@/lib/iriss-autoparks";
import { listTradeAcceptedCars } from "@/lib/iriss-autoparks-registry";

export type WaybillTradeCar = {
  id: string;
  brandModel: string;
  vin: string;
  year: string;
  statusLabel: string;
};

const MAX_TRADE_CARS = 200;

function carBrandModel(car: Pick<AutoparksCar, "make" | "model" | "registry">): string {
  const own = `${car.make ?? ""} ${car.model ?? ""}`.replace(/\s+/g, " ").trim();
  if (own) return own.slice(0, 120);
  return (car.registry?.makeModel ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function waybillTradeCars(cars: ReadonlyArray<AutoparksCar>): WaybillTradeCar[] {
  const out: WaybillTradeCar[] = [];
  for (const car of listTradeAcceptedCars(cars)) {
    const brandModel = carBrandModel(car);
    const vin = (car.vin ?? "").trim().toUpperCase();
    if (!brandModel && !vin) continue;
    out.push({
      id: car.id,
      brandModel,
      vin,
      year: (car.year ?? "").trim(),
      statusLabel: AUTOPARKS_STATUS_SHORT_LV[car.status] ?? "",
    });
  }
  const collator = new Intl.Collator("lv", { sensitivity: "base", numeric: true });
  out.sort((a, b) => collator.compare(a.brandModel, b.brandModel) || a.vin.localeCompare(b.vin));
  return out.slice(0, MAX_TRADE_CARS);
}

/** Meklēšana izvēles logā: marka, modelis vai VIN (daļa). */
export function filterWaybillTradeCars(cars: ReadonlyArray<WaybillTradeCar>, query: string): WaybillTradeCar[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...cars];
  return cars.filter((car) => {
    const hay = `${car.brandModel} ${car.vin} ${car.year}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
