/**
 * P5 (Nils 20.11): viens pasūtījuma statusa ceļš - Meklējam -> Piedāvāts -> Rezervēts -> Ceļā -> Pārdots (+ Neaktīvs).
 *
 * Posmu aprēķina lasot (pirmā atbilstošā rinda), glabātie JSON netiek pārrakstīti:
 * 1. `listStatus` inactive vai Darījums «Atcelts» -> Neaktīvs
 * 2. `listStatus` completed, Darījums «Nodots» vai saistītais Autoparka auto «Pārdots» -> Pārdots
 * 3. Darījums «Nopirkts»/«Transportā» vai (rezervēts un saistītais auto Ceļā/Noliktavā/Servisā) -> Ceļā
 * 4. `listStatus` reserved vai Darījums «Avanss saņemts» -> Rezervēts
 * 5. piesaistīts PD «Nosūtīts», `listStatus` offered vai Darījums «Piedāvāts» -> Piedāvāts
 * 6. citādi -> Meklējam
 * Miskaste (`deletedAt`) ir saraksta filtrs, nevis posms.
 *
 * Ar roku maiņa raksta esošos laukus (`listStatus` + `dealWorkflowStatus`) - sk. `applyIrissOrderStage`.
 */

import { parseIrissDealWorkflowStatus } from "@/lib/iriss-order-overview-view";
import {
  IRISS_ORDER_STAGE_LV,
  type IrissOrderStage,
  type IrissOrderStageSignals,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
  type IrissStatusHistoryEntry,
} from "@/lib/iriss-pasutijumi-types";
import { irissPdNumberLabel, type IrissPdListRow } from "@/lib/iriss-piedavajumi-types";
import { irissPdRowEffectiveStatus } from "@/lib/iriss-piedavajumi";
import { AUTOPARKS_STATUS_LV, type AutoparksStatus } from "@/lib/iriss-autoparks";

/** Autoparka auto statusi, kuros rezervēts pasūtījums ir «Ceļā». */
const CAR_TRANSIT: ReadonlySet<string> = new Set(["in_transit", "prep_waiting", "in_service"]);

export type IrissOrderStageInput = {
  listStatus?: IrissPasutijumsListStatus | string;
  dealWorkflowStatus?: string;
};

export function irissOrderStage(order: IrissOrderStageInput, signals?: IrissOrderStageSignals | null): IrissOrderStage {
  const st = order.listStatus || "active";
  const deal = parseIrissDealWorkflowStatus(order.dealWorkflowStatus);
  if (st === "inactive" || deal === "atcelts") return "inactive";
  if (st === "completed" || deal === "nodots" || signals?.car?.status === "sold") return "sold";
  const reserved = st === "reserved" || deal === "avanss_sanemts";
  if (deal === "nopirkts" || deal === "transporta") return "transit";
  if (reserved && signals?.car && CAR_TRANSIT.has(signals.car.status)) return "transit";
  if (reserved) return "reserved";
  if (signals?.pdSent || st === "offered" || deal === "piedavats") return "offered";
  return "searching";
}

export function irissOrderStageLabel(stage: IrissOrderStage): string {
  return IRISS_ORDER_STAGE_LV[stage];
}

/** «Avanss ✓» atzīme Rezervēts posmā (2A): avansa datums vai vecais Darījums «Avanss saņemts». */
export function irissOrderAdvanceReceived(order: { advancePaidAt?: string; advance?: { paidAt?: string }; dealWorkflowStatus?: string }): boolean {
  const paidAt = (order.advancePaidAt ?? order.advance?.paidAt ?? "").trim();
  return Boolean(paidAt) || parseIrissDealWorkflowStatus(order.dealWorkflowStatus) === "avanss_sanemts";
}

type StageCar = { id: string; vin: string; status: AutoparksStatus | string; make?: string; model?: string; archivedAt?: string };

function vinKey(v: string | undefined): string {
  const t = (v ?? "").trim().toUpperCase();
  return t.length >= 11 ? t : "";
}

/**
 * Signāli vienam pasūtījumam: PD (pēc `clientOrderId`/`approvedOrderId`) un Autoparka auto
 * (apstiprināta PD avots `autoparks:<id>` vai VIN, vai pasūtījuma VIN).
 */
export function irissOrderStageSignals(
  order: { id: string; vin?: string },
  pdRows: readonly IrissPdListRow[],
  cars: readonly StageCar[],
  nowMs: number,
): IrissOrderStageSignals {
  const out: IrissOrderStageSignals = {};
  const mine = pdRows.filter((r) => r.clientOrderId === order.id || r.approvedOrderId === order.id);
  const sent = mine
    .filter((r) => irissPdRowEffectiveStatus(r, nowMs) === "sent")
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (sent) out.pdSent = { label: irissPdNumberLabel(sent.number), at: sent.updatedAt };

  const carIds = new Set<string>();
  const vins = new Set<string>();
  for (const r of mine) {
    if (r.status !== "approved") continue;
    const m = r.sourceRef.match(/^autoparks:([\w-]{1,80})$/);
    if (m) carIds.add(m[1]!);
    const v = vinKey(r.vin);
    if (v) vins.add(v);
  }
  const ov = vinKey(order.vin);
  if (ov) vins.add(ov);
  if (carIds.size || vins.size) {
    const linked = cars.filter((c) => carIds.has(c.id) || (vinKey(c.vin) && vins.has(vinKey(c.vin))));
    // Aktīvais auto pirms arhivētā; tad pēc ceļa tālākā statusa.
    linked.sort((a, b) => Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt)));
    const car = linked[0];
    if (car) {
      const st = String(car.status);
      out.car = { status: st, label: `Autoparks: ${AUTOPARKS_STATUS_LV[st as AutoparksStatus] ?? st}` };
    }
  }
  return out;
}

export function irissOrderStageSignalsEmpty(s: IrissOrderStageSignals | null | undefined): boolean {
  return !s || (!s.pdSent && !s.car);
}

/** Vai posmu noteica PD/Autoparks (nevis vecie lauki) - UI zīme «AUTO». */
export function irissOrderStageIsAuto(
  order: IrissOrderStageInput & { statusHistory?: IrissStatusHistoryEntry[] },
  signals?: IrissOrderStageSignals | null,
): boolean {
  const stage = irissOrderStage(order, signals);
  if (stage !== irissOrderStage(order, null)) return true;
  const last = order.statusHistory?.[order.statusHistory.length - 1];
  return Boolean(last && /^(Sistēma|Klients)/.test(last.by));
}

/** Pelēkais teksts pie posma: no kurienes posms (PD numurs, Autoparka auto, datums). */
export function irissOrderStageSource(
  stage: IrissOrderStage,
  order: { orderDate?: string; createdAt?: string; statusHistory?: IrissStatusHistoryEntry[] },
  signals?: IrissOrderStageSignals | null,
): string {
  if (stage === "offered" && signals?.pdSent) return `${signals.pdSent.label} · ${shortDate(signals.pdSent.at)}`;
  if ((stage === "transit" || stage === "sold") && signals?.car) return signals.car.label;
  const hist = order.statusHistory ?? [];
  for (let i = hist.length - 1; i >= 0; i -= 1) {
    const e = hist[i]!;
    if (e.stage === stage || (!e.stage && stageOfListStatus(e.to) === stage)) return shortDate(e.at);
  }
  if (stage === "searching") return shortDate(order.orderDate || order.createdAt || "");
  return "";
}

function stageOfListStatus(st: string): IrissOrderStage {
  return irissOrderStage({ listStatus: st });
}

function shortDate(iso: string): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(iso);
  if (iso.length > 10 && !Number.isNaN(d.getTime())) {
    const parts = new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit" }).formatToParts(d);
    const dd = parts.find((p) => p.type === "day")?.value;
    const mm = parts.find((p) => p.type === "month")?.value;
    if (dd && mm) return `${dd}.${mm}`;
  }
  return `${m[3]}.${m[2]}`;
}

/** Posms -> saglabātais `listStatus` (ar roku maiņa). */
export const IRISS_ORDER_STAGE_LIST_STATUS: Record<IrissOrderStage, IrissPasutijumsListStatus> = {
  searching: "active",
  offered: "offered",
  reserved: "reserved",
  transit: "reserved",
  sold: "completed",
  inactive: "inactive",
};

/** «jauns» = neitrāls darījums (lauku nedzēš, lai servera sapludināšana to neatjauno). */
function dealForStage(stage: IrissOrderStage, current: string | undefined): string {
  const deal = parseIrissDealWorkflowStatus(current);
  switch (stage) {
    case "searching":
      return "meklejam";
    case "offered":
      return "piedavats";
    case "reserved":
      return deal === "avanss_sanemts" ? deal : "jauns";
    case "transit":
      return deal === "nopirkts" ? deal : "transporta";
    case "sold":
      return "nodots";
    case "inactive":
      return deal === "atcelts" ? deal : "jauns";
  }
}

/**
 * Maiņa ar roku: raksta `listStatus` + `dealWorkflowStatus` pēc tabulas un vēsturē posmu (`stage`).
 * Vienmēr atjauno `statusChangedAt`, lai autosaglabāšana nepārraksta servera/lokālo maiņu.
 */
export function applyIrissOrderStage(
  rec: IrissPasutijumsRecord,
  stage: IrissOrderStage,
  opts: { at: string; by?: string; reason?: string },
): IrissPasutijumsRecord {
  const from = rec.listStatus ?? "active";
  const to = IRISS_ORDER_STAGE_LIST_STATUS[stage];
  const deal = dealForStage(stage, rec.dealWorkflowStatus);
  const entry: IrissStatusHistoryEntry = {
    from,
    to,
    at: opts.at,
    by: (opts.by ?? "operators").slice(0, 80),
    stage,
    ...(to === "inactive" && opts.reason?.trim() ? { reason: opts.reason.trim().slice(0, 240) } : {}),
  };
  const next: IrissPasutijumsRecord = {
    ...rec,
    listStatus: to,
    statusChangedAt: opts.at,
    statusHistory: [...(rec.statusHistory ?? []), entry].slice(-80),
    inactiveReason: to === "inactive" ? (opts.reason ?? rec.inactiveReason ?? "") : "",
    dealWorkflowStatus: deal,
  };
  return next;
}

/** Saraksta/skaitītāju posms rindai (Miskaste - atsevišķi). */
export function irissListRowStage(row: {
  listStatus?: IrissPasutijumsListStatus | string;
  dealWorkflowStatus?: string;
  stageSignals?: IrissOrderStageSignals;
}): IrissOrderStage {
  return irissOrderStage(row, row.stageSignals);
}

/** Pievieno saraksta rindām PD/Autoparka signālus (viens PD saraksta + viens Autoparka nolasījums). */
export function attachIrissOrderStageSignals<T extends { id: string; vin?: string; stageSignals?: IrissOrderStageSignals }>(
  rows: readonly T[],
  pdRows: readonly IrissPdListRow[],
  cars: readonly StageCar[],
  nowMs: number,
): T[] {
  return rows.map((row) => {
    const s = irissOrderStageSignals(row, pdRows, cars, nowMs);
    return irissOrderStageSignalsEmpty(s) ? row : { ...row, stageSignals: s };
  });
}

/** Saraksta rindas īsā piezīme pie posma (makets): «PD-0017 nosūtīts 19.11», «Avanss ✓ 19.11», «Autoparks: Ceļā». */
export function irissListRowStageHint(row: {
  listStatus?: IrissPasutijumsListStatus | string;
  dealWorkflowStatus?: string;
  advancePaidAt?: string;
  stageSignals?: IrissOrderStageSignals;
}): string {
  const stage = irissListRowStage(row);
  const s = row.stageSignals;
  if (stage === "offered" && s?.pdSent) return `${s.pdSent.label} nosūtīts ${shortDate(s.pdSent.at)}`.trim();
  if (stage === "reserved" && irissOrderAdvanceReceived(row)) return `Avanss ✓ ${shortDate(row.advancePaidAt ?? "")}`.trim();
  if ((stage === "transit" || stage === "sold") && s?.car) return s.car.label;
  return "";
}
