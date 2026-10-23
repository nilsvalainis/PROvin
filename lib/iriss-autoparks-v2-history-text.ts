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
};

/** Vēstures rinda tekstā: lauks un "no -> uz" (tukšs = "-"). */
export function v2HistoryText(row: V2HistoryRow, value: (v: string) => string = (v) => v): { field: string; change: string } {
  const label = FIELD_LV[row.field] ?? row.field;
  const show = (v: string) => (v ? value(v) : "-");
  return { field: row.undoOf ? `${label} (atsaukts)` : label, change: `${show(row.from)} -> ${show(row.to)}` };
}

export function registerV2HistoryLabels(labels: Record<string, string>): void {
  Object.assign(FIELD_LV, labels);
}
