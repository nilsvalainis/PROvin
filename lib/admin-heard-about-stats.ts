/** „Kur uzzināja” statistika (agrāk rindiņa pasūtījumu sarakstā; tagad Statistikas kartē). */

export type HeardAboutOrder = {
  id: string;
  /** Unix sekundes. */
  created: number;
  heardAbout: string | null | undefined;
  label: string;
  amountTotal: number | null;
};

export type HeardAboutPeriod = "7" | "30" | "90" | "all";

export const HEARD_ABOUT_PERIODS: ReadonlyArray<{ id: HeardAboutPeriod; label: string }> = [
  { id: "7", label: "7 d" },
  { id: "30", label: "30 d" },
  { id: "90", label: "90 d" },
  { id: "all", label: "Viss" },
];

export type HeardAboutRow = { label: string; count: number; share: number; orders: HeardAboutOrder[] };

/** Tā pati loģika kā agrāk: tukšs avots neskaitās; kārtība pēc skaita, tad pēc nosaukuma (lv). Daļa = no pasūtījumiem ar avotu. */
export function computeHeardAboutStats(
  orders: readonly HeardAboutOrder[],
  period: HeardAboutPeriod,
  nowSec: number,
): { rows: HeardAboutRow[]; total: number; withoutSource: number } {
  const since = period === "all" ? Number.NEGATIVE_INFINITY : nowSec - Number(period) * 86_400;
  const map = new Map<string, HeardAboutOrder[]>();
  let withoutSource = 0;
  for (const o of orders) {
    if (o.created < since) continue;
    const label = o.heardAbout?.trim();
    if (!label) {
      withoutSource += 1;
      continue;
    }
    const list = map.get(label) ?? [];
    list.push(o);
    map.set(label, list);
  }
  const total = [...map.values()].reduce((n, l) => n + l.length, 0);
  const rows = [...map.entries()]
    .map(([label, list]) => ({
      label,
      count: list.length,
      share: total > 0 ? list.length / total : 0,
      orders: [...list].sort((a, b) => b.created - a.created),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "lv"));
  return { rows, total, withoutSource };
}
