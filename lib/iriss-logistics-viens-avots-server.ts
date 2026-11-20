import "server-only";

import { effectiveAutoparksCars } from "@/lib/iriss-autoparks-effective";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { autoparksV2Basics, carV2Of } from "@/lib/iriss-autoparks-v2";
import { autoparksV2Perms } from "@/lib/iriss-autoparks-v2-access";
import { readAutoparksV2State, updateCarV2 } from "@/lib/iriss-autoparks-v2-store";
import {
  applySharedCarPatchToV2,
  LOGISTICS_SHARED_CAR_FIELDS,
  linkedCarForOrder,
  overlayOrderWithCar,
  type LinkedCarFields,
  type LogisticsOrderView,
  type SharedCarPatch,
  type SharedCarPatchError,
  sharedCarPatchIsEmpty,
  splitSharedCarPatch,
} from "@/lib/iriss-logistics-viens-avots";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";
import type { AdminOrStaffActor } from "@/lib/staff-auth";
import { ENV_ADMIN_USER_ID } from "@/lib/staff-roles";

type OrderKey = Pick<LogisticsOrder, "id" | "vin">;
type OverlayOrder = Pick<LogisticsOrder, "id" | "vin" | "make" | "model" | "title" | "mileageKm">;

/** Kopējos laukus Loģistikā drīkst labot tikai ar Autoparka «Pamatdati» tiesību (admins vienmēr). */
export function logisticsCanEditCarFields(actor: AdminOrStaffActor): boolean {
  return autoparksV2Perms(actor).pamatdati;
}

/** Vienreiz nolasa Autoparku (v1 + v2) un atgriež meklētāju: Loģistikas ieraksts -> Autoparka auto lauki. */
export async function loadLinkedCarLookup(): Promise<(order: OrderKey) => LinkedCarFields | undefined> {
  const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
  return (order) => {
    // Saskaņo pēc efektīvā VIN (Pamatdatos labotais), lauki - no `autoparksV2Basics`.
    const car = linkedCarForOrder(effectiveAutoparksCars(v1.cars, v2), order);
    if (!car) return undefined;
    const b = autoparksV2Basics(car, carV2Of(v2, car.id));
    return { id: car.id, vin: b.vin, make: b.make, model: b.model, year: b.year, color: b.color, mileageKm: b.mileageKm.value };
  };
}

/**
 * Loģistikas ieraksti ar kopējiem laukiem no Autoparka. Ja Autoparku neizdodas nolasīt - vecie Loģistikas lauki
 * (saraksts nedrīkst salūzt). Summu maskēšanu (`maskOrderSums`) izsaucējs dara atsevišķi.
 */
export async function overlayOrdersForActor<O extends OverlayOrder>(
  orders: readonly O[],
  actor: AdminOrStaffActor | null,
): Promise<Array<LogisticsOrderView<O>>> {
  if (orders.length === 0) return [];
  const lookup = await loadLinkedCarLookup().catch((e) => {
    console.error("[iriss-logistics] viens avots: autoparks", e instanceof Error ? e.message : e);
    return null;
  });
  if (!lookup) return [...orders];
  const readOnly = !actor || !logisticsCanEditCarFields(actor);
  return orders.map((o) => overlayOrderWithCar(o, lookup(o), readOnly));
}

/** Bez lietotāja (šofera maršruta saite, kravu saraksts): tikai lasīšanai. */
export function overlayOrdersReadOnly<O extends OverlayOrder>(orders: readonly O[]): Promise<Array<LogisticsOrderView<O>>> {
  return overlayOrdersForActor(orders, null);
}

export async function overlayOrderForActor<O extends OverlayOrder>(order: O, actor: AdminOrStaffActor): Promise<LogisticsOrderView<O>> {
  return (await overlayOrdersForActor([order], actor))[0]!;
}

/** Labojums no Loģistikas raksta Autoparka auto (v2 pārraksti, kā Pamatdati), nevis Loģistikas ierakstu. */
export async function writeSharedCarPatch(
  car: LinkedCarFields,
  shared: SharedCarPatch,
  actor: AdminOrStaffActor,
): Promise<{ ok: true } | { ok: false; error: SharedCarPatchError }> {
  const who =
    actor.kind === "admin"
      ? { id: ENV_ADMIN_USER_ID, name: actor.name }
      : { id: actor.user.id, name: actor.user.name || actor.user.email };
  return updateCarV2<{ ok: true } | { ok: false; error: SharedCarPatchError }>(
    car.id,
    (c) => {
      const out = applySharedCarPatchToV2(c, car, shared);
      if (!out.ok) return { result: out, write: false };
      return { result: { ok: true as const }, history: out.history };
    },
    { id: who.id, name: `${who.name} (Loģistika)` },
  );
}

export type SharedCarRouteResult =
  | { ok: true; rest: Record<string, unknown> }
  | { ok: false; status: 400 | 403 | 503; error: SharedCarPatchError | "car_fields_read_only" | "autoparks_unavailable" };

/**
 * Loģistikas labojums esošam ierakstam: ja ir saistīts Autoparka auto, mainītie kopējie lauki tiek rakstīti
 * Autoparkā (ar «Pamatdati» tiesību; citādi 403), un Loģistikas ierakstam paliek tikai transporta dati.
 * Bez saistīta auto - labojums nemainīts (kā līdz šim).
 */
export async function routeSharedCarFields(
  existing: LogisticsOrder,
  patch: Record<string, unknown>,
  actor: AdminOrStaffActor,
): Promise<SharedCarRouteResult> {
  const lookup = await loadLinkedCarLookup().catch((e) => {
    console.error("[iriss-logistics] viens avots: autoparks", e instanceof Error ? e.message : e);
    return null;
  });
  if (!lookup) {
    // Autoparks nav nolasāms: transporta labojumi iet kā līdz šim, auto laukus nerakstām (lai nerodas divi avoti).
    const touchesCar = ["title", ...LOGISTICS_SHARED_CAR_FIELDS].some((k) => Object.prototype.hasOwnProperty.call(patch, k));
    return touchesCar ? { ok: false, status: 503, error: "autoparks_unavailable" } : { ok: true, rest: patch };
  }
  const car = lookup(existing);
  if (!car) return { ok: true, rest: patch };
  const { shared, rest } = splitSharedCarPatch(patch, overlayOrderWithCar(existing, car, false));
  if (sharedCarPatchIsEmpty(shared)) return { ok: true, rest };
  if (!logisticsCanEditCarFields(actor)) return { ok: false, status: 403, error: "car_fields_read_only" };
  const written = await writeSharedCarPatch(car, shared, actor);
  if (!written.ok) return { ok: false, status: 400, error: written.error };
  return { ok: true, rest };
}

export function sharedCarRouteErrorBody(r: Extract<SharedCarRouteResult, { ok: false }>): { error: string; message?: string } {
  if (r.error === "car_fields_read_only") return { error: r.error, message: "Auto pamatdatus labo Autoparkā (vajag tiesību «Pamatdati»)." };
  if (r.error === "autoparks_unavailable") return { error: r.error, message: "Autoparks šobrīd nav pieejams - mēģiniet vēlreiz." };
  return { error: r.error };
}
