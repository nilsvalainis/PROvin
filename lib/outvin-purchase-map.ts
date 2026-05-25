import { formatAutoRecordsDateForOutput, type AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import { mapOutvinHistoryPayloadToServiceRows, mergeOutvinServiceRows } from "@/lib/outvin-history-map";
import {
  buildOutvinDealerReport,
  mapOutvinVehicleJsonToInfo,
} from "@/lib/outvin-dealer-map";
import { extractEventsFromPayload } from "@/lib/outvin-history-map";
import { getOutvinCatalogSlotByType } from "@/lib/outvin-source-catalog";
import type { OutvinDealerReport } from "@/lib/outvin-dealer-types";
import {
  emptyOutvinDataBundle,
  emptyOutvinDealerServiceRow,
  emptyOutvinEuropeanRow,
  outvinDealerServiceRowHasData,
  outvinEuropeanRowHasData,
  type OutvinDataBundle,
  type OutvinDealerServiceRow,
  type OutvinEuropeanRegisterRow,
  type OutvinUsCarfaxData,
} from "@/lib/outvin-data-bundle";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";

function strVal(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function deepFindString(obj: unknown, keyPatterns: RegExp[], depth = 0): string {
  if (depth > 6 || obj == null) return "";
  if (typeof obj === "string") return obj.trim();
  if (typeof obj !== "object") return "";
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const s = deepFindString(item, keyPatterns, depth + 1);
      if (s) return s;
    }
    return "";
  }
  const o = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (keyPatterns.some((re) => re.test(k))) {
      const s = strVal(v);
      if (s) return s;
    }
  }
  for (const v of Object.values(o)) {
    const s = deepFindString(v, keyPatterns, depth + 1);
    if (s) return s;
  }
  return "";
}

function mileageKmFromEvent(ev: { mileage?: { unit?: string; value?: number } }): string {
  const m = ev.mileage;
  if (!m || typeof m !== "object" || typeof m.value !== "number" || m.value <= 0) return "";
  const unit = (m.unit ?? "km").toString().toLowerCase();
  const km = unit.includes("mi") ? Math.round(m.value * 1.60934) : Math.round(m.value);
  return String(km);
}

function eventCountry(ev: { location?: unknown }): string {
  const loc = ev.location;
  if (!loc || typeof loc === "boolean" || typeof loc !== "object") return "";
  const o = loc as Record<string, unknown>;
  const name = strVal(o.countryName);
  if (name) return normalizeCountryNameLv(name);
  const code = strVal(o.countryCode);
  if (code) return normalizeCountryNameLv(code);
  return normalizeCountryNameLv(strVal(o.label));
}

export function mapHistoryPayloadToDealerServiceLog(payload: unknown): OutvinDealerServiceRow[] {
  const events = extractEventsFromPayload(payload);
  const rows: OutvinDealerServiceRow[] = [];
  for (const ev of events) {
    const dateRaw = typeof ev.date === "string" ? ev.date.trim() : "";
    if (!dateRaw) continue;
    const odometer = mileageKmFromEvent(ev);
    const country = eventCountry(ev);
    const typeLabel = typeof ev.type === "string" ? ev.type.trim() : "";
    const loc =
      ev.location && typeof ev.location === "object" && !Array.isArray(ev.location)
        ? [strVal((ev.location as Record<string, unknown>).city), strVal((ev.location as Record<string, unknown>).label)]
            .filter(Boolean)
            .join(", ")
        : "";
    const notes = [typeLabel, loc].filter(Boolean).join(" — ");
    const row: OutvinDealerServiceRow = {
      date: formatAutoRecordsDateForOutput(dateRaw),
      odometer,
      country,
      serviceNotes: notes.slice(0, 500),
    };
    if (outvinDealerServiceRowHasData(row)) rows.push(row);
  }
  return rows;
}

export function mapHistoryPayloadToUsCarfax(payload: unknown, prev: OutvinUsCarfaxData): OutvinUsCarfaxData {
  const next = { ...prev };
  const importDate =
    deepFindString(payload, [/importdate/i, /imported/i, /firstregistration/i, /dateimport/i]) ||
    deepFindString(payload, [/import/i]);
  if (importDate && !next.importDate) next.importDate = importDate.slice(0, 40);

  const damage =
    deepFindString(payload, [/damage/i, /accident/i, /collision/i, /title/i]) ||
    eventsToTextBlock(payload, /accident|damage|collision|repair/i);
  if (damage && !next.registeredDamage) next.registeredDamage = damage.slice(0, 4000);

  const auction = deepFindString(payload, [/auction/i, /salvage/i, /bid/i]);
  if (auction && !next.auctionData) next.auctionData = auction.slice(0, 4000);

  const odo =
    deepFindString(payload, [/odometer/i, /mileage/i]) ||
    extractEventsFromPayload(payload)
      .map((ev) => mileageKmFromEvent(ev))
      .filter(Boolean)
      .join(", ");
  if (odo && !next.usOdometer) next.usOdometer = odo.slice(0, 80);

  const notes = eventsToTextBlock(payload, /.*/);
  if (notes && !next.notes) next.notes = notes.slice(0, 4000);

  return next;
}

function eventsToTextBlock(payload: unknown, typeRe: RegExp): string {
  const lines: string[] = [];
  for (const ev of extractEventsFromPayload(payload)) {
    const type = typeof ev.type === "string" ? ev.type : "";
    if (!typeRe.test(type) && typeRe.source !== ".*") continue;
    const date = typeof ev.date === "string" ? ev.date : "";
    const km = mileageKmFromEvent(ev);
    const country = eventCountry(ev);
    lines.push([date, country, km, type].filter(Boolean).join(" — "));
  }
  return lines.join("\n");
}

export function mapHistoryPayloadToEuropeanRegisters(payload: unknown): OutvinEuropeanRegisterRow[] {
  const events = extractEventsFromPayload(payload);
  const rows: OutvinEuropeanRegisterRow[] = [];
  for (const ev of events) {
    const dateRaw = typeof ev.date === "string" ? ev.date.trim() : "";
    if (!dateRaw) continue;
    const typeLabel = typeof ev.type === "string" ? ev.type.trim() : "Reģistrs";
    const country = eventCountry(ev);
    const km = mileageKmFromEvent(ev);
    const details = [km ? `${km} km` : "", typeLabel].filter(Boolean).join(" · ");
    const row: OutvinEuropeanRegisterRow = {
      date: formatAutoRecordsDateForOutput(dateRaw),
      country,
      registerType: typeLabel.slice(0, 120),
      details: details.slice(0, 500),
    };
    if (outvinEuropeanRowHasData(row)) rows.push(row);
  }

  if (rows.length === 0) {
    const summary = deepFindString(payload, [/carpass/i, /technical/i, /inspection/i, /register/i]);
    if (summary) {
      rows.push({
        date: "",
        country: "",
        registerType: "Reģistrs",
        details: summary.slice(0, 500),
      });
    }
  }
  return rows;
}

function mergeDealerLogs(existing: OutvinDealerServiceRow[], incoming: OutvinDealerServiceRow[]): OutvinDealerServiceRow[] {
  const key = (r: OutvinDealerServiceRow) =>
    `${r.date}|${r.odometer}|${r.country}|${r.serviceNotes}`;
  const seen = new Set(existing.map(key));
  const out = [...existing];
  for (const r of incoming) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out.filter(outvinDealerServiceRowHasData);
}

function mergeEuropean(
  existing: OutvinEuropeanRegisterRow[],
  incoming: OutvinEuropeanRegisterRow[],
): OutvinEuropeanRegisterRow[] {
  const key = (r: OutvinEuropeanRegisterRow) => `${r.date}|${r.country}|${r.registerType}|${r.details}`;
  const seen = new Set(existing.map(key));
  const out = [...existing.filter(outvinEuropeanRowHasData)];
  for (const r of incoming) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out.length > 0 ? out : [emptyOutvinEuropeanRow()];
}

export function outvinBundleToDealerReport(bundle: OutvinDataBundle): OutvinDealerReport {
  const historyPayloads = bundle.purchases.map((p) => p.payload);
  return buildOutvinDealerReport({
    vehiclePayload: bundle.vehicleInfo,
    historyPayloads,
    vin: bundle.vin,
  });
}

/** Pēc pirkuma atjauno strukturētos laukus un saglabā raw JSON. */
export function applyOutvinPurchaseToBundle(
  bundle: OutvinDataBundle,
  historyType: number,
  payload: unknown,
  fetchedAt = new Date().toISOString(),
): OutvinDataBundle {
  const slot = getOutvinCatalogSlotByType(historyType);
  const category = slot?.category ?? (historyType === 2 ? "us_carfax" : "service_history");

  const purchases = bundle.purchases.filter((p) => p.historyType !== historyType);
  purchases.push({ historyType, fetchedAt, payload });

  let dealerServiceLog = bundle.dealerServiceLog.filter(outvinDealerServiceRowHasData);
  let usCarfax = { ...bundle.usCarfax };
  let europeanRegisters = bundle.europeanRegisters.filter(outvinEuropeanRowHasData);

  if (category === "service_history" || historyType === 1) {
    const mileageRows = mapOutvinHistoryPayloadToServiceRows(payload);
    dealerServiceLog = mergeDealerLogs(
      dealerServiceLog,
      mileageRows.map((r) => ({
        date: r.date,
        odometer: r.odometer,
        country: r.country,
        serviceNotes: "",
      })),
    );
  } else if (category === "us_carfax") {
    usCarfax = mapHistoryPayloadToUsCarfax(payload, usCarfax);
  } else if (category === "european_registers") {
    europeanRegisters = mergeEuropean(europeanRegisters, mapHistoryPayloadToEuropeanRegisters(payload));
  }

  const historyPayloads = purchases.map((p) => p.payload);
  const report = buildOutvinDealerReport({
    vehiclePayload: bundle.vehicleInfo,
    historyPayloads,
    vin: bundle.vin,
  });

  const vehicleFromPayload = mapOutvinVehicleJsonToInfo(payload, bundle.vin);
  const vehicleInfo = { ...bundle.vehicleInfo };
  for (const key of Object.keys(vehicleInfo) as (keyof typeof vehicleInfo)[]) {
    if (!vehicleInfo[key].trim() && vehicleFromPayload[key].trim()) {
      vehicleInfo[key] = vehicleFromPayload[key];
    }
  }

  return {
    ...bundle,
    purchases,
    dealerServiceLog:
      dealerServiceLog.length > 0 ? dealerServiceLog : [emptyOutvinDealerServiceRow()],
    usCarfax,
    europeanRegisters,
    vehicleInfo: report.vehicleInfo.vinCode.trim() ? report.vehicleInfo : vehicleInfo,
    equipment: report.equipment.length > 0 ? report.equipment : bundle.equipment,
    accidentCheck: report.accidentCheck.trim() ? report.accidentCheck : bundle.accidentCheck,
    stolenCheck: report.stolenCheck.trim() ? report.stolenCheck : bundle.stolenCheck,
  };
}

export function rebuildOutvinBundleFromPurchases(bundle: OutvinDataBundle): OutvinDataBundle {
  let next = emptyOutvinDataBundle(bundle.vin);
  next.precheckAt = bundle.precheckAt;
  next.capabilitySlots = bundle.capabilitySlots;
  next.pdfSections = bundle.pdfSections;
  for (const p of bundle.purchases) {
    next = applyOutvinPurchaseToBundle(next, p.historyType, p.payload, p.fetchedAt);
  }
  next.pdfSections = bundle.pdfSections;
  return next;
}

export function dealerLogToMergedServiceHistory(log: OutvinDealerServiceRow[]): AutoRecordsServiceRow[] {
  const batches = [log.map(({ date, odometer, country }) => ({ date, odometer, country }))];
  return mergeOutvinServiceRows(batches);
}

/** Swagger Type 1 — `events[]` ar date, mileage.value, location → nobraukuma tabula. */
export function mileageRowsFromOutvinBundle(bundle: OutvinDataBundle): AutoRecordsServiceRow[] {
  const batches: AutoRecordsServiceRow[][] = [];
  for (const p of bundle.purchases) {
    if (p.historyType !== 1) continue;
    const rows = mapOutvinHistoryPayloadToServiceRows(p.payload);
    if (rows.length > 0) batches.push(rows);
  }
  const fromLog = dealerLogToMergedServiceHistory(
    bundle.dealerServiceLog.filter((r) => r.date.trim() || r.odometer.trim()),
  );
  if (fromLog.length > 0) batches.push(fromLog);
  return batches.length > 0 ? mergeOutvinServiceRows(batches) : [];
}

/** Pauze starp secīgiem Outvin history pieprasījumiem (rate limit / īslaicīgi bloki). */
export const OUTVIN_SEQUENTIAL_PURCHASE_DELAY_MS = 1000;

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type OutvinPurchaseTypeResult = {
  type: number;
  ok: boolean;
  error?: string;
  httpStatus?: number;
};

export type OutvinPurchaseResult = {
  bundle: OutvinDataBundle;
  results: OutvinPurchaseTypeResult[];
  paymentRequired: boolean;
  purchaseMessage?: string;
};

export function logOutvinPurchaseHistoryFailure(
  context: string,
  vin: string,
  historyType: number,
  httpStatus: number,
  skipReason: string | undefined,
  rawBody: string | undefined,
): void {
  console.error(`[${context}] Outvin history request failed`, {
    vin,
    historyType,
    httpStatus,
    skipReason: skipReason ?? "(none)",
    rawBody: rawBody ?? "(empty)",
  });
}

/** UI ziņojums — kredītu teksts tikai pie īsta HTTP 402. */
export function buildOutvinPurchaseUserMessage(
  results: OutvinPurchaseTypeResult[],
  paymentRequired: boolean,
): string | undefined {
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) return undefined;

  const strict402 = failed.filter((r) => r.httpStatus === 402);
  if (paymentRequired && strict402.length > 0) {
    return "Outvin: kontā beidzās kredīti (HTTP 402). Daļa datu var būt jau saglabāta.";
  }

  const parts = failed.map((r) => {
    const status = r.httpStatus != null ? ` HTTP ${r.httpStatus}` : "";
    return `Type ${r.type} — ${r.error ?? "nezināms"}${status}`;
  });
  return `Kļūda iegādē: ${parts.join("; ")}`;
}
