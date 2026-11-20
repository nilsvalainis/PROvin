import "server-only";

import { cabinetActorHidesSums } from "@/lib/iriss-logistics-cabinet-access";
import { logisticsCabinetAccessQuery, logisticsCabinetActorId } from "@/lib/iriss-logistics-access";
import type { AutoparksCar, AutoparksFile, AutoparksFileKind, AutoparksListRow, AutoparksRoom, AutoparksWorkItem } from "@/lib/iriss-autoparks";
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

/**
 * Rēķinu/tāmju FAILI: slēpti tikai lomām bez Autoparka rēķinu darba (Loģistika).
 * Serviss strādā ar servisa rēķiniem/tāmēm - faili paliek pieejami (summas laukos maskētas kā līdz šim).
 */
export function autoparksHidesSumFiles(actor: AdminOrStaffActor): boolean {
  const query = logisticsCabinetAccessQuery(actor, "");
  return cabinetActorHidesSums(query) && !query.roles.includes("serviss");
}

export function stripCar<T extends AutoparksCar>(car: T): T {
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

/** Rēķini un tāmes satur summas - Loģistika (`autoparksHidesSumFiles`) tos neredz un nevar lejupielādēt. */
export const AUTOPARKS_SUM_FILE_KINDS: readonly AutoparksFileKind[] = ["invoice", "estimate"];

export function autoparksFileHiddenForActor(file: Pick<AutoparksFile, "kind">, hide: boolean): boolean {
  return hide && AUTOPARKS_SUM_FILE_KINDS.includes(file.kind);
}

export function autoparksRoomForActor(room: AutoparksRoom, hide: boolean, hideSumFiles = false): AutoparksRoom {
  const files = hideSumFiles ? room.files.filter((f) => !autoparksFileHiddenForActor(f, true)) : room.files;
  if (!hide) return files === room.files ? room : { ...room, files };
  return { ...room, car: stripCar(room.car), work: room.work.map(stripWork), files };
}
