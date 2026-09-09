/**
 * OEM-stila dīlera PDF (atsevišķs fails no PROVIN dīlera atskaites).
 *
 * Dizains: „05 Minimal dossier” - logo kreisajā, hairline līnijas, bez rāmju tabulām.
 * - Portrets A4; markas logo augšā.
 * - NETULKO: oriģinālie API dati oriģinālvalodā (no OneAuto / Outvin raw payload).
 * - PROVIN dīlera atskaite (klienta PDF) var būt tulkota; šis dokuments - nē.
 */
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import {
  autoRecordsServiceWorkRowHasData,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import {
  ONEAUTO_PRODUCT_IDS,
  buildOneautoDisplay,
  filledOneautoKvRows,
  filledOneautoServiceEvents,
  oneautoDisplayHasRows,
  type OneautoDisplaySections,
  type OneautoProductId,
  type OneautoServiceEvent,
} from "@/lib/oneauto-catalog";
import type { OneautoBlockState, OneautoProductResult } from "@/lib/oneauto-block";
import {
  oneautoDisplayToEquipment,
  oneautoPowertrainToVehicleInfo,
} from "@/lib/oneauto-to-auto-records";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import {
  outvinDealerServiceRowHasData,
  type OutvinDataBundle,
  type OutvinPurchaseRecord,
} from "@/lib/outvin-data-bundle";
import { OUTVIN_VEHICLE_INFO_ROWS, type OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { extractEventsFromPayload } from "@/lib/outvin-history-map";
import {
  pdfDealerBrandFileKey,
  pdfDealerBrandFileKeyFromVin,
  pdfDealerLogoDataUri,
  pdfDealerLogoDataUriFromVin,
  pdfDealerLogoIsMonogram,
} from "@/lib/pdf-source-brand-logos";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function strVal(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return "";
}

function pickKey(obj: Record<string, unknown>, patterns: RegExp[]): unknown {
  for (const [k, v] of Object.entries(obj)) {
    if (patterns.some((re) => re.test(k))) return v;
  }
  return undefined;
}

function pickStr(obj: Record<string, unknown>, patterns: RegExp[]): string {
  const v = pickKey(obj, patterns);
  const s = strVal(v);
  if (s) return s;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const nested = v as Record<string, unknown>;
    return (
      strVal(nested.value) ||
      strVal(nested.name) ||
      strVal(nested.label) ||
      strVal(nested.text) ||
      ""
    );
  }
  return "";
}

function formatMileage(obj: Record<string, unknown>): string {
  const m = obj.mileage;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const o = m as Record<string, unknown>;
    const value = strVal(o.value);
    const unit = strVal(o.unit) || "km";
    if (value) return `${value} ${unit}`.trim();
  }
  return pickStr(obj, [/^(odometer|mileage|km|kilometer)/i]);
}

function formatLocation(obj: Record<string, unknown>): { dealer: string; address: string } {
  const loc = obj.location;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    const o = loc as Record<string, unknown>;
    const dealer =
      pickStr(o, [/dealer|workshop|company|name|label|partner/i]) || strVal(o.label);
    const parts = [
      strVal(o.street),
      strVal(o.address),
      strVal(o.city),
      strVal(o.state),
      strVal(o.zip),
      strVal(o.postalCode),
      strVal(o.countryName),
      strVal(o.countryCode),
    ].filter(Boolean);
    return { dealer, address: parts.filter((p, i, a) => a.indexOf(p) === i).join(", ") };
  }
  return {
    dealer: pickStr(obj, [/dealer|workshop|company|partner|autohaus/i]),
    address: pickStr(obj, [/address|street|city/i]),
  };
}

function formatList(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return "";
  return v
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") return String(item).trim();
      if (!item || typeof item !== "object") return "";
      const o = item as Record<string, unknown>;
      const bits = [
        pickStr(o, [/partNumber|partNo|partCode|sku|number|code/i]),
        pickStr(o, [/description|name|label|text|title|work/i]),
        pickStr(o, [/qty|quantity|count/i]),
      ].filter(Boolean);
      if (bits.length > 0) return bits.join(" · ");
      return Object.entries(o)
        .map(([k, val]) => {
          const s = strVal(val);
          return s ? `${k}: ${s}` : "";
        })
        .filter(Boolean)
        .join("; ");
    })
    .filter(Boolean)
    .join("\n");
}

export type OemServiceVisit = {
  date: string;
  km: string;
  type: string;
  extraWork: string;
  guarantee: string;
  dealer: string;
  address: string;
  orderNumber: string;
  extra: string;
};

const USED_EVENT_KEY =
  /^(date|mileage|odometer|type|location|warranty|guarantee|order|invoice|auftrag|work|description|parts|items|operations|extra)/i;

export function oemVisitFromEvent(raw: unknown): OemServiceVisit | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const date = pickStr(obj, [/^date$/i, /eventDate|serviceDate|performed/i]);
  const km = formatMileage(obj);
  const type = pickStr(obj, [/^type$/i, /serviceType|category|kind/i]);
  const extraWork =
    formatList(pickKey(obj, [/^(works|operations|jobs|services)$/i])) ||
    pickStr(obj, [/description|comment|note|work|job/i]);
  const guarantee = pickStr(obj, [/warranty|guarantee|garant/i]);
  const loc = formatLocation(obj);
  const dealer = loc.dealer || pickStr(obj, [/dealer|workshop|company|partner/i]);
  const address = loc.address;
  const orderNumber = pickStr(obj, [
    /orderNumber|orderNo|orderId|auftrag|invoice|documentNumber|woNumber/i,
  ]);
  const parts = formatList(pickKey(obj, [/^(parts|items|spareParts|materials)$/i]));
  const leftover = Object.entries(obj)
    .filter(([k]) => !USED_EVENT_KEY.test(k))
    .map(([k, v]) => {
      const s = strVal(v);
      if (s) return `${k}: ${s}`;
      if (Array.isArray(v)) {
        const list = formatList(v);
        return list ? `${k}: ${list}` : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
  const extra = [parts, leftover].filter(Boolean).join("\n");
  if (!date && !km && !type && !extraWork && !orderNumber && !dealer && !extra) return null;
  return {
    date,
    km,
    type,
    extraWork,
    guarantee,
    dealer,
    address,
    orderNumber,
    extra,
  };
}

function visitsFromPayload(payload: unknown): OemServiceVisit[] {
  const events = extractEventsFromPayload(payload);
  const fromEvents = events.map(oemVisitFromEvent).filter((v): v is OemServiceVisit => v != null);
  if (fromEvents.length > 0) return fromEvents;
  const fallback = oemVisitFromEvent(payload);
  return fallback ? [fallback] : [];
}

function visitsFromPurchases(purchases: OutvinPurchaseRecord[]): OemServiceVisit[] {
  const out: OemServiceVisit[] = [];
  for (const p of purchases) {
    out.push(...visitsFromPayload(p.payload));
  }
  return out;
}

function visitsFromDealerLog(bundle: OutvinDataBundle): OemServiceVisit[] {
  return bundle.dealerServiceLog.filter(outvinDealerServiceRowHasData).map((r) => ({
    date: r.date,
    km: r.odometer,
    type: "",
    extraWork: r.serviceNotes,
    guarantee: "",
    dealer: "",
    address: r.country,
    orderNumber: "",
    extra: "",
  }));
}

function visitsFromOneautoTimeline(events: readonly OneautoServiceEvent[]): OemServiceVisit[] {
  return filledOneautoServiceEvents([...events]).map((ev) => ({
    date: ev.date,
    km: ev.odometer,
    type: "",
    extraWork: ev.works,
    guarantee: "",
    dealer: ev.place,
    address: "",
    orderNumber: "",
    extra: "",
  }));
}

function visitsFromServiceWorks(rows: readonly AutoRecordsServiceWorkRow[] | undefined): OemServiceVisit[] {
  return (rows ?? []).filter(autoRecordsServiceWorkRowHasData).map((r) => ({
    date: r.date,
    km: r.odometer,
    type: "",
    extraWork: r.works,
    guarantee: "",
    dealer: r.location,
    address: "",
    orderNumber: "",
    extra: "",
  }));
}

/**
 * Avotu prioritate: Outvin purchase payload → OneAuto raw timeline → admin serviceWorks tabula → dealer log.
 * serviceWorks ir tas, ko operators redz OFICIĀLĀ DĪLERA sadaļā pēc OneAuto ielādes
 * (raw payload dažreiz nav saglabāts draftā). Apzināti NEIZGudrojam jaunus datus.
 */
export function collectOemDealerVisits(
  block: AutoRecordsBlockState,
  bundle: OutvinDataBundle,
  oneautoDisplay?: OneautoDisplaySections | null,
): OemServiceVisit[] {
  const fromApi = visitsFromPurchases(bundle.purchases);
  if (fromApi.length > 0) return fromApi;
  const fromOneauto = oneautoDisplay ? visitsFromOneautoTimeline(oneautoDisplay.serviceTimeline) : [];
  if (fromOneauto.length > 0) return fromOneauto;
  const fromWorks = visitsFromServiceWorks(block.serviceWorks);
  if (fromWorks.length > 0) return fromWorks;
  return visitsFromDealerLog(bundle);
}

function resultMapHasPayload(
  results: Partial<Record<OneautoProductId, OneautoProductResult>> | undefined,
): boolean {
  if (!results) return false;
  return ONEAUTO_PRODUCT_IDS.some((id) => results[id]?.payload != null);
}

/** Prefer live oneauto block; after fold, payloads live under auto_records.oneautoIngest. */
export function collectOemOneautoPayloads(
  autoRecords: AutoRecordsBlockState,
  oneauto?: OneautoBlockState | null,
): Partial<Record<OneautoProductId, unknown>> {
  const out: Partial<Record<OneautoProductId, unknown>> = {};
  const prefer = resultMapHasPayload(oneauto?.results)
    ? oneauto!.results
    : resultMapHasPayload(autoRecords.oneautoIngest?.results)
      ? autoRecords.oneautoIngest!.results
      : null;
  if (!prefer) return out;
  for (const id of ONEAUTO_PRODUCT_IDS) {
    const payload = prefer[id]?.payload;
    if (payload != null) out[id] = payload;
  }
  return out;
}

export function oemDisplayFromRawPayloads(
  payloads: Partial<Record<OneautoProductId, unknown>>,
): OneautoDisplaySections {
  return buildOneautoDisplay(payloads);
}

function mergeVehicleInfoPreferFilled(
  base: OutvinVehicleInfo,
  incoming: Partial<OutvinVehicleInfo>,
): OutvinVehicleInfo {
  const next = { ...base };
  for (const row of OUTVIN_VEHICLE_INFO_ROWS) {
    const cur = (next[row.key] ?? "").trim();
    const add = (incoming[row.key] ?? "").trim();
    if (!cur && add) next[row.key] = add;
  }
  return next;
}

function manufacturerHintFromPowertrain(rows: OneautoDisplaySections["powertrain"]): string {
  for (const row of filledOneautoKvRows(rows)) {
    if (/^(manufacturer|make|marka)(\s*desc)?$/i.test(row.label.replace(/^oem[_\s-]+/i, "").trim())) {
      return row.value.trim();
    }
  }
  return "";
}

function vehicleMetaLine(vi: OutvinVehicleInfo): string {
  return [
    vi.model,
    vi.modelSeries,
    vi.productionDate || vi.firstRegistration,
    vi.engineCode,
    vi.transmission,
    vi.power,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

function brandDisplayName(makeModel: string, vi: OutvinVehicleInfo, vin: string, makeHint: string): string {
  const fromMake = (makeModel.trim().split(/\s+/)[0] || "").trim();
  if (fromMake) return fromMake.toUpperCase();
  const fromHint = (makeHint.trim().split(/\s+/)[0] || "").trim();
  if (fromHint) return fromHint.toUpperCase();
  const fromModel = (vi.model.trim().split(/\s+/)[0] || "").trim();
  if (fromModel && !/^vehicle$/i.test(fromModel)) return fromModel.toUpperCase();
  const key =
    pdfDealerBrandFileKey(makeModel || makeHint || vi.model) || pdfDealerBrandFileKeyFromVin(vin);
  return key ? key.replace(/-/g, " ").toUpperCase() : "OEM";
}

function resolveOemLogoUri(args: {
  makeModel: string;
  title: string;
  vin: string;
  makeHint: string;
}): string | null {
  const textCandidates = [args.makeModel, args.makeHint, args.title]
    .map((s) => s.trim())
    .filter((s) => s && !/^vehicle$/i.test(s) && !/^oem$/i.test(s));

  for (const c of textCandidates) {
    const uri = pdfDealerLogoDataUri(c);
    if (uri && !pdfDealerLogoIsMonogram(uri)) return uri;
  }

  const fromVin = pdfDealerLogoDataUriFromVin(args.vin);
  if (fromVin && !pdfDealerLogoIsMonogram(fromVin)) return fromVin;

  for (const c of textCandidates) {
    const uri = pdfDealerLogoDataUri(c);
    if (uri) return uri;
  }
  return fromVin;
}

function kvTable(rows: Array<{ label: string; value: string }>): string {
  const body = rows
    .filter((r) => r.value.trim())
    .map((r) => `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`)
    .join("");
  if (!body) return "";
  return `<table class="oem-kv"><tbody>${body}</tbody></table>`;
}

type OemSvcCol = {
  key: keyof OemServiceVisit;
  label: string;
  className?: string;
};

const OEM_SVC_COLS: OemSvcCol[] = [
  { key: "date", label: "Date", className: "num" },
  { key: "km", label: "km", className: "num" },
  { key: "type", label: "Type" },
  { key: "extraWork", label: "Additional work" },
  { key: "guarantee", label: "Guarantee" },
  { key: "dealer", label: "Dealer" },
  { key: "address", label: "Address" },
  { key: "orderNumber", label: "Order no.", className: "num" },
];

function serviceTable(visits: OemServiceVisit[]): string {
  if (visits.length === 0) return "";

  const active = OEM_SVC_COLS.filter((col) => {
    if (col.key === "extraWork") {
      return visits.some((v) => v.extraWork.trim() || v.extra.trim());
    }
    return visits.some((v) => String(v[col.key] ?? "").trim());
  });
  if (active.length === 0) return "";

  const workWide = active.some((c) => c.key === "extraWork");
  const colCount = active.length;
  const workPct = workWide ? Math.max(36, 72 - (colCount - 1) * 8) : 0;

  const colgroup = active
    .map((col) => {
      if (col.key === "date") return `<col style="width:11%"/>`;
      if (col.key === "km") return `<col style="width:10%"/>`;
      if (col.key === "extraWork") return `<col style="width:${workPct}%"/>`;
      if (col.key === "orderNumber") return `<col style="width:11%"/>`;
      return `<col/>`;
    })
    .join("");

  const head = `<thead><tr>${active
    .map((col) => `<th>${escapeHtml(col.label)}</th>`)
    .join("")}</tr></thead>`;

  const body = visits
    .map((v) => {
      const cells = active
        .map((col) => {
          if (col.key === "extraWork") {
            const extra = v.extra.trim()
              ? `<div class="oem-extra">${escapeHtml(v.extra).replace(/\n/g, "<br/>")}</div>`
              : "";
            const work = `${escapeHtml(v.extraWork).replace(/\n/g, "<br/>")}${extra}`;
            return `<td class="oem-work">${work}</td>`;
          }
          const cls = col.className ? ` class="${col.className}"` : "";
          return `<td${cls}>${escapeHtml(String(v[col.key] ?? ""))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table class="oem-svc" style="table-layout:fixed">${colgroup}${head}<tbody>${body}</tbody></table>`;
}

function equipmentTableFromLines(rows: Array<{ code: string; description: string }>): string {
  const filled = rows.filter((l) => l.code.trim() || l.description.trim());
  if (filled.length === 0) return "";
  const body = filled
    .map(
      (l) =>
        `<tr><td class="num" style="width:18%">${escapeHtml(l.code)}</td><td>${escapeHtml(l.description)}</td></tr>`,
    )
    .join("");
  return `<h2>Equipment / SA</h2><table class="oem-svc" style="table-layout:fixed"><thead><tr><th>Code</th><th>Description</th></tr></thead><tbody>${body}</tbody></table>`;
}

const OEM_CSS = `
  :root{color-scheme:light;}
  html,body{margin:0;padding:0;background:#e8edf4;color:#0f172a;font:11.5px/1.4 Helvetica,Arial,sans-serif;}
  .oem{
    box-sizing:border-box;
    width:210mm;min-width:210mm;max-width:210mm;min-height:297mm;height:297mm;
    margin:16px auto;padding:12mm 12mm 14mm;background:#fff;
    box-shadow:0 12px 40px rgb(15 23 42 / .12);border:1px solid #c5ccd6;
    overflow:auto;
  }
  .oem-top{
    display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:end;
    padding-bottom:14px;border-bottom:1px solid #cbd5e1;margin:0 0 14px;
  }
  .oem-logo{
    display:block;width:32px;height:32px;object-fit:contain;flex-shrink:0;
    filter:brightness(0) saturate(100%);
  }
  .oem-logo--mono{filter:none;}
  .oem-mid{min-width:0;}
  .oem-kicker{
    margin:0;font-size:9px;font-weight:650;letter-spacing:0.14em;
    text-transform:uppercase;color:#94a3b8;
  }
  h1{
    margin:6px 0 0;font-size:17px;font-weight:650;letter-spacing:-0.02em;color:#0f172a;
  }
  .oem-meta{margin:4px 0 0;font-size:11px;color:#64748b;}
  .oem-vin{font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.05em;}
  .oem-side{
    text-align:right;font-size:9.5px;line-height:1.45;color:#94a3b8;max-width:38%;
  }
  .oem-rule{height:1px;background:#e2e8f0;margin:14px 0;border:0;}
  h2{
    margin:14px 0 6px;font-size:9.5px;font-weight:600;letter-spacing:0.12em;
    text-transform:uppercase;color:#94a3b8;
  }
  h2:first-of-type{margin-top:0;}
  table{width:100%;border-collapse:collapse;margin:0 0 4px;}
  .oem-kv th{
    width:32%;text-align:left;font-weight:450;color:#94a3b8;
    padding:6px 10px 6px 0;vertical-align:top;border-bottom:1px solid #eef2f7;
  }
  .oem-kv td{
    padding:6px 0;vertical-align:top;color:#0f172a;border-bottom:1px solid #eef2f7;
  }
  .oem-kv tr:last-child th,.oem-kv tr:last-child td{border-bottom:0;}
  .oem-svc{table-layout:fixed;width:100%;}
  .oem-svc th,.oem-svc td{
    border:0;border-bottom:1px solid #eef2f7;padding:7px 6px 7px 0;
    vertical-align:top;text-align:left;font-size:9.5px;
    word-break:break-word;overflow-wrap:anywhere;
  }
  .oem-svc th{
    background:transparent;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;
    font-weight:650;color:#94a3b8;white-space:nowrap;
  }
  .oem-svc td.oem-work{white-space:pre-wrap;line-height:1.45;}
  .oem-svc tr:last-child td{border-bottom:0;}
  .num{font-variant-numeric:tabular-nums;white-space:nowrap;}
  .oem-extra{margin-top:4px;color:#334155;white-space:pre-wrap;}
  .oem-empty{color:#64748b;font-size:12px;}
  @media print{
    @page{size:A4 portrait;margin:0;}
    html,body{padding:0!important;background:#fff!important;}
    .oem{
      width:210mm!important;min-width:0!important;max-width:none!important;
      min-height:297mm!important;height:auto!important;
      margin:0!important;padding:12mm!important;
      box-shadow:none!important;border:0!important;overflow:visible!important;
    }
  }
`;

export function buildOemDealerDocumentHtml(args: {
  vin?: string | null;
  makeModel?: string | null;
  autoRecords: AutoRecordsBlockState;
  /** Live OneAuto block (before fold). After fold, payloads are read from autoRecords.oneautoIngest. */
  oneauto?: OneautoBlockState | null;
}): string {
  const makeModel = (args.makeModel ?? "").trim();
  const bundle = getAutoRecordsOutvinBundle(args.autoRecords, args.vin ?? "");
  const payloads = collectOemOneautoPayloads(args.autoRecords, args.oneauto);
  const oneautoDisplay = oemDisplayFromRawPayloads(payloads);
  const hasOneautoRows = oneautoDisplayHasRows(oneautoDisplay);

  const mapped = hasOneautoRows
    ? oneautoPowertrainToVehicleInfo(oneautoDisplay.powertrain)
    : { vehicleInfo: {} as Partial<OutvinVehicleInfo>, leftovers: [] };

  let vi = mergeVehicleInfoPreferFilled(bundle.vehicleInfo, mapped.vehicleInfo);
  const vin = (vi.vinCode.trim() || args.vin?.trim() || "").toUpperCase();
  if (vin && !vi.vinCode.trim()) vi = { ...vi, vinCode: vin };

  const makeHint = manufacturerHintFromPowertrain(oneautoDisplay.powertrain);
  const title = (vi.model.trim() || makeModel || makeHint || "Vehicle").trim();
  const brand = brandDisplayName(makeModel, vi, vin, makeHint);
  const logoUri = resolveOemLogoUri({ makeModel, title, vin, makeHint });
  const logoIsMono = logoUri ? pdfDealerLogoIsMonogram(logoUri) : false;

  const visits = collectOemDealerVisits(args.autoRecords, bundle, oneautoDisplay);
  const equipmentLines =
    bundle.equipment.filter((l) => l.code.trim() || l.description.trim()).length > 0
      ? bundle.equipment
      : oneautoDisplayToEquipment(oneautoDisplay);

  const powertrainExtra = kvTable(mapped.leftovers.map((r) => ({ label: r.label, value: r.value })));

  const metaLine = vehicleMetaLine(vi);
  const sideMeta = metaLine
    ? metaLine
        .split(" · ")
        .map((part) => escapeHtml(part))
        .join("<br/>")
    : escapeHtml(brand);

  const specRows = OUTVIN_VEHICLE_INFO_ROWS.map((row) => ({
    label: row.labelEn,
    value: vi[row.key],
  }));
  const checks = kvTable([
    { label: "Accident check", value: bundle.accidentCheck },
    { label: "Stolen check", value: bundle.stolenCheck },
  ]);

  const hasBody =
    specRows.some((r) => r.value.trim()) ||
    visits.length > 0 ||
    equipmentLines.some((l) => l.code.trim() || l.description.trim()) ||
    Boolean(powertrainExtra) ||
    Boolean(bundle.accidentCheck.trim() || bundle.stolenCheck.trim());

  const vehicleKv = kvTable(specRows);
  const vehicleBlock =
    vehicleKv || powertrainExtra
      ? `<h2>Vehicle</h2>${vehicleKv}${powertrainExtra}`
      : "";
  const serviceBlock = visits.length
    ? `<hr class="oem-rule"/><h2>Service history</h2>${serviceTable(visits)}`
    : "";
  const checksBlock = checks ? `<hr class="oem-rule"/><h2>Checks</h2>${checks}` : "";
  const equipmentBlock = equipmentTableFromLines(equipmentLines);

  const inner = hasBody
    ? `${vehicleBlock}${serviceBlock}${equipmentBlock ? `<hr class="oem-rule"/>${equipmentBlock}` : ""}${checksBlock}`
    : `<p class="oem-empty">No dealer network records for this VIN. Check the official dealer data tables in admin, or reload OneAuto for this order.</p>`;

  const logoHtml = logoUri
    ? `<img class="oem-logo${logoIsMono ? " oem-logo--mono" : ""}" src="${logoUri}" alt="" width="32" height="32"/>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(brand)} ${escapeHtml(title)} ${escapeHtml(vin)}</title>
<style>${OEM_CSS}</style>
</head>
<body>
  <div class="oem">
    <header class="oem-top">
      ${logoHtml}
      <div class="oem-mid">
        <p class="oem-kicker">Official dealer data</p>
        <h1>${escapeHtml(title)}</h1>
        ${vin ? `<p class="oem-meta"><span class="oem-vin">VIN ${escapeHtml(vin)}</span></p>` : ""}
      </div>
      <div class="oem-side">${sideMeta}</div>
    </header>
    ${inner}
  </div>
</body>
</html>`;
}
