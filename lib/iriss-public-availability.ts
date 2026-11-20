import "server-only";

import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { readIrissCarShareByToken } from "@/lib/iriss-car-share-store";
import type { IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

/**
 * Nils 20.11 (audits 2): klienta lapās (`/a/`, `/p/d/`) nekad nerāda iekšējos statusus («Rezervēts», «Noliktavā» u.c.).
 * Kad auto pārdots - tikai neitrāls teksts + Dzintarzeme Auto kontakti, bez detaļām.
 * Statusus cilvēks var nekopt - lēmums balstās tikai uz Autoparka «Pārdots» (arī automātisko arhīvu).
 */

export const IRISS_PUBLIC_CAR_SOLD_TITLE = "Šis auto vairs nav pieejams";
export const IRISS_PUBLIC_PD_NOT_CURRENT_TITLE = "Piedāvājums vairs nav aktuāls";
export const IRISS_PUBLIC_DZA_CONTACT_LINES = ["info@dzintarzemeauto.lv", "+371 20420539", "www.dzintarzemeauto.lv"] as const;
export const IRISS_PUBLIC_SOLD_BODY = "Sazinieties ar Dzintarzeme Auto - piedāvāsim līdzīgu auto.";

/** Pārdots: statuss «Pārdots» vai arhīvs ar iemeslu «sold». */
export function irissCarIsSold(car: { status: string; archivedAt?: string; archiveReason?: string } | null | undefined): boolean {
  if (!car) return false;
  return car.status === "sold" || (Boolean(car.archivedAt) && car.archiveReason === "sold");
}

/**
 * PD klienta saite vairs nav aktuāla: darījums atcelts, vai auto pārdots un šis PD nav apstiprinātais
 * (apstiprinātajam pārdošana = darījums ar šo klientu).
 */
export function irissPdPublicNotCurrent(rec: { status: string }, carSold: boolean): boolean {
  if (rec.status === "cancelled") return true;
  return carSold && rec.status !== "approved";
}

/** Autoparka auto PD avotam: `autoparks:<id>`, citādi pēc pilna VIN. */
export function irissPdMatchCar<C extends { id: string; vin: string }>(
  rec: { sourceRef: string; vehicle: { vin: string } },
  cars: readonly C[],
): C | null {
  const m = rec.sourceRef.match(/^autoparks:([\w-]{1,80})$/);
  if (m) return cars.find((c) => c.id === m[1]) ?? null;
  const vin = rec.vehicle.vin.trim().toUpperCase();
  if (vin.length < 11) return null;
  return cars.find((c) => c.vin.trim().toUpperCase() === vin) ?? null;
}

async function readCars() {
  return (await readAutoparksState().catch(() => null))?.cars ?? [];
}

/** `/a/<token>`: vai saites auto ir pārdots (pēc Autoparka id vai loģistikas pasūtījuma piesaistes). */
export async function irissCarShareTokenSold(token: string): Promise<boolean> {
  const rec = await readIrissCarShareByToken(token).catch(() => null);
  if (!rec) return false;
  const cars = await readCars();
  const car =
    (rec.autoparksCarId ? cars.find((c) => c.id === rec.autoparksCarId) : undefined) ??
    (rec.logisticsOrderId ? cars.find((c) => c.orderId === rec.logisticsOrderId) : undefined);
  return irissCarIsSold(car);
}

/** `/p/d/<token>`: saite vairs nav aktuāla (atcelts vai auto pārdots citam). */
export async function irissPdPublicNotCurrentFor(rec: IrissPiedavajums): Promise<boolean> {
  if (irissPdPublicNotCurrent(rec, false)) return true;
  if (rec.status === "approved") return false;
  return irissPdPublicNotCurrent(rec, irissCarIsSold(irissPdMatchCar(rec, await readCars())));
}
