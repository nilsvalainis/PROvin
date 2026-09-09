/**
 * OEM-stila dīlera PDF (atsevišķs fails no PROVIN dīlera atskaites).
 *
 * Struktūra (vienmēr šādā secībā):
 * 1. Header (logo + modelis + VIN)
 * 2. Vehicle specs (section title = VIN code)
 * 3. Service history
 * 4. Equipment - kompaktā režģī (kods + apraksts), tikai dokumenta beigās
 *
 * NETULKO: oriģinālie API dati. „factory code/desc” nav Vehicle sadaļā - tikai Equipment.
 */
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import {
  ONEAUTO_PRODUCT_IDS,
  buildOneautoDisplay,
  filledOneautoKvRows,
  filledOneautoServiceEvents,
  oneautoDisplayHasRows,
  type OneautoDisplaySections,
  type OneautoKvRow,
  type OneautoProductId,
  type OneautoServiceEvent,
} from "@/lib/oneauto-catalog";
import type { OneautoBlockState } from "@/lib/oneauto-block";
import {
  oneautoDisplayToEquipment,
  oneautoPowertrainToVehicleInfo,
  preferRicherOneautoPayload,
} from "@/lib/oneauto-to-auto-records";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import {
  outvinDealerServiceRowHasData,
  type OutvinDataBundle,
  type OutvinPurchaseRecord,
} from "@/lib/outvin-data-bundle";
import {
  OUTVIN_VEHICLE_INFO_ROWS,
  type OutvinEquipmentLine,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";
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

/**
 * OEM PDF = tikai API oriģinālvaloda, NEKAD admin LV tulkojums (atšķirībā no PROVIN
 * dīlera atskaites klientam, kur "Servisa un remontu vēsture" LV ir korekti).
 * Avotu prioritate:
 * 1) Outvin purchase payload (oriģinālvaloda)
 * 2) OneAuto raw payload rebuild (oriģinālvaloda)
 * 3) Saglabātais serviceTimelineOriginal (oriģinālvaloda, pirms LV tulkojuma)
 * 4) dealer log (Outvin API dati, nav admin tulkojums)
 * Apzināti NEŅEM admin `serviceWorks` - tur bieži ir LV tulkojums PROVIN atskaitei.
 * Ja iepriekšējie avoti tukši (oriģinālais payload pazudis no drafta), sadaļa
 * paliek tukša - operatoram jāpārielādē OE Service History, lai atjaunotu oriģinālu.
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
  const fromOriginal = visitsFromOneautoTimeline(block.oneautoIngest?.serviceTimelineOriginal ?? []);
  if (fromOriginal.length > 0) return fromOriginal;
  return visitsFromDealerLog(bundle);
}

/** Merge payloads from live oneauto block and folded oneautoIngest; prefer richer service history. */
export function collectOemOneautoPayloads(
  autoRecords: AutoRecordsBlockState,
  oneauto?: OneautoBlockState | null,
): Partial<Record<OneautoProductId, unknown>> {
  const out: Partial<Record<OneautoProductId, unknown>> = {};
  for (const map of [autoRecords.oneautoIngest?.results, oneauto?.results]) {
    if (!map) continue;
    for (const id of ONEAUTO_PRODUCT_IDS) {
      const row = map[id];
      const payload = row?.payload;
      if (payload == null) continue;
      // A failed fetch may never replace an already-collected payload for this product.
      if (row?.ok === false && out[id] != null) continue;
      out[id] = preferRicherOneautoPayload(id, out[id], payload);
    }
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

/** Labels that belong in Equipment, never in Vehicle specs. */
export function isOemEquipmentLeftoverLabel(label: string): boolean {
  const n = label.replace(/^oem[_\s-]+/i, "").replace(/[_-]+/g, " ").trim();
  return /^(factory\s*(code|desc)|option(\s*code|\s*desc)?|sa(\s*code)?|equipment)$/i.test(n);
}

const LEFTOVER_PROMOTE: { re: RegExp; key: keyof OutvinVehicleInfo }[] = [
  { re: /^manufactured(\s*date)?$/i, key: "productionDate" },
  { re: /^build(\s*date)?$/i, key: "productionDate" },
  { re: /^model\s*year$/i, key: "productionDate" },
];

function promoteLeftoversToVehicle(
  vi: OutvinVehicleInfo,
  leftovers: readonly OneautoKvRow[],
): { vehicleInfo: OutvinVehicleInfo; leftovers: OneautoKvRow[] } {
  const next = { ...vi };
  const kept: OneautoKvRow[] = [];
  for (const row of leftovers) {
    const label = row.label.replace(/^oem[_\s-]+/i, "").replace(/[_-]+/g, " ").trim();
    const hit = LEFTOVER_PROMOTE.find(({ re }) => re.test(label));
    if (hit && !next[hit.key].trim() && row.value.trim()) {
      next[hit.key] = row.value.trim().slice(0, 500);
      continue;
    }
    kept.push(row);
  }
  return { vehicleInfo: next, leftovers: kept };
}

/**
 * Pair stray factory code/desc leftovers into equipment lines (safety net if options
 * were flattened into powertrain instead of the equipment walker).
 */
export function equipmentLinesFromFactoryLeftovers(
  leftovers: readonly OneautoKvRow[],
): OutvinEquipmentLine[] {
  const out: OutvinEquipmentLine[] = [];
  let pendingCode = "";
  for (const row of leftovers) {
    const label = row.label.replace(/^oem[_\s-]+/i, "").replace(/[_-]+/g, " ").trim();
    const value = row.value.trim();
    if (!value) continue;
    if (/^factory\s*code$/i.test(label)) {
      pendingCode = value;
      continue;
    }
    if (/^factory\s*desc$/i.test(label)) {
      out.push({ code: pendingCode, description: value });
      pendingCode = "";
      continue;
    }
  }
  if (pendingCode) out.push({ code: pendingCode, description: "" });
  return out.filter((l) => l.code.trim() || l.description.trim());
}

function mergeEquipmentLines(
  primary: readonly OutvinEquipmentLine[],
  secondary: readonly OutvinEquipmentLine[],
): OutvinEquipmentLine[] {
  const out: OutvinEquipmentLine[] = [];
  const seen = new Set<string>();
  for (const line of [...primary, ...secondary]) {
    const code = line.code.trim();
    const desc = line.description.trim();
    if (!code && !desc) continue;
    const key = (code || desc).toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ code, description: desc });
  }
  return out;
}

function manufacturerHintFromPowertrain(rows: OneautoDisplaySections["powertrain"]): string {
  for (const row of filledOneautoKvRows(rows)) {
    if (/^(manufacturer|make|marka)(\s*desc)?$/i.test(row.label.replace(/^oem[_\s-]+/i, "").trim())) {
      return row.value.trim();
    }
  }
  return "";
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

function humanizeSpecLabel(label: string): string {
  const t = label.replace(/^oem[_\s-]+/i, "").replace(/[_-]+/g, " ").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function vehicleSpecsHtml(rows: Array<{ label: string; value: string }>): string {
  const filled = rows.filter((r) => r.value.trim());
  if (filled.length === 0) return "";
  const cells = filled
    .map(
      (r) =>
        `<div class="oem-spec"><span class="oem-spec-k">${escapeHtml(r.label)}</span><span class="oem-spec-v">${escapeHtml(r.value)}</span></div>`,
    )
    .join("");
  return `<div class="oem-specs">${cells}</div>`;
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
  { key: "extraWork", label: "Work", className: "oem-work" },
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

  const hasWork = active.some((c) => c.key === "extraWork");
  const metaCount = active.length - (hasWork ? 1 : 0);
  const workPct = hasWork ? Math.max(48, 78 - metaCount * 9) : 0;

  const colgroup = active
    .map((col) => {
      if (col.key === "date") return `<col class="c-date"/>`;
      if (col.key === "km") return `<col class="c-km"/>`;
      if (col.key === "extraWork") return `<col style="width:${workPct}%"/>`;
      if (col.key === "orderNumber") return `<col class="c-order"/>`;
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

  return `<table class="oem-svc">${colgroup}${head}<tbody>${body}</tbody></table>`;
}

function equipmentGrid(rows: readonly OutvinEquipmentLine[]): string {
  const filled = rows.filter((l) => l.code.trim() || l.description.trim());
  if (filled.length === 0) return "";
  const items = filled
    .map((l) => {
      const code = l.code.trim();
      const desc = l.description.trim();
      return `<div class="oem-eq-item">${
        code ? `<span class="oem-eq-code">${escapeHtml(code)}</span>` : `<span class="oem-eq-code oem-eq-code--empty"></span>`
      }<span class="oem-eq-desc">${escapeHtml(desc)}</span></div>`;
    })
    .join("");
  return `<div class="oem-eq">${items}</div>`;
}

function section(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<section class="oem-sec"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

const OEM_CSS = `
  :root{color-scheme:light;}
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:#e8edf4;color:#0f172a;font:11px/1.4 Helvetica,Arial,sans-serif;}
  .oem{
    width:210mm;min-width:210mm;max-width:210mm;min-height:297mm;
    margin:16px auto;padding:11mm 11mm 12mm;background:#fff;
    box-shadow:0 12px 40px rgb(15 23 42 / .12);border:1px solid #c5ccd6;
  }
  .oem-top{
    display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center;
    padding-bottom:12px;border-bottom:1px solid #cbd5e1;margin:0 0 12px;
  }
  .oem-logo{
    display:block;width:30px;height:30px;object-fit:contain;flex-shrink:0;
    filter:brightness(0) saturate(100%);
  }
  .oem-logo--mono{filter:none;}
  .oem-mid{min-width:0;}
  .oem-kicker{
    margin:0;font-size:8.5px;font-weight:650;letter-spacing:0.14em;
    text-transform:uppercase;color:#94a3b8;
  }
  h1{
    margin:4px 0 0;font-size:16px;font-weight:650;letter-spacing:-0.02em;color:#0f172a;
  }
  .oem-sec{margin:0 0 14px;padding:0 0 2px;break-inside:avoid-page;}
  .oem-sec + .oem-sec{border-top:1px solid #e2e8f0;padding-top:12px;}
  h2{
    margin:0 0 8px;font-size:9px;font-weight:650;letter-spacing:0.12em;
    text-transform:uppercase;color:#94a3b8;
  }
  .oem-specs{
    display:grid;grid-template-columns:1fr 1fr;gap:0 18px;
  }
  .oem-spec{
    display:grid;grid-template-columns:38% minmax(0,1fr);gap:8px;
    padding:5px 0;border-bottom:1px solid #eef2f7;align-items:start;
  }
  .oem-spec-k{color:#94a3b8;font-weight:450;}
  .oem-spec-v{color:#0f172a;word-break:break-word;}
  table{width:100%;border-collapse:collapse;margin:0;}
  .oem-svc{table-layout:fixed;width:100%;}
  .oem-svc col.c-date{width:12%;}
  .oem-svc col.c-km{width:11%;}
  .oem-svc col.c-order{width:12%;}
  .oem-svc th,.oem-svc td{
    border:0;border-bottom:1px solid #eef2f7;padding:6px 8px 6px 0;
    vertical-align:top;text-align:left;font-size:9.5px;
  }
  .oem-svc th{
    font-size:8.5px;letter-spacing:0.06em;text-transform:uppercase;
    font-weight:650;color:#94a3b8;white-space:nowrap;
  }
  .oem-svc td.oem-work,.oem-work{white-space:pre-wrap;line-height:1.4;word-break:break-word;}
  .oem-svc tr:last-child td{border-bottom:0;}
  .num{font-variant-numeric:tabular-nums;white-space:nowrap;}
  .oem-extra{margin-top:3px;color:#475569;white-space:pre-wrap;}
  .oem-eq{
    display:grid;grid-template-columns:1fr 1fr;gap:0 14px;column-gap:16px;
  }
  .oem-eq-item{
    display:grid;grid-template-columns:52px minmax(0,1fr);gap:6px;align-items:start;
    padding:3px 0;border-bottom:1px solid #eef2f7;font-size:9px;line-height:1.35;
    break-inside:avoid;
  }
  .oem-eq-code{
    font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:650;
    color:#334155;font-variant-numeric:tabular-nums;white-space:nowrap;
  }
  .oem-eq-code--empty{visibility:hidden;}
  .oem-eq-desc{color:#0f172a;word-break:break-word;}
  .oem-empty{color:#64748b;font-size:12px;}
  @media print{
    @page{size:A4 portrait;margin:0;}
    html,body{padding:0!important;background:#fff!important;}
    .oem{
      width:210mm!important;min-width:0!important;max-width:none!important;
      min-height:0!important;height:auto!important;
      margin:0!important;padding:11mm!important;
      box-shadow:none!important;border:0!important;
    }
    .oem-sec{break-inside:auto;}
    .oem-eq-item{break-inside:avoid;}
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
    : { vehicleInfo: {} as Partial<OutvinVehicleInfo>, leftovers: [] as OneautoKvRow[] };

  let vi = mergeVehicleInfoPreferFilled(bundle.vehicleInfo, mapped.vehicleInfo);
  const vin = (vi.vinCode.trim() || args.vin?.trim() || "").toUpperCase();
  if (vin && !vi.vinCode.trim()) vi = { ...vi, vinCode: vin };

  const promoted = promoteLeftoversToVehicle(vi, mapped.leftovers);
  vi = promoted.vehicleInfo;

  const equipLeftovers = promoted.leftovers.filter((r) => isOemEquipmentLeftoverLabel(r.label));
  const vehicleLeftovers = promoted.leftovers.filter((r) => !isOemEquipmentLeftoverLabel(r.label));

  const makeHint = manufacturerHintFromPowertrain(oneautoDisplay.powertrain);
  const title = (vi.model.trim() || makeModel || makeHint || "Vehicle").trim();
  const brand = brandDisplayName(makeModel, vi, vin, makeHint);
  const logoUri = resolveOemLogoUri({ makeModel, title, vin, makeHint });
  const logoIsMono = logoUri ? pdfDealerLogoIsMonogram(logoUri) : false;

  const visits = collectOemDealerVisits(args.autoRecords, bundle, oneautoDisplay);

  const equipmentFromBundle = bundle.equipment.filter((l) => l.code.trim() || l.description.trim());
  const equipmentFromDisplay = oneautoDisplayToEquipment(oneautoDisplay);
  const equipmentFromLeftovers = equipmentLinesFromFactoryLeftovers(equipLeftovers);
  const equipmentDeduped = mergeEquipmentLines(
    equipmentFromBundle,
    mergeEquipmentLines(equipmentFromDisplay, equipmentFromLeftovers),
  );

  const specRows: Array<{ label: string; value: string }> = OUTVIN_VEHICLE_INFO_ROWS.filter(
    (row) => row.key !== "vinCode",
  ).map((row) => ({
    label: row.labelEn,
    value: vi[row.key],
  }));
  for (const row of vehicleLeftovers) {
    if (!row.value.trim()) continue;
    specRows.push({ label: humanizeSpecLabel(row.label), value: row.value.trim() });
  }

  const checksRows = [
    { label: "Accident check", value: bundle.accidentCheck },
    { label: "Stolen check", value: bundle.stolenCheck },
  ].filter((r) => r.value.trim());

  const vehicleHeading = vin || "Vehicle";
  const vehicleBlock = section(vehicleHeading, vehicleSpecsHtml(specRows));
  const serviceBlock = section("Service history", serviceTable(visits));
  const checksBlock = section("Checks", vehicleSpecsHtml(checksRows));
  const equipmentBlock = section("Equipment", equipmentGrid(equipmentDeduped));

  const hasBody = Boolean(vehicleBlock || serviceBlock || checksBlock || equipmentBlock);
  // Fixed order: vehicle → service → checks → equipment (equipment always last).
  const inner = hasBody
    ? `${vehicleBlock}${serviceBlock}${checksBlock}${equipmentBlock}`
    : `<p class="oem-empty">No dealer network records for this VIN.</p>`;

  const logoHtml = logoUri
    ? `<img class="oem-logo${logoIsMono ? " oem-logo--mono" : ""}" src="${logoUri}" alt="" width="30" height="30"/>`
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
      </div>
    </header>
    ${inner}
  </div>
</body>
</html>`;
}
