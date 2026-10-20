import "server-only";

import { randomUUID } from "node:crypto";
import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  isCostSourceId,
  type CostEvent,
  type CostLimit,
  type CostLimitSource,
  type CostSnapshot,
  type CostSourceId,
} from "@/lib/admin-costs";

export const COST_EVENTS_KEEP = 2500;

export type CostEventsDoc = {
  version: 1;
  month: string;
  events: CostEvent[];
};

export type CostMetaDoc = {
  version: 1;
  limits: CostLimit[];
  snapshots: CostSnapshot[];
};

const MONTH_KEY = /^\d{4}-\d{2}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function str(v: unknown, max = 160): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function limitSource(v: unknown): CostLimitSource {
  if (v === "account" || v === "budget" || v === "manual") return v;
  return "manual";
}

export function parseCostEventsDoc(raw: unknown, fallbackMonth: string): CostEventsDoc {
  const empty: CostEventsDoc = { version: 1, month: fallbackMonth, events: [] };
  if (!isObj(raw) || raw.version !== 1) return empty;
  const month = MONTH_KEY.test(str(raw.month, 7)) ? str(raw.month, 7) : fallbackMonth;
  const events = Array.isArray(raw.events)
    ? raw.events.map(parseCostEvent).filter((e): e is CostEvent => e !== null)
    : [];
  return { version: 1, month, events };
}

export function parseCostEvent(raw: unknown): CostEvent | null {
  if (!isObj(raw)) return null;
  const source = str(raw.source, 40);
  if (!isCostSourceId(source)) return null;
  const createdAt = str(raw.createdAt, 40) || str(raw.created_at, 40);
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return null;
  return {
    id: str(raw.id, 80) || `evt_${createdMs}`,
    source,
    sku: str(raw.sku, 80),
    units: Math.max(0, num(raw.units)),
    usd: Math.max(0, num(raw.usd)),
    ref: str(raw.ref, 120),
    createdAt: new Date(createdMs).toISOString(),
  };
}

export function parseCostLimit(raw: unknown): CostLimit | null {
  if (!isObj(raw)) return null;
  const source = str(raw.source, 40);
  if (!isCostSourceId(source)) return null;
  const period = raw.period === "call" ? "call" : "month";
  const limitUsd = raw.limitUsd == null && raw.limit_usd == null ? null : Math.max(0, num(raw.limitUsd ?? raw.limit_usd));
  const limitUnits = raw.limitUnits == null && raw.limit_units == null ? null : Math.max(0, num(raw.limitUnits ?? raw.limit_units));
  const readAtRaw = str(raw.readAt, 40) || str(raw.read_at, 40);
  const readMs = Date.parse(readAtRaw);
  return {
    source,
    sku: str(raw.sku, 80),
    period,
    limitUsd,
    limitUnits,
    hard: raw.hard === true,
    sourceOfLimit: limitSource(raw.sourceOfLimit ?? raw.source_of_limit),
    readAt: Number.isFinite(readMs) ? new Date(readMs).toISOString() : null,
  };
}

export function parseCostSnapshot(raw: unknown): CostSnapshot | null {
  if (!isObj(raw)) return null;
  const source = str(raw.source, 40);
  if (!isCostSourceId(source)) return null;
  const period = str(raw.period, 7);
  if (!MONTH_KEY.test(period)) return null;
  const fetchedAt = str(raw.fetchedAt, 40) || str(raw.fetched_at, 40);
  const fetchedMs = Date.parse(fetchedAt);
  const origin = raw.origin === "api" || raw.origin === "agent" ? raw.origin : "manual";
  return {
    source,
    sku: str(raw.sku, 80),
    period,
    usd: Math.max(0, num(raw.usd)),
    units: Math.max(0, num(raw.units)),
    fetchedAt: Number.isFinite(fetchedMs) ? new Date(fetchedMs).toISOString() : new Date().toISOString(),
    origin,
  };
}

export function parseCostMetaDoc(raw: unknown): CostMetaDoc {
  if (!isObj(raw) || raw.version !== 1) return { version: 1, limits: [], snapshots: [] };
  const limits = Array.isArray(raw.limits)
    ? raw.limits.map(parseCostLimit).filter((e): e is CostLimit => e !== null)
    : [];
  const snapshots = Array.isArray(raw.snapshots)
    ? raw.snapshots.map(parseCostSnapshot).filter((e): e is CostSnapshot => e !== null)
    : [];
  return { version: 1, limits, snapshots };
}

const eventsStore = createJsonDocStore<CostEventsDoc>({
  blobPrefix: "admin-costs/events-",
  dirName: "admin-costs",
  isSafeKey: (key) => MONTH_KEY.test(key),
  parse: (raw) => parseCostEventsDoc(raw, "1970-01"),
  empty: () => ({ version: 1, month: "1970-01", events: [] }),
});

const metaStore = createJsonDocStore<CostMetaDoc>({
  blobPrefix: "admin-costs/",
  dirName: "admin-costs",
  isSafeKey: (key) => key === "meta",
  parse: parseCostMetaDoc,
  empty: () => ({ version: 1, limits: [], snapshots: [] }),
});

export async function readCostEventsMonth(month: string): Promise<CostEventsDoc> {
  if (!MONTH_KEY.test(month)) return { version: 1, month, events: [] };
  const doc = await eventsStore.read(month);
  return { ...doc, month };
}

export async function readCostMeta(): Promise<CostMetaDoc> {
  return metaStore.read("meta");
}

export async function appendCostEvent(input: {
  source: CostSourceId;
  sku?: string;
  units?: number;
  usd: number;
  ref?: string;
  month: string;
  at?: string;
}): Promise<CostEvent> {
  const event: CostEvent = {
    id: `evt_${randomUUID()}`,
    source: input.source,
    sku: (input.sku ?? "").trim(),
    units: Math.max(0, input.units ?? 0),
    usd: Math.max(0, input.usd),
    ref: (input.ref ?? "").trim().slice(0, 120),
    createdAt: input.at ?? new Date().toISOString(),
  };
  await eventsStore.update(input.month, (current) => {
    const events = [...current.events, event].slice(-COST_EVENTS_KEEP);
    return { value: event, next: { version: 1, month: input.month, events } };
  });
  return event;
}

export async function upsertCostSnapshot(next: CostSnapshot): Promise<CostMetaDoc> {
  return metaStore.update("meta", (current) => {
    const snapshots = current.snapshots.filter(
      (s) => !(s.source === next.source && s.period === next.period && (s.sku || "") === (next.sku || "")),
    );
    snapshots.push(next);
    snapshots.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt) || a.source.localeCompare(b.source));
    const doc: CostMetaDoc = { version: 1, limits: current.limits, snapshots: snapshots.slice(0, 400) };
    return { value: doc, next: doc };
  });
}

export async function upsertCostLimit(next: CostLimit): Promise<CostMetaDoc> {
  return metaStore.update("meta", (current) => {
    const limits = current.limits.filter(
      (s) => !(s.source === next.source && s.period === next.period && (s.sku || "") === (next.sku || "")),
    );
    limits.push(next);
    const doc: CostMetaDoc = { version: 1, limits, snapshots: current.snapshots };
    return { value: doc, next: doc };
  });
}

export function newCostEventId(): string {
  return `evt_${randomUUID()}`;
}
