/**
 * PVN/CSDD termiņu kalendārs (`data/termini-kalendars.json`) un atgādinājumu loģika.
 * Tīras funkcijas: datumi Rīgas kalendārā, bez I/O.
 */
import type { AdminPushMessage } from "@/lib/admin-push-shared";
import { rigaCalendarDayKey } from "@/lib/admin-riga-calendar";
import type { CronNotifyEntries } from "@/lib/cron-notify-entries";

export type TerminsKind = "pvn" | "vid" | "csdd" | "cits";

export type TerminiKalendars = {
  monthly?: Array<{ id: string; kind: TerminsKind; day: number; title: string }>;
  yearly?: Array<{ id: string; kind: TerminsKind; month: number; day: number; title: string }>;
  once?: Array<{ id: string; kind: TerminsKind; date: string; title: string }>;
};

export type TerminsOccurrence = { id: string; kind: TerminsKind; title: string; date: string };

/** Atgādinājumi 7, 3 un 1 dienu pirms termiņa. */
export const TERMINI_REMIND_DAYS = [7, 3, 1] as const;

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Ja mēnesī nav tādas dienas (piem. 31.), ņem pēdējo mēneša dienu. */
function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round((keyToUtcMs(toKey) - keyToUtcMs(fromKey)) / DAY_MS);
}

/** Termiņi no šodienas (Rīga) līdz `horizonDays` dienām uz priekšu. */
export function upcomingTermini(cal: TerminiKalendars, nowMs: number, horizonDays = 8): TerminsOccurrence[] {
  const today = rigaCalendarDayKey(nowMs);
  const [ty, tm] = today.split("-").map(Number) as [number, number];
  const months = [0, 1].map((k) => {
    const idx = ty * 12 + (tm - 1) + k;
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
  });
  const out: TerminsOccurrence[] = [];
  const push = (o: TerminsOccurrence) => {
    const d = daysBetweenKeys(today, o.date);
    if (d >= 0 && d <= horizonDays) out.push(o);
  };
  for (const t of cal.monthly ?? []) {
    if (!(t.day >= 1 && t.day <= 31)) continue;
    for (const { year, month } of months) push({ id: t.id, kind: t.kind, title: t.title, date: dateKey(year, month, t.day) });
  }
  for (const t of cal.yearly ?? []) {
    if (!(t.month >= 1 && t.month <= 12 && t.day >= 1 && t.day <= 31)) continue;
    for (const year of [ty, ty + 1]) push({ id: t.id, kind: t.kind, title: t.title, date: dateKey(year, t.month, t.day) });
  }
  for (const t of cal.once ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    push({ id: t.id, kind: t.kind, title: t.title, date: t.date });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export type TerminsReminder = TerminsOccurrence & { daysLeft: number; bucket: number; key: string };

/**
 * Kuri atgādinājumi jāsūta šodien. Ja cron kādu dienu nokavēja, tuvākais neizsūtītais
 * slieksnis (7/3/1) tiek izsūtīts nākamajā palaišanā; katrs slieksnis tikai vienreiz.
 */
export function dueTerminiReminders(
  cal: TerminiKalendars,
  sent: CronNotifyEntries,
  nowMs: number,
): TerminsReminder[] {
  const today = rigaCalendarDayKey(nowMs);
  const out: TerminsReminder[] = [];
  for (const o of upcomingTermini(cal, nowMs)) {
    const daysLeft = daysBetweenKeys(today, o.date);
    if (daysLeft < 1) continue;
    const bucket = [...TERMINI_REMIND_DAYS].sort((a, b) => a - b).find((t) => daysLeft <= t);
    if (bucket === undefined) continue;
    const key = `${o.id}:${o.date}:${bucket}`;
    if (sent[key]) continue;
    out.push({ ...o, daysLeft, bucket, key });
  }
  return out;
}

function formatLvDate(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}.${m}.${y}`;
}

const KIND_LABEL: Record<TerminsKind, string> = { pvn: "PVN", vid: "VID", csdd: "CSDD", cits: "Termiņš" };

export function adminPushTerminsMessage(r: TerminsReminder): AdminPushMessage {
  const when = r.daysLeft === 1 ? "rīt" : `pēc ${r.daysLeft} dienām`;
  return {
    title: `${KIND_LABEL[r.kind] ?? "Termiņš"} termiņš ${when}`,
    body: `${r.title} - ${formatLvDate(r.date)}`,
    url: "/admin",
    tag: `termins-${r.id}-${r.date}`,
    audience: "pro",
  };
}
