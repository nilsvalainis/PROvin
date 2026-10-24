import "server-only";

import { randomUUID } from "node:crypto";
import {
  AUTOPARKS_STATUS_LV,
  isAutoparksStatus,
  type AutoparksCar,
  type AutoparksStatus,
} from "@/lib/iriss-autoparks";
import { mutateAutoparksState, readAutoparksState } from "@/lib/iriss-autoparks-store";
import {
  AUTOPARKS_V2_FILE,
  capHistory,
  carV2Of,
  decideStatusUndo,
  normalizeAutoparksV2State,
  type AutoparksCarV2,
  type AutoparksV2State,
  type V2HistoryRow,
} from "@/lib/iriss-autoparks-v2";
import { mutateLogisticsJsonFile, readLogisticsJsonFile } from "@/lib/iriss-logistics-store";

export type AutoparksV2Actor = { id: string; name: string };

export async function readAutoparksV2State(): Promise<AutoparksV2State> {
  return normalizeAutoparksV2State(await readLogisticsJsonFile(AUTOPARKS_V2_FILE));
}

/** Vienīgais v2 rakstīšanas ceļš (etag/ifMatch + atkārtošana, kā v1). */
export async function mutateAutoparksV2State<R>(
  mutate: (state: AutoparksV2State) => { result: R; write?: boolean } | Promise<{ result: R; write?: boolean }>,
): Promise<R> {
  return mutateLogisticsJsonFile(AUTOPARKS_V2_FILE, async (raw) => {
    const state = normalizeAutoparksV2State(raw);
    const out = await mutate(state);
    if (out.write === false) return { result: out.result };
    return { next: { ...state, history: capHistory(state.history) }, result: out.result };
  });
}

export function v2HistoryRow(
  carId: string,
  actor: AutoparksV2Actor,
  field: string,
  from: unknown,
  to: unknown,
  extra: { undoOf?: string } = {},
): V2HistoryRow {
  const s = (v: unknown) => (v == null ? "" : String(v)).slice(0, 300);
  return {
    id: `ah-${randomUUID()}`,
    carId,
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    field,
    from: s(from),
    to: s(to),
    ...(extra.undoOf ? { undoOf: extra.undoOf } : {}),
  };
}

/**
 * Maina viena auto v2 ierakstu. `edit` atgriež vēstures rindas (lauks, no, uz); ja nav rindu un `write` nav true,
 * nekas netiek rakstīts.
 */
export async function updateCarV2<R>(
  carId: string,
  edit: (car: AutoparksCarV2) => { result: R; history?: Array<{ field: string; from: unknown; to: unknown }>; write?: boolean },
  actor: AutoparksV2Actor,
): Promise<R> {
  return mutateAutoparksV2State((state) => {
    const car = structuredClone(carV2Of(state, carId));
    const out = edit(car);
    const rows = (out.history ?? []).filter((h) => String(h.from ?? "") !== String(h.to ?? ""));
    if (out.write !== true && rows.length === 0) return { result: out.result, write: false };
    state.cars[carId] = car;
    for (const h of rows) state.history.push(v2HistoryRow(carId, actor, h.field, h.from, h.to));
    return { result: out.result };
  });
}

export async function readAutoparksV2Car(carId: string): Promise<{ car: AutoparksCar; v2: AutoparksCarV2 } | null> {
  const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
  const car = v1.cars.find((c) => c.id === carId);
  return car ? { car, v2: carV2Of(v2, carId) } : null;
}

function v1StatusEvent(carId: string, actor: AutoparksV2Actor, from: AutoparksStatus, to: AutoparksStatus) {
  return {
    id: `ae-${randomUUID()}`,
    carId,
    at: new Date().toISOString(),
    actorName: actor.name,
    text: `Statuss: ${AUTOPARKS_STATUS_LV[from]} -> ${AUTOPARKS_STATUS_LV[to]}`,
  };
}

type SetStatusResult = { ok: true; prev: AutoparksStatus } | { ok: false; reason: "not_found" | "conflict" | "same" };

/**
 * Nosacīta statusa maiņa v1 failā (statuss ir v1 lauks): raksta tikai, ja pašreizējais statuss ir `expect`.
 * Atgriež iepriekšējo statusu vai `conflict`.
 */
async function setV1StatusIf(
  carId: string,
  next: AutoparksStatus,
  expect: AutoparksStatus | null,
  actor: AutoparksV2Actor,
): Promise<SetStatusResult> {
  return mutateAutoparksState<SetStatusResult>((state) => {
    const idx = state.cars.findIndex((c) => c.id === carId);
    if (idx < 0) return { result: { ok: false as const, reason: "not_found" as const }, write: false };
    const prev = state.cars[idx]!;
    if (expect && prev.status !== expect) return { result: { ok: false as const, reason: "conflict" as const }, write: false };
    if (prev.status === next) return { result: { ok: false as const, reason: "same" as const }, write: false };
    const now = new Date().toISOString();
    state.cars[idx] = { ...prev, status: next, statusChangedAt: now, updatedAt: now };
    state.events.push(v1StatusEvent(carId, actor, prev.status, next));
    return { result: { ok: true as const, prev: prev.status } };
  });
}

export async function changeAutoparksStatusV2(
  carId: string,
  status: unknown,
  actor: AutoparksV2Actor,
): Promise<{ ok: true; historyId: string; status: AutoparksStatus } | { ok: false; reason: "invalid" | "not_found" | "conflict" | "same" }> {
  if (!isAutoparksStatus(status)) return { ok: false, reason: "invalid" };
  const res = await setV1StatusIf(carId, status, null, actor);
  if (!res.ok) return res;
  const row = v2HistoryRow(carId, actor, "status", res.prev, status);
  await mutateAutoparksV2State((state) => {
    state.history.push(row);
    return { result: null };
  });
  return { ok: true, historyId: row.id, status };
}

export async function undoAutoparksStatusV2(
  carId: string,
  historyId: string,
  actor: AutoparksV2Actor,
): Promise<{ ok: true; status: AutoparksStatus } | { ok: false; reason: string }> {
  const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
  const car = v1.cars.find((c) => c.id === carId);
  if (!car) return { ok: false, reason: "not_found" };
  const decision = decideStatusUndo({
    history: v2.history.filter((r) => r.carId === carId),
    rowId: historyId,
    actorId: actor.id,
    currentStatus: car.status,
    nowMs: Date.now(),
  });
  if (!decision.ok) return decision;
  const res = await setV1StatusIf(carId, decision.revertTo, decision.row.to as AutoparksStatus, actor);
  if (!res.ok) return { ok: false, reason: res.reason === "same" ? "changed" : res.reason === "conflict" ? "changed" : res.reason };
  await mutateAutoparksV2State((state) => {
    state.history.push(v2HistoryRow(carId, actor, "status", decision.row.to, decision.revertTo, { undoOf: decision.row.id }));
    return { result: null };
  });
  return { ok: true, status: decision.revertTo };
}

export async function listAutoparksV2History(carId: string): Promise<V2HistoryRow[]> {
  const state = await readAutoparksV2State();
  return state.history.filter((r) => r.carId === carId).reverse();
}

const TECH_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * CSDD tehniskie dati (1. reģ., tilpums, kW) pēc VIN vai numura - tikai tukšiem laukiem, ne biežāk kā reizi nedēļā.
 * Ar roku ievadīto nepārraksta. Kļūda nav fatāla (lapa strādā arī bez CSDD).
 */
export async function refreshAutoparksV2Tech(car: AutoparksCar, v2: AutoparksCarV2, actor: AutoparksV2Actor): Promise<AutoparksCarV2> {
  const t = v2.tech;
  const missing = !t.firstRegDate || t.displacementCm3 == null || t.powerKw == null;
  const checked = Date.parse(t.csddCheckedAt);
  if (!missing || (Number.isFinite(checked) && Date.now() - checked < TECH_RECHECK_MS)) return v2;
  // Ar roku labots VIN/numurzīme (Pamatdati) glabājas tikai v2.fields - v1 `car.vin`/`car.plate` paliek
  // nemainīts pēc J29 C dizaina, tāpēc jāņem šī pati "efektīvā" vērtība, ko lieto `autoparksV2Basics`.
  const vin = v2.fields.vin || car.vin;
  const plate = v2.fields.plate || car.plate;
  const nr = vin.trim().length >= 11 ? vin : plate;
  if (!nr.trim()) return v2;
  const { fetchCsddTechData } = await import("@/lib/csdd-tech-data");
  const res = await fetchCsddTechData(nr).catch(() => null);
  const num = (s: string) => {
    const n = Number(String(s).replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  return updateCarV2(
    car.id,
    (c) => {
      c.tech.csddCheckedAt = new Date().toISOString();
      const hist: Array<{ field: string; from: unknown; to: unknown }> = [];
      if (res?.found) {
        const d = res.data;
        const reg = d.firstRegistrationIso.slice(0, 10);
        if (!c.tech.firstRegDate && reg) {
          c.tech.firstRegDate = reg;
          c.sources["tech.firstRegDate"] = "csdd";
          hist.push({ field: "tech.firstRegDate", from: "", to: reg });
        }
        const cm3 = num(d.displacementCm3);
        if (c.tech.displacementCm3 == null && cm3 != null) {
          c.tech.displacementCm3 = cm3;
          c.sources["tech.displacementCm3"] = "csdd";
          hist.push({ field: "tech.displacementCm3", from: "", to: cm3 });
        }
        const kw = num(d.powerKw) ?? num(d.electricPowerKw);
        if (c.tech.powerKw == null && kw != null) {
          c.tech.powerKw = kw;
          c.sources["tech.powerKw"] = "csdd";
          hist.push({ field: "tech.powerKw", from: "", to: kw });
        }
      }
      return { result: c, history: hist, write: true };
    },
    { ...actor, name: `${actor.name} (CSDD)` },
  );
}
