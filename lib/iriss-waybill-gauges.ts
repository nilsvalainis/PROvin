import { waybillCountdownStatus, type WaybillCountdownStatus } from "@/lib/iriss-pavadzimes-countdown";
import { displayDealerPlate, waybillPlateOccupancy, type IrissDealerPlate, type WaybillPlateState } from "@/lib/iriss-waybill-plates";

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
  archived?: boolean;
};

export type WaybillGauge = {
  plate: IrissDealerPlate;
  busy: boolean;
  /** "issuing" = numurs brīvs, bet CSDD šobrīd izdod pavadzīmi (aplis "izdod..."). */
  status: WaybillCountdownStatus | "free" | "issuing";
  /** j47: "izdod..." ar roku - Aivars (aplis rāda "Aivars", nevis "izdod..."). */
  manual?: boolean;
  /** Atlikušās pilnās stundas (noapaļotas uz leju, lai "1 h" nozīmē vismaz 1 h). */
  hoursLeft: number;
  /** Atlikušās minūtes (uz augšu), lai < 1 h aplis nerāda "0h". */
  minutesLeft: number;
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
    rows.map((r) => ({ plate: r.plate, validUntil: r.validUntil, issuedAt: r.issuedAt, number: r.number ?? "", brandModel: r.brandModel, archived: r.archived })),
    now,
  );
  return waybillGaugesFromPlates(occupancy, rows, now);
}

/**
 * Apļi no tā paša numuru stāvokļa, ko rāda numura pogas (j25: viens avots, lai aplis nekad nerāda "brīvs",
 * kad poga rāda "aizņemts"). rows tikai PDF saitei (id pēc pavadzīmes numura vai beigu laika).
 *
 * j31: ja numuram jau ir aktīva pavadzīme, bet lietotājs tikko pieprasīja jaunu (nomaina veco - "Vai tiešām
 * anulēt iepriekšējo?" -> Jā), `state.issuing` rāda TO jauno darbu. Līdz tas tiek izdots, `state.current`
 * joprojām ir VECĀ pavadzīme - aplis nedrīkst rādīt veco atlikumu, kā it kā nekas nebūtu mainījies.
 */
export function waybillGaugesFromPlates(
  plates: readonly WaybillPlateState[],
  rows: readonly WaybillGaugeRow[] = [],
  now = new Date(),
): WaybillGauge[] {
  return plates.map((state) => {
    if (!state.busy || !state.current || state.issuing) {
      const issuing = state.issuing;
      return {
        plate: state.plate,
        busy: false,
        status: issuing ? "issuing" : "free",
        ...(issuing?.manual ? { manual: true } : {}),
        hoursLeft: 0,
        minutesLeft: 0,
        share: 0,
        brandModel: issuing?.brandModel ?? "",
        validUntil: "",
        id: "",
        number: "",
      };
    }
    const cur = state.current;
    const until = Date.parse(cur.validUntil);
    const leftMs = Number.isFinite(until) ? Math.max(0, until - now.getTime()) : 0;
    const no = cur.number.trim().toUpperCase();
    const row =
      (no ? rows.find((r) => (r.number ?? "").trim().toUpperCase() === no && r.id) : undefined) ??
      rows.find((r) => r.id && displayDealerPlate(r.plate) === state.plate && r.validUntil === cur.validUntil);
    return {
      plate: state.plate,
      busy: true,
      status: waybillCountdownStatus(cur.validUntil, now),
      hoursLeft: Math.floor(leftMs / HOUR_MS),
      minutesLeft: Math.ceil(leftMs / 60_000),
      share: Math.min(1, leftMs / (WAYBILL_MAX_HOURS * HOUR_MS)),
      brandModel: cur.brandModel || row?.brandModel || "",
      validUntil: cur.validUntil,
      id: row?.id ?? "",
      number: cur.number,
    };
  });
}

/** Sākuma kartītes modeļa rinda: pilns nosaukums, bez vārdu nogriešanas. */
export function waybillHomeCarText(g: Pick<WaybillGauge, "busy" | "status" | "brandModel">): string {
  const model = g.brandModel.trim();
  if (g.busy) return model || "auto";
  if (g.status === "issuing") return model || "-";
  return "-";
}

/** Tooltip, ja ir īsts modeļa nosaukums (CSS var eleganti saīsināt). */
export function waybillHomeCarTitle(g: Pick<WaybillGauge, "brandModel">): string | undefined {
  return g.brandModel.trim() || undefined;
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

/** Apļa vērtība: < 1 h - minūtes ("17 min"), citādi stundas ("38 h"). */
export function waybillGaugeTimeLeft(g: Pick<WaybillGauge, "hoursLeft" | "minutesLeft">): { value: number; unit: "h" | "min" } {
  return g.hoursLeft >= 1 ? { value: g.hoursLeft, unit: "h" } : { value: Math.max(0, g.minutesLeft), unit: "min" };
}
