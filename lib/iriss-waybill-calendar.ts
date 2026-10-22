/**
 * Pavadzīmju termiņu kalendārs (katram tranzīta numuram sava josla) un vēsture pēc auto (VIN).
 * Tīra loģika bez React.
 */
import type { IrissPavadzimeRecord } from "@/lib/iriss-pavadzimes-types";

export type WaybillCalendarTone = "active" | "soon" | "expired";

export type WaybillCalendarSegment = {
  id: string;
  number: string;
  brandModel: string;
  validUntil: string;
  leftPct: number;
  widthPct: number;
  tone: WaybillCalendarTone;
};

export type WaybillCalendar = {
  /** Dienu sākumi (ms) kalendāra galvenei. */
  days: number[];
  startMs: number;
  endMs: number;
  /** Šobrīd kā % no loga (vertikālā līnija). */
  nowPct: number;
  lanes: Array<{ plate: string; segments: WaybillCalendarSegment[] }>;
};

const DAY = 86_400_000;
const SOON_MS = 24 * 3_600_000;

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function plateKey(p: string): string {
  return p.trim().toUpperCase().replace(/\s+/g, "");
}

/** Logs: no šodienas sākuma `days` dienas uz priekšu. Joslas sakārtotas pēc numura. */
export function buildWaybillCalendar(
  rows: ReadonlyArray<Pick<IrissPavadzimeRecord, "id" | "number" | "brandModel" | "plate" | "issuedAt" | "validUntil">>,
  nowMs: number,
  days = 7,
): WaybillCalendar {
  const startMs = startOfLocalDay(nowMs);
  const endMs = startMs + days * DAY;
  const span = endMs - startMs;
  const lanes = new Map<string, WaybillCalendarSegment[]>();
  for (const r of rows) {
    const until = Date.parse(r.validUntil);
    if (!Number.isFinite(until)) continue;
    const issued = Date.parse(r.issuedAt);
    const from = Math.max(Number.isFinite(issued) ? issued : until - SOON_MS, startMs);
    const to = Math.min(until, endMs);
    if (to <= startMs || from >= endMs || to <= from) continue;
    const tone: WaybillCalendarTone = until <= nowMs ? "expired" : until - nowMs <= SOON_MS ? "soon" : "active";
    const plate = plateKey(r.plate) || "Bez numura";
    const seg: WaybillCalendarSegment = {
      id: r.id,
      number: r.number,
      brandModel: r.brandModel,
      validUntil: r.validUntil,
      leftPct: ((from - startMs) / span) * 100,
      widthPct: Math.max(1.5, ((to - from) / span) * 100),
      tone,
    };
    lanes.set(plate, [...(lanes.get(plate) ?? []), seg]);
  }
  return {
    days: Array.from({ length: days }, (_, i) => startMs + i * DAY),
    startMs,
    endMs,
    nowPct: Math.min(100, Math.max(0, ((nowMs - startMs) / span) * 100)),
    lanes: [...lanes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([plate, segments]) => ({ plate, segments: segments.sort((x, y) => x.leftPct - y.leftPct) })),
  };
}

/** Visas pavadzīmes šim auto (arī arhīvā), jaunākā augšā. */
export function waybillHistoryForVin<T extends Pick<IrissPavadzimeRecord, "vin" | "issuedAt" | "validUntil">>(rows: readonly T[], vin: string): T[] {
  const key = vin.trim().toUpperCase();
  if (key.length < 6) return [];
  return rows
    .filter((r) => r.vin.trim().toUpperCase() === key)
    .sort((a, b) => (b.issuedAt || b.validUntil).localeCompare(a.issuedAt || a.validUntil));
}
