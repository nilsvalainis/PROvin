/**
 * `GET /api/admin/iriss/autoparks/accepted-for-trade` saraksts: drošie lauki (bez cenām, failiem, piezīmēm)
 * auto, kas PAŠLAIK ir pieņemti tirdzniecībā. Filtrs NAV dublēts - tikai `listTradeAcceptedCars`
 * (lib/iriss-autoparks-registry.ts), to pašu lieto pavadzīmju auto saraksts.
 */

import { AUTOPARKS_STATUS_SHORT_LV, autoparksOwner, type AutoparksCar, type AutoparksOwner } from "@/lib/iriss-autoparks";
import { listTradeAcceptedCars } from "@/lib/iriss-autoparks-registry";

export type AcceptedForTradeVehicle = {
  id: string;
  owner: AutoparksOwner;
  brandModel: string;
  vin: string;
  year: string;
  plate: string;
  tradeActNo: string;
  tradeActDate: string;
  /** Autoparka statusa īsais nosaukums (piem. "Pārdošanā"). */
  statusLabel: string;
};

export const MAX_ACCEPTED_FOR_TRADE = 500;

function brandModel(car: Pick<AutoparksCar, "make" | "model" | "registry">): string {
  const own = `${car.make ?? ""} ${car.model ?? ""}`.replace(/\s+/g, " ").trim();
  return (own || (car.registry?.makeModel ?? "").replace(/\s+/g, " ").trim()).slice(0, 120);
}

export function listAcceptedForTradeVehicles(
  cars: ReadonlyArray<AutoparksCar>,
  opts: { owner?: AutoparksOwner } = {},
): AcceptedForTradeVehicle[] {
  const out: AcceptedForTradeVehicle[] = [];
  for (const car of listTradeAcceptedCars(cars)) {
    const owner = autoparksOwner(car);
    if (opts.owner && owner !== opts.owner) continue;
    const bm = brandModel(car);
    const vin = (car.vin ?? "").trim().toUpperCase();
    if (!bm && !vin) continue;
    out.push({
      id: car.id,
      owner,
      brandModel: bm,
      vin,
      year: (car.year ?? "").trim(),
      plate: (car.plate ?? "").trim(),
      tradeActNo: car.registry?.tradeActNo ?? "",
      tradeActDate: car.registry?.tradeActDate ?? "",
      statusLabel: AUTOPARKS_STATUS_SHORT_LV[car.status] ?? "",
    });
  }
  const collator = new Intl.Collator("lv", { sensitivity: "base", numeric: true });
  out.sort((a, b) => collator.compare(a.brandModel, b.brandModel) || a.vin.localeCompare(b.vin));
  return out.slice(0, MAX_ACCEPTED_FOR_TRADE);
}
