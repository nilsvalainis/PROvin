import { waybillPlateOccupancy, type IrissDealerPlate } from "@/lib/iriss-waybill-plates";

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
};

/** Visas 3 tirdzniecības zīmes. Telefons: numurzīme + statuss / atlikušās stundas, bez pavadzīmes numura. */
export function irissMobilePlateStripItems(rows: readonly StripRow[], now = new Date()): IrissMobilePlateStripItem[] {
  return waybillPlateOccupancy(
    rows.map((row) => ({
      plate: row.plate,
      validUntil: row.validUntil,
      issuedAt: row.issuedAt,
      number: row.number,
      brandModel: row.brandModel,
    })),
    now,
  ).map((state) => {
    if (!state.busy || !state.current) {
      return { plate: state.plate, busy: false, hoursLeft: null, statusLabel: "Brīvs" };
    }
    const until = Date.parse(state.current.validUntil);
    const hoursLeft = Number.isFinite(until) ? Math.max(0, Math.round((until - now.getTime()) / HOUR_MS)) : 0;
    return { plate: state.plate, busy: true, hoursLeft, statusLabel: `${hoursLeft} h` };
  });
}

export function irissMobilePlateBusyCount(items: readonly IrissMobilePlateStripItem[]): number {
  return items.filter((item) => item.busy).length;
}
