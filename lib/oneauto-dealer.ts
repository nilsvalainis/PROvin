/**
 * OneAuto OEM dati → tā pati OFICIĀLĀ DĪLERA DATI forma kā Auto Records.
 */
import {
  normalizeAutoRecordsServiceWorkRow,
  sortAutoRecordsServiceWorkRows,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import {
  filledOneautoKvRows,
  filledOneautoServiceEvents,
  formatOneautoWorksText,
  normalizeOneautoDisplay,
  type OneautoDisplaySections,
  type OneautoKvRow,
  type OneautoServiceEvent,
} from "@/lib/oneauto-catalog";

export const OFFICIAL_DEALER_SECTION_TITLE = "OFICIĀLĀ DĪLERA DATI";

export const ONEAUTO_PDF_POWERTRAIN_TITLE = "Dzinēja / kārbas specifikācija";
export const ONEAUTO_PDF_EQUIPMENT_TITLE = "Gatavā komplektācija";

export function oneautoDisplayToServiceWorks(
  display: OneautoDisplaySections | null | undefined,
): AutoRecordsServiceWorkRow[] {
  const rows = filledOneautoServiceEvents(display?.serviceTimeline ?? []).map((ev) =>
    normalizeAutoRecordsServiceWorkRow({
      date: ev.date,
      odometer: ev.odometer,
      location: ev.place,
      works: formatOneautoWorksText(ev.works),
    }),
  );
  return sortAutoRecordsServiceWorkRows(rows);
}

export function applyOneautoTranslatedDisplay(
  current: OneautoDisplaySections,
  incoming: OneautoDisplaySections,
): OneautoDisplaySections {
  const next = normalizeOneautoDisplay(incoming);
  const curPower = filledOneautoKvRows(current.powertrain);
  const curEquip = filledOneautoKvRows(current.equipment);
  const curSvc = filledOneautoServiceEvents(current.serviceTimeline);
  return {
    powertrain: mergeTranslatedKv(curPower, next.powertrain),
    equipment: mergeTranslatedKv(curEquip, next.equipment),
    serviceTimeline: mergeTranslatedService(curSvc, next.serviceTimeline),
  };
}

function mergeTranslatedKv(current: OneautoKvRow[], incoming: OneautoKvRow[]): OneautoKvRow[] {
  if (incoming.length === 0) return current;
  return current.map((row, i) => {
    const hit = incoming[i];
    if (!hit) return row;
    return {
      label: hit.label.trim() || row.label,
      value: hit.value.trim() || row.value,
    };
  });
}

function mergeTranslatedService(
  current: OneautoServiceEvent[],
  incoming: OneautoServiceEvent[],
): OneautoServiceEvent[] {
  if (incoming.length === 0) return current;
  return current.map((row, i) => {
    const hit = incoming[i];
    if (!hit) return row;
    return {
      date: row.date,
      odometer: row.odometer,
      place: hit.place.trim() || row.place,
      works: hit.works.trim() || row.works,
    };
  });
}

export function parseOneautoTranslateDisplay(raw: unknown): OneautoDisplaySections | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const display = normalizeOneautoDisplay({
    equipment: Array.isArray(o.equipment) ? (o.equipment as OneautoKvRow[]) : [],
    serviceTimeline: Array.isArray(o.serviceTimeline) ? (o.serviceTimeline as OneautoServiceEvent[]) : [],
    powertrain: Array.isArray(o.powertrain) ? (o.powertrain as OneautoKvRow[]) : [],
  });
  if (
    display.equipment.length === 0 &&
    display.powertrain.length === 0 &&
    display.serviceTimeline.length === 0
  ) {
    return null;
  }
  return display;
}
