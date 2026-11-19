/**
 * Loģistikas auto kabineta atvēršana (IRISS 18.11: «kartītes atvēršanas kļūda bloķē pickup kodu ievadi").
 * Tīra loģika bez React/servera atkarībām, lai to var testēt.
 */

import type { CabinetDocument, CabinetPickup } from "@/lib/iriss-logistics-cabinet";
import type { CabinetAccessView } from "@/lib/iriss-logistics-cabinet-access";

export type CabinetLoadResult =
  | { ok: true; documents: CabinetDocument[]; pickup: CabinetPickup | null; access: CabinetAccessView }
  | { ok: false };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * GET .../cabinet atbilde -> kabineta stāvoklis. Bez `access` (servera kļūda, 401/403, ne-JSON) - neizdevās:
 * lauki paliek bloķēti, bet lietotājs redz kļūdu un «Mēģināt vēlreiz» (agrāk kabinets klusi palika bloķēts).
 */
export function parseCabinetLoad(responseOk: boolean, body: unknown): CabinetLoadResult {
  if (!responseOk || !isObj(body) || !isObj(body.access)) return { ok: false };
  const a = body.access;
  const access: CabinetAccessView = {
    write: a.write === true,
    hideSums: a.hideSums !== false,
    admin: a.admin === true,
    sections: Array.isArray(a.sections) ? (a.sections.filter((s) => s === "A" || s === "B" || s === "C") as CabinetAccessView["sections"]) : [],
  };
  const documents = Array.isArray(body.documents) ? (body.documents as CabinetDocument[]) : [];
  const pickup = isObj(body.pickup) ? (body.pickup as CabinetPickup) : null;
  return { ok: true, documents, pickup, access };
}

/**
 * Pickup koda lauka vērtība: pasūtījuma `pickupRef`, bet, ja tas tukšs, kabineta pickup ieraksta kods
 * (agrāk kods, kas bija tikai kabineta ierakstā, laukā nebija redzams, lai gan Autoparkā rādījās).
 */
export function cabinetPickupCodeValue(orderPickupRef: string | null | undefined, pickup: Pick<CabinetPickup, "pickupCode"> | null): string {
  const own = (orderPickupRef ?? "").trim();
  if (own) return own;
  return (pickup?.pickupCode ?? "").trim();
}

export type LogisticsUrlCarStep = {
  /** Ko darīt ar `?car=` auto: atvērt kabinetu, parādīt kartē vai neko. */
  open: "cabinet" | "map" | null;
  /** Atslēga, kas jau apstrādāta (lai pārējās izmaiņas to neatver atkārtoti). */
  handled: string;
};

/**
 * `?car=<id>` (no Autoparka «Atvērt Loģistikā» / «Kartē») apstrādā vienu reizi katrai saitei.
 * Agrāk tas notika pēc katras `orders` izmaiņas: saglabājot citu auto (piem. pickup kodu), kabinets
 * pārlēca atpakaļ uz saites auto, un «Aizvērt kabinetu» to atvēra no jauna.
 */
export function logisticsUrlCarStep(
  car: string | null | undefined,
  view: string | null | undefined,
  handled: string,
  orderIds: readonly string[],
): LogisticsUrlCarStep {
  const id = (car ?? "").trim();
  if (!id) return { open: null, handled: "" };
  const key = `${id}|${view ?? ""}`;
  if (key === handled) return { open: null, handled };
  // Auto vēl nav sarakstā (piem. ielādējas) - neatzīmējam kā apstrādātu, lai atvērtos, kad parādās.
  if (!orderIds.includes(id)) return { open: null, handled };
  return { open: view === "map" ? "map" : "cabinet", handled: key };
}
