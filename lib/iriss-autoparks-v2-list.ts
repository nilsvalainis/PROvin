/**
 * Autoparks v2 saraksts (T1, D1): tikai foto, auto, gads · krāsa, pilns VIN, statuss.
 * 20:17: īpašnieka apzīmējumu (ĪR/DZA) sarakstā nerāda - īpašnieks ir tikai filtrs un kabinetā.
 * Nekādu summu, failu vai piezīmju - sarakstu redz ikviens ar Pamatdatu tiesību.
 */

import { autoparksOwner, type AutoparksCar, type AutoparksOwner, type AutoparksStatus } from "@/lib/iriss-autoparks";
import { AUTOPARKS_V2_STATUS_ORDER, autoparksV2Title, carV2Of, type AutoparksV2State } from "@/lib/iriss-autoparks-v2";

export type AutoparksV2ListRow = {
  id: string;
  title: string;
  year: string;
  color: string;
  vin: string;
  status: AutoparksStatus;
  owner: AutoparksOwner;
  archived: boolean;
  hasPhoto: boolean;
  /** Kārtošanai sadaļas iekšienē (jaunākā statusa maiņa augšā). */
  statusChangedAt: string;
};

export function autoparksV2ListRows(cars: readonly AutoparksCar[], v2: AutoparksV2State): AutoparksV2ListRow[] {
  return cars.map((car) => {
    const carV2 = carV2Of(v2, car.id);
    return {
      id: car.id,
      title: autoparksV2Title(car, carV2),
      year: car.year,
      color: car.color,
      vin: carV2.fields.vin || car.vin,
      status: car.status,
      owner: autoparksOwner(car),
      archived: Boolean(car.archivedAt),
      hasPhoto: Boolean(carV2.mainPhoto?.thumbBlobPath),
      statusChangedAt: car.statusChangedAt || car.updatedAt || car.createdAt,
    };
  });
}

export type AutoparksV2OwnerFilter = "all" | AutoparksOwner | "archive";

export function filterAutoparksV2Rows(
  rows: readonly AutoparksV2ListRow[],
  opts: { owner: AutoparksV2OwnerFilter; status?: AutoparksStatus | null; query?: string },
): AutoparksV2ListRow[] {
  const q = (opts.query ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return rows.filter((r) => {
    if (opts.owner === "archive" ? !r.archived : r.archived) return false;
    if (opts.owner === "IRISS" || opts.owner === "DZA") {
      if (r.owner !== opts.owner) return false;
    }
    if (opts.status && r.status !== opts.status) return false;
    if (!q) return true;
    const hay = `${r.title} ${r.vin}`.toLowerCase();
    return q.split(" ").every((part) => hay.includes(part));
  });
}

export type AutoparksV2Section = { status: AutoparksStatus; rows: AutoparksV2ListRow[] };

/** Sadaļas pēc statusa procesa secībā; tukšās sadaļas izlaiž. */
export function groupAutoparksV2Rows(rows: readonly AutoparksV2ListRow[]): AutoparksV2Section[] {
  return AUTOPARKS_V2_STATUS_ORDER.map((status) => ({
    status,
    rows: rows.filter((r) => r.status === status).sort((a, b) => b.statusChangedAt.localeCompare(a.statusChangedAt)),
  })).filter((s) => s.rows.length > 0);
}

export function autoparksV2OwnerCounts(rows: readonly AutoparksV2ListRow[]): Record<"all" | AutoparksOwner, number> {
  const live = rows.filter((r) => !r.archived);
  return { all: live.length, IRISS: live.filter((r) => r.owner === "IRISS").length, DZA: live.filter((r) => r.owner === "DZA").length };
}

export function autoparksV2StatusCounts(rows: readonly AutoparksV2ListRow[]): Record<AutoparksStatus, number> {
  const out = Object.fromEntries(AUTOPARKS_V2_STATUS_ORDER.map((s) => [s, 0])) as Record<AutoparksStatus, number>;
  for (const r of rows) out[r.status] += 1;
  return out;
}
