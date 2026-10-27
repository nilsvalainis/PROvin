/**
 * Autoparks v2 saraksts (T1, D1): tikai foto, auto, gads · krāsa, pilns VIN, statuss.
 * 20:17: īpašnieka apzīmējumu (ĪR/DZA) sarakstā nerāda - īpašnieks ir tikai filtrs un kabinetā.
 * Nekādu summu, failu vai piezīmju - sarakstu redz ikviens ar kādu Autoparka kabineta tiesību (j69).
 * Izņēmums (Nils 27.10, kārtošana): iegādes summa rindā ir TIKAI ar tiesību «summas» (serveris to citādi nesūta).
 */

import { autoparksOwner, type AutoparksCar, type AutoparksOwner, type AutoparksStatus } from "@/lib/iriss-autoparks";
import { AUTOPARKS_V2_STATUS_ORDER, autoparksV2Title, carV2Of, type AutoparksV2State, type V2VatMode } from "@/lib/iriss-autoparks-v2";

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
  /** Kārtošanai «Marka A-Z». */
  make: string;
  /** Iegādes datums YYYY-MM-DD (tukšs, ja nav ievadīts). */
  purchaseDate: string;
  /** Iegādes summa; null - nav ievadīta VAI lietotājam nav tiesības «summas». */
  purchasePriceEur: number | null;
  /** Nils 27.10: PVN / Margin / Neto kolonna (tukšs - nav zināms vai nav tiesības «Iegāde»). */
  vatMode: V2VatMode;
};

/** Kārtošana (Nils 27.10): process (noklusējums), marka, iegādes datums, iegādes summa. */
export const AUTOPARKS_V2_SORTS = ["process", "make", "date_desc", "date_asc", "sum_desc", "sum_asc"] as const;
export type AutoparksV2Sort = (typeof AUTOPARKS_V2_SORTS)[number];
export const AUTOPARKS_V2_SORT_LV: Record<AutoparksV2Sort, string> = {
  process: "Pēc statusa",
  make: "Marka A-Z",
  date_desc: "Iegāde: jaunākie",
  date_asc: "Iegāde: vecākie",
  sum_desc: "Summa: lielākā",
  sum_asc: "Summa: mazākā",
};

/** Bez datuma / summas vienmēr saraksta beigās; vienādiem - marka A-Z. */
export function sortAutoparksV2Rows(rows: readonly AutoparksV2ListRow[], sort: AutoparksV2Sort): AutoparksV2ListRow[] {
  if (sort === "process") return [...rows];
  const byMake = (a: AutoparksV2ListRow, b: AutoparksV2ListRow) =>
    (a.make || a.title).localeCompare(b.make || b.title, "lv", { sensitivity: "base" }) || a.title.localeCompare(b.title, "lv");
  const out = [...rows];
  if (sort === "make") return out.sort(byMake);
  if (sort === "date_desc" || sort === "date_asc") {
    const dir = sort === "date_desc" ? -1 : 1;
    return out.sort((a, b) => {
      if (!a.purchaseDate !== !b.purchaseDate) return a.purchaseDate ? -1 : 1;
      return (a.purchaseDate.localeCompare(b.purchaseDate) * dir) || byMake(a, b);
    });
  }
  const dir = sort === "sum_desc" ? -1 : 1;
  return out.sort((a, b) => {
    if ((a.purchasePriceEur == null) !== (b.purchasePriceEur == null)) return a.purchasePriceEur == null ? 1 : -1;
    return ((a.purchasePriceEur ?? 0) - (b.purchasePriceEur ?? 0)) * dir || byMake(a, b);
  });
}

export function autoparksV2ListRows(
  cars: readonly AutoparksCar[],
  v2: AutoparksV2State,
  opts: { sums?: boolean; vat?: boolean } = {},
): AutoparksV2ListRow[] {
  return cars.map((car) => {
    const carV2 = carV2Of(v2, car.id);
    const price = carV2.purchase.purchasePriceEur ?? car.purchasePriceEur;
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
      make: (carV2.fields.make || car.make || "").trim(),
      purchaseDate: carV2.purchase.purchaseDate || "",
      purchasePriceEur: opts.sums && typeof price === "number" && Number.isFinite(price) ? price : null,
      vatMode: opts.vat ? carV2.purchase.vat.mode : "",
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

/** Plakans saraksts (j63 / m01): tā pati procesa secība, bez sadaļu virsrakstiem. */
export function flattenAutoparksV2Rows(rows: readonly AutoparksV2ListRow[]): AutoparksV2ListRow[] {
  return groupAutoparksV2Rows(rows).flatMap((s) => s.rows);
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
