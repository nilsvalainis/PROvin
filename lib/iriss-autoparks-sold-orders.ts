import "server-only";

/**
 * Nils 20.11 (audits 3): auto «Pārdots» <-> IRISS pasūtījums «Izpildīts» (servera daļa).
 * Sauc pēc katras Autoparka statusa maiņas (kabinets, saraksts, v1 PATCH, atsaukšana, «Atjaunot no arhīva»).
 * Kļūdas nekad neaptur statusa maiņu - tikai žurnālā.
 */

import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";
import { listIrissPasutijumi, readIrissPasutijums, writeIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { displayIrissPasutijumsListStatusLabel, type IrissPasutijumsListStatus, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import { appendIrissStatusHistory } from "@/lib/iriss-pasutijumi-audit-fields";
import { listIrissPdRows } from "@/lib/iriss-piedavajumi-store";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";

export const IRISS_SOLD_SYNC_BY = "Sistēma (auto pārdots)";
export const IRISS_UNSOLD_SYNC_BY = "Sistēma (auto vairs nav pārdots)";

/** Statusi, no kuriem pasūtījums kļūst «Izpildīts» (aktīvs/rezervēts; neaktīvu un izpildītu neaiztiek). */
const COMPLETE_FROM: readonly IrissPasutijumsListStatus[] = ["active", "searching", "offered", "reserved"];

export type IrissSoldTransition = "sold" | "unsold" | null;

export function irissSoldTransition(from: string, to: string): IrissSoldTransition {
  if (from === to) return null;
  if (to === "sold") return "sold";
  if (from === "sold") return "unsold";
  return null;
}

export function irissOrderCompleteOnSold(
  order: IrissPasutijumsRecord,
  ctx: { carId: string; at: string },
): IrissPasutijumsRecord | null {
  if (order.deletedAt) return null;
  if (!COMPLETE_FROM.includes(order.listStatus)) return null;
  const next = appendIrissStatusHistory(order, "completed", { at: ctx.at, by: IRISS_SOLD_SYNC_BY });
  const hist = [...(next.statusHistory ?? [])];
  const last = hist[hist.length - 1];
  if (last) hist[hist.length - 1] = { ...last, autoparksCarId: ctx.carId };
  return { ...next, statusHistory: hist };
}

/** Atsauc tikai automātikas «Izpildīts» šim auto, ja tas joprojām ir pēdējā statusa maiņa. */
export function irissOrderRevertOnUnsold(
  order: IrissPasutijumsRecord,
  ctx: { carId: string; at: string },
): IrissPasutijumsRecord | null {
  if (order.deletedAt || order.listStatus !== "completed") return null;
  const last = order.statusHistory?.[order.statusHistory.length - 1];
  if (!last || last.to !== "completed" || last.autoparksCarId !== ctx.carId) return null;
  return appendIrissStatusHistory(order, last.from, { at: ctx.at, by: IRISS_UNSOLD_SYNC_BY });
}

/** Kandidātu pasūtījumi auto: apstiprinātie PD (pēc avota vai VIN) + pasūtījumi ar to pašu VIN. */
export function irissSoldCandidateOrderIds(input: {
  car: { id: string; vin: string };
  pdRows: ReadonlyArray<{ status: string; sourceRef: string; vin: string; approvedOrderId: string }>;
  orderRows: ReadonlyArray<{ id: string; vin: string; listStatus: string; updatedAt: string; deletedAt?: string }>;
  mode: "sold" | "unsold";
  nowMs: number;
}): string[] {
  const vin = input.car.vin.trim().toUpperCase();
  const vinOk = vin.length >= 11;
  const ids = new Set<string>();
  for (const r of input.pdRows) {
    if (r.status !== "approved" || !r.approvedOrderId) continue;
    if (r.sourceRef === `autoparks:${input.car.id}` || (vinOk && r.vin.trim().toUpperCase() === vin)) ids.add(r.approvedOrderId);
  }
  const recentMs = 60 * 24 * 60 * 60 * 1000;
  for (const r of input.orderRows) {
    if (r.deletedAt) continue;
    if (vinOk && r.vin.trim().toUpperCase() === vin) ids.add(r.id);
    else if (input.mode === "sold" && r.listStatus === "reserved") ids.add(r.id);
    // Atsaukšanai: nesen izpildītie (marķieris ierakstā izšķir, vai to darīja šī automātika).
    else if (input.mode === "unsold" && r.listStatus === "completed" && input.nowMs - Date.parse(r.updatedAt || "") < recentMs) ids.add(r.id);
  }
  return [...ids];
}

/**
 * Vai pasūtījums piesaistīts auto: apstiprināts PD (id kopā), VIN, vai vecā piedāvājuma avots `autoparks:<id>`.
 * Rezervētu pasūtījumu bez šīs saites neaiztiek.
 */
export function irissOrderLinkedToCar(
  order: Pick<IrissPasutijumsRecord, "id" | "vin" | "offers">,
  car: { id: string; vin: string },
  pdOrderIds: ReadonlySet<string>,
): boolean {
  if (pdOrderIds.has(order.id)) return true;
  const vin = car.vin.trim().toUpperCase();
  if (vin.length >= 11 && order.vin.trim().toUpperCase() === vin) return true;
  return order.offers.some((o) => o.sourceRef === `autoparks:${car.id}`);
}

/* ---------------- Servera daļa ---------------- */

export type IrissSoldSyncActor = { id: string; name: string };

function clientLabel(o: IrissPasutijumsRecord): string {
  return [o.clientFirstName, o.clientLastName].map((x) => x.trim()).filter(Boolean).join(" ") || "Pasūtījums";
}

async function writeWithRetry(
  id: string,
  build: (order: IrissPasutijumsRecord) => IrissPasutijumsRecord | null,
  by: string,
): Promise<{ before: IrissPasutijumsRecord; after: IrissPasutijumsRecord } | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const order = await readIrissPasutijums(id);
    if (!order) return null;
    const next = build(order);
    if (!next) return null;
    const saved = await writeIrissPasutijums(next, { expectedWorkspaceRevision: irissWorkspaceRevision(order), historyBy: by });
    if (saved.ok) return { before: order, after: next };
    if (!saved.stale) return null;
  }
  return null;
}

export async function syncIrissOrdersAfterCarStatus(
  car: { id: string; vin: string },
  from: string,
  to: string,
  actor: IrissSoldSyncActor,
): Promise<number> {
  const mode = irissSoldTransition(from, to);
  if (!mode) return 0;
  try {
    const [pdRows, orderRows] = await Promise.all([listIrissPdRows().catch(() => []), listIrissPasutijumi().catch(() => [])]);
    const nowMs = Date.now();
    const at = new Date(nowMs).toISOString();
    // Apstiprināto PD pasūtījumi šim auto (kandidātu funkcija atlasa pēc avota vai VIN).
    const pdOrderIds = new Set(irissSoldCandidateOrderIds({ car, pdRows, orderRows: [], mode, nowMs }));
    const ids = irissSoldCandidateOrderIds({ car, pdRows, orderRows, mode, nowMs });
    const historyRows: Array<{ from: string; to: string }> = [];
    for (const id of ids) {
      const res = await writeWithRetry(
        id,
        (order) => {
          if (mode === "sold") {
            return irissOrderLinkedToCar(order, car, pdOrderIds) ? irissOrderCompleteOnSold(order, { carId: car.id, at }) : null;
          }
          return irissOrderRevertOnUnsold(order, { carId: car.id, at });
        },
        mode === "sold" ? IRISS_SOLD_SYNC_BY : IRISS_UNSOLD_SYNC_BY,
      ).catch(() => null);
      if (!res) continue;
      historyRows.push({
        from: `${clientLabel(res.before)} · ${displayIrissPasutijumsListStatusLabel(res.before.listStatus)}`,
        to: displayIrissPasutijumsListStatusLabel(res.after.listStatus),
      });
    }
    if (historyRows.length) {
      const { mutateAutoparksV2State, v2HistoryRow } = await import("@/lib/iriss-autoparks-v2-store");
      await mutateAutoparksV2State((state) => {
        for (const h of historyRows) state.history.push(v2HistoryRow(car.id, actor, "clientOrder", h.from, h.to));
        return { result: null };
      });
    }
    return historyRows.length;
  } catch (e) {
    console.error("[iriss-autoparks] sold -> pasūtījums", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Ērtībai statusa maiņas vietām: nolasa auto (VIN) un sinhronizē, ja maiņa skar «Pārdots». */
export async function syncIrissOrdersAfterCarStatusById(carId: string, from: string, to: string, actor: IrissSoldSyncActor): Promise<void> {
  if (!irissSoldTransition(from, to)) return;
  const car = (await readAutoparksState().catch(() => null))?.cars.find((c) => c.id === carId);
  if (!car) return;
  await syncIrissOrdersAfterCarStatus({ id: car.id, vin: car.vin }, from, to, actor);
}
