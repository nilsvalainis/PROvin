import "server-only";

import { cabinetActorHidesSums } from "@/lib/iriss-logistics-cabinet-access";
import { logisticsCabinetAccessQuery, logisticsCabinetActorId } from "@/lib/iriss-logistics-access";
import type { AutoparksCar, AutoparksListRow, AutoparksRoom, AutoparksWorkItem } from "@/lib/iriss-autoparks";
import type { AutoparksActor } from "@/lib/iriss-autoparks-store";
import type { AdminOrStaffActor } from "@/lib/staff-auth";

/** Autoparks izmanto Loģistikas kabineta lomas: rakstīt drīkst admins, Loģistika, Serviss; Grāmatvede skatās. */
export function autoparksActor(actor: AdminOrStaffActor): AutoparksActor {
  return {
    id: logisticsCabinetActorId(actor),
    name: actor.kind === "admin" ? actor.name : actor.user.name || actor.user.email,
  };
}

export function autoparksHidesSums(actor: AdminOrStaffActor): boolean {
  return cabinetActorHidesSums(logisticsCabinetAccessQuery(actor, ""));
}

function stripCar<T extends AutoparksCar>(car: T): T {
  const out = { ...car, purchasePriceEur: null, salePriceEur: null };
  if ("listPriceEur" in car) out.listPriceEur = null;
  return out;
}

function stripWork(w: AutoparksWorkItem): AutoparksWorkItem {
  return { ...w, priceEur: null };
}

/** Serviss un Loģistika neredz pirkuma/pārdošanas cenas un tāmes summas. */
export function autoparksRowsForActor(rows: AutoparksListRow[], hide: boolean): AutoparksListRow[] {
  return hide ? rows.map(stripCar) : rows;
}

export function autoparksRoomForActor(room: AutoparksRoom, hide: boolean): AutoparksRoom {
  return hide ? { ...room, car: stripCar(room.car), work: room.work.map(stripWork) } : room;
}
