import { waybillCountdownStatus, type WaybillCountdownStatus } from "@/lib/iriss-pavadzimes-countdown";
import { displayDealerPlate, waybillPlateOccupancy, type IrissDealerPlate } from "@/lib/iriss-waybill-plates";

/** Viena pavadzīme nekad nav garāka par 48 h, tāpēc aplis vienmēr ir 48 h skalā. */
export const WAYBILL_MAX_HOURS = 48;

const HOUR_MS = 60 * 60 * 1000;

export type WaybillGaugeRow = {
  id: string;
  plate: string;
  validUntil: string;
  issuedAt?: string;
  number?: string;
  brandModel?: string;
};

export type WaybillGauge = {
  plate: IrissDealerPlate;
  busy: boolean;
  status: WaybillCountdownStatus | "free";
  /** Atlikušās pilnās stundas (noapaļotas uz leju, lai "1 h" nozīmē vismaz 1 h). */
  hoursLeft: number;
  /** 0..1 no 48 h. */
  share: number;
  brandModel: string;
  validUntil: string;
  id: string;
  number: string;
};

/** Visas 3 tirdzniecības zīmes vienā skatā: aizņemtās ar atlikušo laiku, pārējās "brīvs". */
export function irissWaybillGauges(rows: readonly WaybillGaugeRow[], now = new Date()): WaybillGauge[] {
  const occupancy = waybillPlateOccupancy(
    rows.map((r) => ({ plate: r.plate, validUntil: r.validUntil, issuedAt: r.issuedAt, number: r.number ?? "", brandModel: r.brandModel })),
    now,
  );
  return occupancy.map((state) => {
    if (!state.busy || !state.current) {
      return { plate: state.plate, busy: false, status: "free", hoursLeft: 0, share: 0, brandModel: "", validUntil: "", id: "", number: "" };
    }
    const cur = state.current;
    const until = Date.parse(cur.validUntil);
    const leftMs = Number.isFinite(until) ? Math.max(0, until - now.getTime()) : 0;
    const row = rows.find((r) => displayDealerPlate(r.plate) === state.plate && r.validUntil === cur.validUntil);
    return {
      plate: state.plate,
      busy: true,
      status: waybillCountdownStatus(cur.validUntil, now),
      hoursLeft: Math.floor(leftMs / HOUR_MS),
      share: Math.min(1, leftMs / (WAYBILL_MAX_HOURS * HOUR_MS)),
      brandModel: cur.brandModel,
      validUntil: cur.validUntil,
      id: row?.id ?? "",
      number: cur.number,
    };
  });
}

/** Precīzs atlikums detaļās: "31 h 05 min" vai "45 min". */
export function formatWaybillLeft(validUntil: string, now = new Date()): string {
  const until = Date.parse(validUntil);
  if (!Number.isFinite(until)) return "";
  const totalMin = Math.max(0, Math.floor((until - now.getTime()) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (totalMin === 0) return "beigusies";
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}
