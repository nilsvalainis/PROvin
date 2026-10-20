import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import type { ClientManualVendorBlockPdf } from "@/lib/admin-source-blocks";
import type { CarVerticalTimelineRow } from "@/lib/carvertical-pdf-parse";

/** AutoDNA-style long Laikposma texts that currently overflow the 10rem title column. */
export const LONG_TIMELINE_BODY_A =
  "Transportlīdzekļa reģistrācijas dati atjaunoti pēc īpašnieka maiņas un tehniskās dokumentācijas pārbaudes valsts reģistrā, ieskaitot iepriekšējās piezīmes un apdrošināšanas polisi";

export const LONG_TIMELINE_BODY_B =
  "Apdrošināšanas polisi anulēta pēc īpašnieka maiņas, transportlīdzeklis reģistrēts jaunā īpašnieka vārdā ar atjaunotu dokumentāciju";

export const LONG_TIMELINE_ROWS: CarVerticalTimelineRow[] = [
  {
    date: "12.05.2018",
    country: "Vācija",
    description: "Pirmā reģistrācija",
    odometer: "14",
    includeInPdf: true,
  },
  {
    date: "03.09.2021",
    country: "Francija",
    description: "Cesija",
    includeInPdf: true,
  },
  {
    date: "18.11.2022",
    country: "Vācija",
    description: "Tehniskā apskate: izturēta",
    odometer: "84200",
    includeInPdf: true,
  },
  {
    date: "04.03.2024",
    country: "Nīderlande",
    description: LONG_TIMELINE_BODY_A,
    odometer: "118400",
    includeInPdf: true,
  },
  {
    date: "21.06.2024",
    country: "Polija",
    description: LONG_TIMELINE_BODY_B,
    odometer: "126850",
    includeInPdf: true,
  },
  {
    date: "02.09.2026",
    country: "Latvija",
    description: "Pārdošanai piedāvātas automašīnas (18 900 EUR)",
    odometer: "131200",
    includeInPdf: true,
  },
];

export function longTimelineEntriesVendorBlock(): ClientManualVendorBlockPdf {
  return {
    title: SOURCE_BLOCK_LABELS.autodna,
    mileageRows: [],
    incidentRows: [],
    comments: "",
    vehicleHistoryTimeline: LONG_TIMELINE_ROWS,
  };
}
