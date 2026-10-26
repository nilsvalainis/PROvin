import { waybillPlateOccupancy, type IrissDealerPlate, type WaybillPlateState } from "@/lib/iriss-waybill-plates";

const HOUR_MS = 60 * 60 * 1000;

export type IrissMobilePlateStripItem = {
  plate: IrissDealerPlate;
  busy: boolean;
  hoursLeft: number | null;
  statusLabel: string;
};

type StripRow = {
  plate: string;
  validUntil: string;
  issuedAt?: string;
  number: string;
  brandModel?: string;
  archived?: boolean;
};

/** Visas 3 tirdzniecības zīmes. Telefons: numurzīme + statuss / atlikušās stundas, bez pavadzīmes numura. */
export function irissMobilePlateStripItems(rows: readonly StripRow[], now = new Date()): IrissMobilePlateStripItem[] {
  return irissMobilePlateStripItemsFromPlates(
    waybillPlateOccupancy(
      rows.map((row) => ({
        plate: row.plate,
        validUntil: row.validUntil,
        issuedAt: row.issuedAt,
        number: row.number,
        brandModel: row.brandModel,
        archived: row.archived,
      })),
      now,
    ),
    now,
  );
}

/** No servera numuru stāvokļa (indekss + Arhīvs + CSDD) - tas pats avots, ko rāda numura pogas un apļi. */
export function irissMobilePlateStripItemsFromPlates(plates: readonly WaybillPlateState[], now = new Date()): IrissMobilePlateStripItem[] {
  return plates.map((state) => {
    if (!state.busy || !state.current) {
      return { plate: state.plate, busy: false, hoursLeft: null, statusLabel: "Brīvs" };
    }
    const until = Date.parse(state.current.validUntil);
    const leftMs = Number.isFinite(until) ? Math.max(0, until - now.getTime()) : 0;
    const hoursLeft = Math.round(leftMs / HOUR_MS);
    // < 1 h - minūtes (agrāk "0 h", lai gan pavadzīme vēl derīga).
    const statusLabel = leftMs < HOUR_MS ? `${Math.ceil(leftMs / 60_000)} min` : `${hoursLeft} h`;
    return { plate: state.plate, busy: true, hoursLeft, statusLabel };
  });
}

export function irissMobilePlateBusyCount(items: readonly IrissMobilePlateStripItem[]): number {
  return items.filter((item) => item.busy).length;
}
