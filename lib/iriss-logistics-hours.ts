import type { LogisticsHoursSlot } from "@/lib/iriss-logistics-types";

const DAY_ALIAS: Record<string, string> = {
  p: "1",
  pi: "1",
  pr: "1",
  o: "2",
  ot: "2",
  t: "3",
  tr: "3",
  c: "4",
  ce: "4",
  pk: "5",
  piektdiena: "5",
  s: "6",
  se: "6",
  sv: "7",
};

function dayToken(raw: string): string | null {
  const k = raw.trim().toLowerCase().replace(/\./g, "");
  if (/^[1-7]$/.test(k)) return k;
  return DAY_ALIAS[k] ?? null;
}

function parseDayRange(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return "";
  const range = t.split(/[-]|[\u2013\u2014]/);
  if (range.length === 2) {
    const a = dayToken(range[0] ?? "");
    const b = dayToken(range[1] ?? "");
    if (a && b) return `${a}-${b}`;
  }
  const one = dayToken(t);
  return one ?? t;
}

function parseTime(raw: string): string | undefined {
  const m = raw.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return undefined;
  const h = Number.parseInt(m[1] ?? "", 10);
  const min = Number.parseInt(m[2] ?? "", 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "P-Pk 07:00-15:30" / "P-Pk 08:00-11:45, 12:30-16:00" -> slots + display text. */
export function parseLogisticsHoursText(raw: string): { hours: LogisticsHoursSlot[]; hoursText: string } {
  const hoursText = raw.replace(/\s+/g, " ").trim();
  if (!hoursText || /nav norād/i.test(hoursText)) return { hours: [], hoursText };

  const hours: LogisticsHoursSlot[] = [];
  const dayPart = hoursText.match(/^(p(?:r)?\s*-\s*pk|p-pk|[1-7]\s*-\s*[1-7]|[poctkšsv.]+(?:\s*-\s*[poctkšsv.]+)?)/i);
  const days = parseDayRange(dayPart?.[1] ?? "1-5");
  const timeChunks = hoursText.match(/\d{1,2}[:.]\d{2}\s*-\s*\d{1,2}[:.]\d{2}/g) ?? [];
  for (const chunk of timeChunks) {
    const [fromRaw, toRaw] = chunk.split("-");
    const from = parseTime(fromRaw ?? "");
    const to = parseTime(toRaw ?? "");
    if (from || to) hours.push({ days, ...(from ? { from } : {}), ...(to ? { to } : {}) });
  }
  return { hours, hoursText };
}

export function formatLogisticsHours(hours: readonly LogisticsHoursSlot[], fallback = ""): string {
  if (!hours.length) return fallback;
  return hours
    .map((slot) => {
      const days = slot.days === "1-5" ? "P-Pk" : slot.days;
      if (slot.from && slot.to) return `${days} ${slot.from}-${slot.to}`;
      if (slot.to) return `${days} līdz ${slot.to}`;
      return days;
    })
    .join(", ");
}
