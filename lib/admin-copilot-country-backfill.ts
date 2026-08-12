/**
 * Copilot — loģiska tukšo valstu aizpilde tabulās no visu avotu pierādījumiem
 * (tabulas + RAW). Tikai 100% sakritība (datums+km / datums+zaudējums) — bez improvizācijas.
 */
import {
  emptyVendorAvotuBlock,
  ltabRowHasData,
  mergeSourceBlocksWithDefaults,
  type LtabIncidentRow,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  autoRecordsMileageRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { parseAutodnaDamageEvents } from "@/lib/autodna-damage-parse";
import { parseAutodnaMileagePaste } from "@/lib/autodna-mileage-paste-parse";
import { inferOdometerCountriesFromTimeline, parseCarverticalPdfText } from "@/lib/carvertical-pdf-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { parseHistoryVendorPdfText } from "@/lib/history-vendor-pdf-import";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";
import type { CopilotSourceKey } from "@/lib/admin-copilot-types";

export type CountryEvidenceMaps = {
  byIncident: Map<string, string>;
  byMileage: Map<string, string>;
};

function normDateKey(raw: string): string {
  return formatAutoRecordsDateForOutput(raw.trim()) || raw.trim();
}

function normLossKey(raw: string): string {
  const t = normalizeLossAmountEurDisplay(raw.trim()) || raw.trim();
  return t.replace(/\s+/g, " ").toLowerCase();
}

function normOdoKey(raw: string): string {
  return normalizeAutoRecordsOdometer(raw.trim()) || raw.replace(/\D/g, "");
}

function normCountry(raw: string): string {
  return normalizeCountryNameLv(raw.trim()) || raw.trim();
}

function incidentEventKey(date: string, loss: string): string {
  return `${normDateKey(date)}|${normLossKey(loss)}`;
}

function mileageEventKey(date: string, odo: string): string {
  return `${normDateKey(date)}|${normOdoKey(odo)}`;
}

function createCountryEvidenceCollector(): {
  maps: CountryEvidenceMaps;
  addIncident: (date: string, loss: string, country: string) => void;
  addMileage: (date: string, odo: string, country: string) => void;
} {
  const byIncident = new Map<string, string>();
  const byMileage = new Map<string, string>();
  const incidentConflict = new Set<string>();
  const mileageConflict = new Set<string>();

  const addIncident = (date: string, loss: string, country: string) => {
    const c = normCountry(country);
    if (!c || !date) return;
    const key = incidentEventKey(date, loss);
    if (incidentConflict.has(key)) return;
    const prev = byIncident.get(key);
    if (prev && prev !== c) {
      byIncident.delete(key);
      incidentConflict.add(key);
      return;
    }
    byIncident.set(key, c);
  };

  const addMileage = (date: string, odo: string, country: string) => {
    const c = normCountry(country);
    if (!c || !date || !odo) return;
    const key = mileageEventKey(date, odo);
    if (mileageConflict.has(key)) return;
    const prev = byMileage.get(key);
    if (prev && prev !== c) {
      byMileage.delete(key);
      mileageConflict.add(key);
      return;
    }
    byMileage.set(key, c);
  };

  return { maps: { byIncident, byMileage }, addIncident, addMileage };
}

function ingestRawTextEvidence(raw: string, addIncident: (d: string, l: string, c: string) => void, addMileage: (d: string, o: string, c: string) => void) {
  const t = raw.trim();
  if (!t) return;

  for (const r of parseAutodnaMileagePaste(t)) {
    if (r.country.trim()) addMileage(r.date, r.odometer, r.country);
  }
  for (const r of parseAutodnaDamageEvents(t)) {
    if (r.incidentNo.trim()) addIncident(r.csngDate, r.lossAmount, r.incidentNo);
  }

  const cv = parseCarverticalPdfText(t);
  for (const r of cv.serviceHistory) {
    if (r.country.trim()) addMileage(r.date, r.odometer, r.country);
  }
  for (const r of cv.incidents) {
    if (r.incidentNo.trim()) addIncident(r.csngDate, r.lossAmount, r.incidentNo);
  }

  for (const target of ["autodna", "carvertical", "ltab"] as const) {
    const parsed = parseHistoryVendorPdfText(target, t);
    for (const r of parsed.serviceHistory) {
      if (r.country.trim()) addMileage(r.date, r.odometer, r.country);
    }
    for (const r of parsed.incidents) {
      if (r.incidentNo.trim()) addIncident(r.csngDate, r.lossAmount, r.incidentNo);
    }
  }
}

/** Visi avoti + RAW — kopīgs pierādījumu baseins valstīm. */
export function collectCountryEvidenceFromBlocks(blocks: WorkspaceSourceBlocks): CountryEvidenceMaps {
  const { maps, addIncident, addMileage } = createCountryEvidenceCollector();
  const b = mergeSourceBlocksWithDefaults(blocks);

  const ingestIncidents = (rows: LtabIncidentRow[]) => {
    for (const r of rows.filter(ltabRowHasData)) {
      if (r.incidentNo.trim()) addIncident(r.csngDate, r.lossAmount, r.incidentNo);
    }
  };
  const ingestMileage = (rows: AutoRecordsServiceRow[]) => {
    for (const r of rows) {
      if (!autoRecordsMileageRowHasData(r) && !(r.date.trim() && r.odometer === "0")) continue;
      if (r.country.trim()) addMileage(r.date, r.odometer, r.country);
    }
  };

  ingestIncidents(b.autodna.incidents);
  ingestIncidents(b.carvertical.incidents);
  ingestIncidents(b.ltab.rows);
  ingestMileage(b.autodna.serviceHistory);
  ingestMileage(b.carvertical.serviceHistory);
  ingestMileage(b.auto_records.serviceHistory);
  ingestMileage(b.csdd.mileageHistory);

  const citi0 = b.citi_avoti.sections[0];
  if (citi0) {
    ingestIncidents(citi0.incidents);
    ingestMileage(citi0.serviceHistory);
  }

  ingestRawTextEvidence(b.autodna.mileagePasteRaw ?? "", addIncident, addMileage);
  ingestRawTextEvidence(b.autodna.geminiContextRaw ?? "", addIncident, addMileage);
  ingestRawTextEvidence(b.carvertical.mileagePasteRaw ?? "", addIncident, addMileage);
  ingestRawTextEvidence(b.carvertical.geminiContextRaw ?? "", addIncident, addMileage);
  ingestRawTextEvidence(b.ltab.pdfImportRaw ?? "", addIncident, addMileage);
  ingestRawTextEvidence(b.ltab.geminiContextRaw ?? "", addIncident, addMileage);
  ingestRawTextEvidence(b.auto_records.rawUnprocessedData ?? "", addIncident, addMileage);
  ingestRawTextEvidence(b.auto_records.geminiContextRaw ?? "", addIncident, addMileage);
  ingestRawTextEvidence(b.csdd.rawUnprocessedData ?? "", addIncident, addMileage);
  ingestRawTextEvidence(b.csdd.geminiContextRaw ?? "", addIncident, addMileage);
  if (citi0) {
    ingestRawTextEvidence(citi0.rawUnprocessedData ?? "", addIncident, addMileage);
    ingestRawTextEvidence(citi0.geminiContextRaw ?? "", addIncident, addMileage);
  }

  return maps;
}

function fillIncidentRows(rows: LtabIncidentRow[], maps: CountryEvidenceMaps): { rows: LtabIncidentRow[]; filled: number } {
  let filled = 0;
  const next = rows.map((r) => {
    if (!ltabRowHasData(r) || r.incidentNo.trim()) return r;
    const c = maps.byIncident.get(incidentEventKey(r.csngDate, r.lossAmount));
    if (!c) return r;
    filled += 1;
    return { ...r, incidentNo: c };
  });
  return { rows: next, filled };
}

function fillMileageRows(rows: AutoRecordsServiceRow[], maps: CountryEvidenceMaps): { rows: AutoRecordsServiceRow[]; filled: number } {
  let filled = 0;
  const next = rows.map((r) => {
    const hasData = autoRecordsMileageRowHasData(r) || (r.date.trim() && r.odometer === "0");
    if (!hasData || r.country.trim()) return r;
    const c = maps.byMileage.get(mileageEventKey(r.date, r.odometer));
    if (!c) return r;
    filled += 1;
    return { ...r, country: c };
  });
  return { rows: next, filled };
}

/**
 * Aizpilda tukšos Valsts laukus visās avotu tabulās, ja cits avots / RAW
 * apstiprina to pašu notikumu (datums+km vai datums+zaudējums).
 */
export function backfillEmptyCountriesInBlocks(blocks: WorkspaceSourceBlocks): {
  blocks: WorkspaceSourceBlocks;
  filledIncidents: number;
  filledMileage: number;
  changedKeys: CopilotSourceKey[];
} {
  const b = mergeSourceBlocksWithDefaults(blocks);
  const maps = collectCountryEvidenceFromBlocks(b);
  const changedKeys = new Set<CopilotSourceKey>();
  let filledIncidents = 0;
  let filledMileage = 0;

  const adInc = fillIncidentRows(b.autodna.incidents, maps);
  const adMil = fillMileageRows(b.autodna.serviceHistory, maps);
  filledIncidents += adInc.filled;
  filledMileage += adMil.filled;
  if (adInc.filled || adMil.filled) changedKeys.add("autodna");

  const cvInc = fillIncidentRows(b.carvertical.incidents, maps);
  let cvServiceHistory = fillMileageRows(b.carvertical.serviceHistory, maps).rows;
  const cvMilCross = cvServiceHistory.filter((r, i) => {
    const prev = b.carvertical.serviceHistory[i];
    return prev && !prev.country.trim() && r.country.trim();
  }).length;
  filledMileage += cvMilCross;
  if (b.carvertical.vehicleHistoryTimeline?.length) {
    const beforeTimeline = cvServiceHistory;
    cvServiceHistory = inferOdometerCountriesFromTimeline(
      cvServiceHistory,
      b.carvertical.vehicleHistoryTimeline,
    );
    filledMileage += cvServiceHistory.filter((r, i) => {
      const prev = beforeTimeline[i];
      return prev && !prev.country.trim() && r.country.trim();
    }).length;
  }
  filledIncidents += cvInc.filled;
  const cvTimelineFill = cvServiceHistory.filter((r, i) => {
    const orig = b.carvertical.serviceHistory[i];
    return orig && !orig.country.trim() && r.country.trim();
  }).length;
  filledMileage += cvTimelineFill;
  if (cvInc.filled || cvMilCross > 0 || cvTimelineFill > 0) changedKeys.add("carvertical");

  const ltabInc = fillIncidentRows(b.ltab.rows, maps);
  if (ltabInc.filled) changedKeys.add("ltab");
  filledIncidents += ltabInc.filled;

  const arMil = fillMileageRows(b.auto_records.serviceHistory, maps);
  if (arMil.filled) changedKeys.add("auto_records");
  filledMileage += arMil.filled;

  const csddMil = fillMileageRows(b.csdd.mileageHistory, maps);
  if (csddMil.filled) changedKeys.add("csdd");
  filledMileage += csddMil.filled;

  let citiSections = [...(b.citi_avoti.sections ?? [])];
  if (citiSections[0]) {
    const s0 = { ...emptyVendorAvotuBlock(), ...citiSections[0] };
    const cInc = fillIncidentRows(s0.incidents, maps);
    const cMil = fillMileageRows(s0.serviceHistory, maps);
    filledIncidents += cInc.filled;
    filledMileage += cMil.filled;
    if (cInc.filled || cMil.filled) {
      changedKeys.add("citi_avoti");
      citiSections[0] = { ...s0, incidents: cInc.rows, serviceHistory: cMil.rows };
    }
  }

  return {
    filledIncidents,
    filledMileage,
    changedKeys: [...changedKeys],
    blocks: {
      ...b,
      autodna: { ...b.autodna, incidents: adInc.rows, serviceHistory: adMil.rows },
      carvertical: {
        ...b.carvertical,
        incidents: cvInc.rows,
        serviceHistory: cvServiceHistory,
      },
      ltab: { ...b.ltab, rows: ltabInc.rows },
      auto_records: { ...b.auto_records, serviceHistory: arMil.rows },
      csdd: { ...b.csdd, mileageHistory: csddMil.rows },
      citi_avoti: { sections: citiSections },
    },
  };
}
