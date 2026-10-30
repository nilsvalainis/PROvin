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
  rows: ReadonlyArray<
    Pick<IrissPavadzimeRecord, "id" | "number" | "brandModel" | "plate" | "issuedAt" | "validUntil"> & {
      /** "interrupted" = pārtraukta: josla beidzas pārtraukšanas brīdī un ir pelēka (agrāk - līdz sākotnējām beigām, oranža). */
      lifecycle?: string;
      supersededBy?: string;
    }
  >,
  nowMs: number,
  days = 7,
): WaybillCalendar {
  const startMs = startOfLocalDay(nowMs);
  const endMs = startMs + days * DAY;
  const span = endMs - startMs;
  const lanes = new Map<string, WaybillCalendarSegment[]>();
  const issuedByNumber = new Map(rows.map((r) => [r.number.trim().toUpperCase(), Date.parse(r.issuedAt)] as const));
  for (const r of rows) {
    const validUntil = Date.parse(r.validUntil);
    if (!Number.isFinite(validUntil)) continue;
    const interrupted = r.lifecycle === "interrupted";
    const successorIssued = r.supersededBy ? issuedByNumber.get(r.supersededBy.trim().toUpperCase()) : undefined;
    const until = interrupted
      ? Math.min(validUntil, successorIssued != null && Number.isFinite(successorIssued) ? successorIssued : nowMs)
      : validUntil;
    const issued = Date.parse(r.issuedAt);
    const from = Math.max(Number.isFinite(issued) ? issued : until - SOON_MS, startMs);
    const to = Math.min(until, endMs);
    if (to <= startMs || from >= endMs || to <= from) continue;
    const tone: WaybillCalendarTone = interrupted || until <= nowMs ? "expired" : until - nowMs <= SOON_MS ? "soon" : "active";
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

/* ---- Kalendārs v2 telefonā (makets ~/pz-mob-v2/3-kalendars.png): katrs numurs sava kartīte. ---- */

export type WaybillPlateCard = {
  plate: string;
  active: {
    id: string;
    brandModel: string;
    vin: string;
    /** "šodien, 18:00" / "rīt, 06:42" / "24.10., 03:54" */
    endsLabel: string;
    hoursLeft: number;
    /** 0..1 no 48 h (kā apļi). */
    share: number;
    tone: "ok" | "soon";
  } | null;
  /** Brīvam numuram: pēdējā beigusies pavadzīme. */
  last: { brandModel: string; endedLabel: string } | null;
};

type CardRow = Pick<IrissPavadzimeRecord, "id" | "number" | "brandModel" | "plate" | "issuedAt" | "validUntil" | "vin"> & {
  archived?: boolean;
  /** "interrupted" = pārtraukta (aizstāta) - vairs nav aktīva, lai gan termiņš vēl nav beidzies. */
  lifecycle?: string;
};

const RIGA_DT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function rigaParts(ms: number): { y: string; m: string; d: string; hm: string } {
  const p = Object.fromEntries(RIGA_DT.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: p.year ?? "", m: p.month ?? "", d: p.day ?? "", hm: `${p.hour}:${p.minute}` };
}

/** "šodien, 18:00", "rīt, 06:42" vai "24.10., 03:54" (Rīgas laiks). */
export function waybillEndsLabel(untilMs: number, nowMs: number): string {
  const u = rigaParts(untilMs);
  const key = (x: { y: string; m: string; d: string }) => `${x.y}-${x.m}-${x.d}`;
  if (key(u) === key(rigaParts(nowMs))) return `šodien, ${u.hm}`;
  if (key(u) === key(rigaParts(nowMs + DAY))) return `rīt, ${u.hm}`;
  return `${u.d}.${u.m}., ${u.hm}`;
}

const CARD_SCALE_MS = 48 * 3_600_000;

/** Katram tirdzniecības numuram: aktīvā pavadzīme (auto, VIN, beigas, atlikums) vai "brīvs" + pēdējā. */
export function waybillPlateCards(rows: readonly CardRow[], plates: readonly string[], nowMs: number): WaybillPlateCard[] {
  return plates.map((plate) => {
    const mine = rows
      .filter((r) => plateKey(r.plate).replace(/-/g, "") === plateKey(plate).replace(/-/g, ""))
      .map((r) => ({ r, until: Date.parse(r.validUntil) }))
      .filter((x) => Number.isFinite(x.until))
      .sort((a, b) => b.until - a.until);
    const live = mine.find(
      (x) =>
        x.until > nowMs &&
        !x.r.archived &&
        x.r.lifecycle !== "interrupted" &&
        (!Number.isFinite(Date.parse(x.r.issuedAt)) || Date.parse(x.r.issuedAt) <= nowMs),
    );
    if (live) {
      const leftMs = live.until - nowMs;
      return {
        plate,
        active: {
          id: live.r.id,
          brandModel: live.r.brandModel,
          vin: live.r.vin,
          endsLabel: waybillEndsLabel(live.until, nowMs),
          hoursLeft: Math.floor(leftMs / 3_600_000),
          share: Math.min(1, leftMs / CARD_SCALE_MS),
          tone: leftMs <= SOON_MS ? "soon" : "ok",
        },
        last: null,
      };
    }
    const prev = mine.find((x) => x.until <= nowMs);
    return {
      plate,
      active: null,
      last: prev ? { brandModel: prev.r.brandModel, endedLabel: waybillEndsLabel(prev.until, nowMs) } : null,
    };
  });
}

/** Beigušās pēdējās `days` dienās, pa dienām (jaunākā augšā). */
export function waybillExpiredByDay(
  rows: readonly CardRow[],
  nowMs: number,
  days = 7,
): Array<{ day: string; items: Array<{ id: string; plate: string; brandModel: string; time: string }> }> {
  const from = nowMs - days * DAY;
  const ended = rows
    .map((r) => ({ r, until: Date.parse(r.validUntil) }))
    .filter((x) => Number.isFinite(x.until) && x.until <= nowMs && x.until > from)
    .sort((a, b) => b.until - a.until);
  const out: Array<{ day: string; items: Array<{ id: string; plate: string; brandModel: string; time: string }> }> = [];
  for (const { r, until } of ended) {
    const p = rigaParts(until);
    const day = `${p.d}.${p.m}.${p.y}`;
    let group = out.find((g) => g.day === day);
    if (!group) {
      group = { day, items: [] };
      out.push(group);
    }
    group.items.push({ id: r.id, plate: r.plate, brandModel: r.brandModel, time: p.hm });
  }
  return out;
}
