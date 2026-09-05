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

const FOREIGN_WORKS_RE =
  /\b(the|and|acc\.?|according|software|download|install|sides|fitting|executed|upgrade|workshop|remark|remarks|warranty|inspection|engine|oil|filter|change|performed|latest|already|contained|bij|het|van|dat|aan|uitgevoerd|mvg|nieuwste|geeft|actie|acit|service)\b/i;

/** Vai „Darbi” teksts vēl jāpārtulko latviski. */
export function oneautoWorksNeedLvTranslation(works: string): boolean {
  const t = works.replace(/\s+/g, " ").trim();
  if (t.length < 3) return false;
  if (FOREIGN_WORKS_RE.test(t)) return true;
  return false;
}

export function oneautoDisplayWorksNeedLvTranslation(
  display: OneautoDisplaySections | null | undefined,
): boolean {
  return filledOneautoServiceEvents(display?.serviceTimeline ?? []).some((ev) =>
    oneautoWorksNeedLvTranslation(ev.works),
  );
}

export function applyOneautoTranslatedWorks(
  current: OneautoDisplaySections,
  works: readonly string[],
): OneautoDisplaySections {
  const events = filledOneautoServiceEvents(current.serviceTimeline);
  return {
    ...current,
    serviceTimeline: events.map((ev, i) => ({
      ...ev,
      works: (works[i] ?? "").trim() || ev.works,
    })),
  };
}

export function parseOneautoWorksTranslatePayload(raw: unknown): string[] | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.works)) {
    const works = o.works.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
    return works.length > 0 ? works : null;
  }
  const display = parseOneautoTranslateDisplay(raw);
  if (!display) return null;
  const works = filledOneautoServiceEvents(display.serviceTimeline).map((ev) => ev.works.trim());
  return works.some(Boolean) ? works : null;
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
