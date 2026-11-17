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
  mainPhoto: "Galvenā bilde",
  vin: "VIN",
  make: "Marka",
  model: "Modelis",
  year: "Gads",
  color: "Krāsa",
  owner: "Īpašnieks",
  clientOrder: "Pasūtījums",
  "tech.mileageKm": "Nobraukums",
  "tech.engine": "Dzinējs",
  "tech.gearbox": "Pārnesumkārba",
  "priceSheet.displayName": "Cenu lapa · nosaukums",
  "priceSheet.equipmentLine": "Cenu lapa · aprīkojums",
  "priceSheet.listPriceEur": "Cenu lapa · cena",
  "priceSheet.salePriceEur": "Pārdošanas cena",
  "service.invoice": "Servisa rēķins",
  "service.invoice.amount": "Servisa rēķina summa",
  "service.invoice.pages": "Servisa rēķina lapas",
  "service.problem": "Problēma",
  "service.problem.fixed": "Problēma salabota",
  "service.problem.confirmed": "Problēma apstiprināta",
  "service.problem.photo": "Problēmas foto",
  "service.notes": "Servisa piezīmes",
  "service.diag": "CSDD diagnostika",
  "service.numberCheck": "Numuru akts",
};

/**
 * Nils 27.10: cenas Autoparkā pagaidām nerāda (izņemot servisa rēķina summu un cenu lapas cenu) -
 * arī Vēsturē šīs rindas netiek rādītas.
 */
const HIDDEN_FIELDS = new Set(["purchase.purchasePriceEur", "purchase.transportEur", "expense", "expense.amount", "expense.date", "expense.text"]);

export function v2HistoryVisible(row: V2HistoryRow): boolean {
  return !HIDDEN_FIELDS.has(row.field);
}

const group3 = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Vērtības formāts pēc lauka: datumi dd.mm.gggg, km, kW, cm³; bildes id netiek rādīts. */
export function v2HistoryFormat(v: string, field: string): string {
  if (field === "mainPhoto") return "nomainīta";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join(".");
  const n = Number(v);
  if (v.trim() && Number.isFinite(n)) {
    if (field === "tech.mileageKm") return `${group3(n)} km`;
    if (field === "tech.powerKw") return `${group3(n)} kW`;
    if (field === "tech.displacementCm3") return `${group3(n)} cm³`;
    if (/Eur$|\.amount$/.test(field)) return `${n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
  }
  return v;
}

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
  if (row.field === "mainPhoto") return { field, from: "", to: "nomainīta" };
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
