/**
 * Valstu pierādījumi no jau aizpildītajiem avotiem (CSDD, LTAB, AutoDNA, CarVertical, citi).
 *
 * Tos izmanto kā papildu „laikposmu”, lai aizpildītu tukšās valsts kolonnas jaunā PDF rindām,
 * kad pati atskaite valsti nenorāda (piem. CarVertical odometra tabula).
 */

import {
  ltabRowHasData,
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import type { CountryTimelineEntry } from "@/lib/vehicle-country-timeline";

export function collectWorkspaceCountryTimeline(
  blocks: WorkspaceSourceBlocks,
): CountryTimelineEntry[] {
  const b = mergeSourceBlocksWithDefaults(blocks);
  const out: CountryTimelineEntry[] = [];

  const push = (date: string, country: string) => {
    const d = date.trim();
    const c = normalizeCountryNameLv(country.trim()) || country.trim();
    if (!d || !c || /nezināma/i.test(c)) return;
    out.push({ date: d, country: c });
  };

  const citi = b.citi_avoti.sections[0];
  const mileageRows = [
    ...b.autodna.serviceHistory,
    ...b.carvertical.serviceHistory,
    ...b.auto_records.serviceHistory,
    ...(citi?.serviceHistory ?? []),
    ...(b.csdd.mileageHistory ?? []),
    ...(b.tjekbil.mileage ?? []),
    ...(b.mnt_ee.mileage ?? []),
    ...(b.lkf_ee.mileage ?? []),
    ...(b.carinfo.mileage ?? []),
  ];
  for (const r of mileageRows) push(r.date, r.country);

  const incidentRows = [
    ...b.autodna.incidents,
    ...b.carvertical.incidents,
    ...b.ltab.rows,
    ...(citi?.incidents ?? []),
  ].filter(ltabRowHasData);
  for (const r of incidentRows) push(r.csngDate, r.incidentNo);

  return out;
}
