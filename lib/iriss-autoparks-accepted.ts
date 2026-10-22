/**
 * Vienīgais avots "auto, kas PAŠLAIK ir pieņemts tirdzniecībā" (CSDD tirdzniecības reģistrs, sinhronizēts ar Autoparku).
 * Lieto Autoparks, pavadzīmju auto izvēle (IrissWaybillCarPicker caur waybill-requests API) un
 * `GET /api/admin/iriss/autoparks/accepted-for-trade`.
 * Atdod tikai drošus laukus - bez cenām, failiem un piezīmēm.
 */

import { AUTOPARKS_STATUS_SHORT_LV, autoparksOwner, type AutoparksCar, type AutoparksOwner } from "@/lib/iriss-autoparks";
import { registryStatusInTrade } from "@/lib/iriss-autoparks-registry";

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

type CarLike = Pick<AutoparksCar, "status" | "archivedAt" | "registry">;

/**
 * Pieņemts tirdzniecībā = ir akta nr. no reģistra, pēdējā nolasījumā nav izņemts, reģistra statuss nav "pārdots/izņemts",
 * Autoparkā nav pārdots un nav arhīvā.
 */
export function isAcceptedForTrade(car: CarLike): boolean {
  if (car.archivedAt) return false;
  if (car.status === "sold") return false;
  const reg = car.registry;
  if (!reg?.tradeActNo?.trim()) return false;
  if (reg.removedAt) return false;
  return registryStatusInTrade(reg.status);
}

function brandModel(car: Pick<AutoparksCar, "make" | "model" | "registry">): string {
  const own = `${car.make ?? ""} ${car.model ?? ""}`.replace(/\s+/g, " ").trim();
  return (own || (car.registry?.makeModel ?? "").replace(/\s+/g, " ").trim()).slice(0, 120);
}

export function listAcceptedForTradeVehicles(
  cars: ReadonlyArray<AutoparksCar>,
  opts: { owner?: AutoparksOwner } = {},
): AcceptedForTradeVehicle[] {
  const out: AcceptedForTradeVehicle[] = [];
  for (const car of cars) {
    if (!isAcceptedForTrade(car)) continue;
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
