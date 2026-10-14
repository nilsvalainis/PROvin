/**
 * ✨ konteksts: laikposma sludinājumu valstis nav fiziska pārvietošanās.
 */
import {
  carVerticalTimelineRowHasData,
  type CarVerticalTimelineRow,
} from "@/lib/carvertical-pdf-parse";
import {
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { isVendorTimelineListingRecord } from "@/lib/vendor-timeline-listing";

function listingCountriesFromRows(rows: CarVerticalTimelineRow[] | undefined): string[] {
  const out: string[] = [];
  for (const r of rows ?? []) {
    if (!carVerticalTimelineRowHasData(r) || !isVendorTimelineListingRecord(r.description)) continue;
    const c = normalizeCountryNameLv(r.country.trim()) || r.country.trim();
    if (!c || /nezināma/i.test(c) || out.includes(c)) continue;
    out.push(c);
  }
  return out;
}

export function buildListingNotCountryChangeBrief(blocks: WorkspaceSourceBlocks): string {
  const b = mergeSourceBlocksWithDefaults(blocks);
  const countries: string[] = [];
  const add = (names: string[]) => {
    for (const n of names) if (!countries.includes(n)) countries.push(n);
  };
  add(listingCountriesFromRows(b.autodna.vehicleHistoryTimeline));
  add(listingCountriesFromRows(b.carvertical.vehicleHistoryTimeline));
  for (const section of b.citi_avoti.sections ?? []) {
    add(listingCountriesFromRows(section.vehicleHistoryTimeline));
  }
  if (countries.length === 0) return "";
  return [
    "### Sludinājumu valstis nav fiziska pārvietošanās (deterministisks — NEIZDOMĀ pretējo)",
    `- Laikposma ieraksti ar sludinājuma / izsoles / vēsturiskās cenas tekstu (${countries.join(", ")}) NAV reģistrācijas vai robežšķērsošanas pierādījums.`,
    "- Auto var būt reklamēts vairākās valstīs vienlaikus. NERAKSTI, ka auto braucis no valsts uz valsti pēc šiem ierakstiem.",
    "- Valstu maiņu ņem tikai no reģistrācijas, īpašnieka maiņas, tehniskās apskates vai cita oficiāla reģistra notikuma.",
  ].join("\n");
}
