/**
 * Statistikas periods no URL: `bp=YYYY-MM` (mēnesis, noklusējums - šis), `bp=all` (viss laiks),
 * `bpFrom` + `bpTo` (YYYY-MM-DD, savs intervāls).
 */

/** Pogas uzskaite sākās 05.11.2026; agrāk klikšķu nav (pirkumi no Stripe ir). */
export const BUSINESS_POGA_START = "2026-11-05";

export type BusinessPogaPeriod = {
  kind: "month" | "all" | "custom";
  from: string;
  to: string;
  label: string;
  month?: string;
  prevMonth?: string;
  nextMonth?: string | null;
};

const MONTHS_LV = ["Janvāris", "Februāris", "Marts", "Aprīlis", "Maijs", "Jūnijs", "Jūlijs", "Augusts", "Septembris", "Oktobris", "Novembris", "Decembris"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(m: string, d: number): string {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const t = new Date(Date.UTC(y, mo - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDay(m: string): string {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
}

export function monthLabelLv(m: string): string {
  return `${MONTHS_LV[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}

function fmt(d: string): string {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
}

export function parseBusinessPogaPeriod(
  sp: Record<string, string | string[] | undefined>,
  today: string,
): BusinessPogaPeriod {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const bp = one("bp");
  const from = one("bpFrom");
  const to = one("bpTo");
  if (DATE_RE.test(from) && DATE_RE.test(to) && from <= to) {
    return { kind: "custom", from, to, label: `${fmt(from)} - ${fmt(to)}` };
  }
  if (bp === "all") return { kind: "all", from: BUSINESS_POGA_START, to: today, label: "Viss laiks" };
  const thisMonth = today.slice(0, 7);
  const month = MONTH_RE.test(bp) && bp <= thisMonth ? bp : thisMonth;
  const next = shiftMonth(month, 1);
  return {
    kind: "month",
    month,
    from: `${month}-01`,
    to: month === thisMonth ? today : lastDay(month),
    label: monthLabelLv(month),
    prevMonth: shiftMonth(month, -1),
    nextMonth: next <= thisMonth ? next : null,
  };
}
