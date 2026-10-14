import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import type { ClientManualVendorBlockPdf } from "@/lib/admin-source-blocks";
import type { CarVerticalTimelineRow } from "@/lib/carvertical-pdf-parse";

/**
 * Auto listed for sale in DE, NL and PL around the same time.
 * Advertising in several countries is not a registration / physical move.
 */
export const SIMULTANEOUS_DE_NL_PL_LISTING_ROWS: CarVerticalTimelineRow[] = [
  {
    date: "01.06.2018",
    country: "Vācija",
    description: "Pirmā reģistrācija",
    odometer: "12",
    includeInPdf: true,
  },
  {
    date: "15.03.2024",
    country: "Vācija",
    description: "Pārdošanai piedāvātas automašīnas (12 500 EUR)",
    odometer: "148200",
    includeInPdf: true,
  },
  {
    date: "18.03.2024",
    country: "Nīderlande",
    description: "Pārdošanai piedāvātas automašīnas (12 200 EUR)",
    odometer: "148350",
    includeInPdf: true,
  },
  {
    date: "20.03.2024",
    country: "Polija",
    description: "Pārdošanai piedāvātas automašīnas (11 900 EUR)",
    odometer: "148410",
    includeInPdf: true,
  },
  {
    date: "01.06.2024",
    country: "Latvija",
    description: "Reģistrēts",
    includeInPdf: true,
  },
];

export function simultaneousDeNlPlListingVendorBlock(): ClientManualVendorBlockPdf {
  return {
    title: SOURCE_BLOCK_LABELS.autodna,
    mileageRows: [],
    incidentRows: [],
    comments: "",
    vehicleHistoryTimeline: SIMULTANEOUS_DE_NL_PL_LISTING_ROWS,
  };
}
