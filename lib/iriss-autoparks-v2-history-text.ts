import type { V2HistoryRow } from "@/lib/iriss-autoparks-v2";

const FIELD_LV: Record<string, string> = {
  status: "Statuss",
  plate: "Numurzīme",
  location: "Atrašanās vieta",
  arrivedAt: "Atvests",
  "tech.tyreSize": "Riepas",
  "tech.firstRegDate": "1. reģistrācija",
  "tech.displacementCm3": "Tilpums",
  "tech.powerKw": "Jauda",
  "purchase.auction": "Izsole",
  "purchase.auctionNo": "Izsoles nr.",
  "purchase.purchaseDate": "Pirkuma datums",
  "purchase.vat": "PVN režīms",
  "purchase.purchasePriceEur": "Iepirkuma cena",
  "purchase.transportEur": "Transports",
};

/** Vēstures rinda tekstā: lauks un "no -> uz" (tukšs = "-"). */
export function v2HistoryText(row: V2HistoryRow, value: (v: string, field: string) => string = (v) => v): { field: string; change: string } {
  const label = FIELD_LV[row.field] ?? row.field;
  const show = (v: string) => (v ? value(v, row.field) : "-");
  return { field: row.undoOf ? `${label} (atsaukts)` : label, change: `${show(row.from)} -> ${show(row.to)}` };
}

/** Vēstures rinda daļās (makets "Vēsture", Nils 27.10): vecā vērtība pārsvītrota -> jaunā; tukšs = "". */
export function v2HistoryParts(
  row: V2HistoryRow,
  value: (v: string, field: string) => string = (v) => v,
): { field: string; from: string; to: string } {
  const { field } = v2HistoryText(row, value);
  return { field, from: row.from ? value(row.from, row.field) : "", to: row.to ? value(row.to, row.field) : "" };
}

const rigaDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Riga" });

/** Grupas pa dienām (Rīgas laiks), jaunākās augšā: "Šodien", "Vakar", "24.10.2026". */
export function groupV2HistoryByDay(
  rows: readonly V2HistoryRow[],
  now: Date = new Date(),
): Array<{ label: string; rows: V2HistoryRow[] }> {
  const today = rigaDay(now.toISOString());
  const yesterday = rigaDay(new Date(now.getTime() - 86_400_000).toISOString());
  const out: Array<{ label: string; day: string; rows: V2HistoryRow[] }> = [];
  for (const r of [...rows].sort((a, b) => b.at.localeCompare(a.at))) {
    const day = rigaDay(r.at);
    let g = out.find((x) => x.day === day);
    if (!g) {
      const label = day === today ? "Šodien" : day === yesterday ? "Vakar" : day.split("-").reverse().join(".");
      g = { label, day, rows: [] };
      out.push(g);
    }
    g.rows.push(r);
  }
  return out.map(({ label, rows: rs }) => ({ label, rows: rs }));
}

export function registerV2HistoryLabels(labels: Record<string, string>): void {
  Object.assign(FIELD_LV, labels);
}
