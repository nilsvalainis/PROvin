/**
 * OEM-stila dīlera PDF: visi API lauki (t.sk. pasūtījuma / detaļu numuri),
 * vienkāršs izkārtojums kā rūpnīcas izdruka. Atsevišķs fails, ne galvenā audita PDF.
 */
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import {
  autoRecordsServiceWorkRowHasData,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import {
  outvinDealerServiceRowHasData,
  type OutvinDataBundle,
  type OutvinPurchaseRecord,
} from "@/lib/outvin-data-bundle";
import { OUTVIN_VEHICLE_INFO_ROWS, type OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { extractEventsFromPayload } from "@/lib/outvin-history-map";

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
  if (loc && typeof loc === "object" && !Array.isArray(loc) && loc !== true) {
    const o = loc as Record<string, unknown>;
    const dealer =
      pickStr(o, [/dealer|workshop|company|name|label|partner/i]) || strVal(o.label);
    const parts = [strVal(o.street), strVal(o.address), strVal(o.city), strVal(o.state), strVal(o.zip), strVal(o.postalCode), strVal(o.countryName), strVal(o.countryCode)]
      .filter(Boolean);
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
  const orderNumber = pickStr(obj, [/orderNumber|orderNo|orderId|auftrag|invoice|documentNumber|woNumber/i]);
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

function visitsFromServiceWorks(rows: AutoRecordsServiceWorkRow[]): OemServiceVisit[] {
  return rows.filter(autoRecordsServiceWorkRowHasData).map((r) => ({
    date: r.date,
    km: r.odometer,
    type: "",
    extraWork: r.works,
    guarantee: "",
    dealer: "",
    address: r.location,
    orderNumber: "",
    extra: "",
  }));
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

export function collectOemDealerVisits(block: AutoRecordsBlockState, bundle: OutvinDataBundle): OemServiceVisit[] {
  const fromApi = visitsFromPurchases(bundle.purchases);
  if (fromApi.length > 0) return fromApi;
  const works = visitsFromServiceWorks(block.serviceWorks ?? []);
  if (works.length > 0) return works;
  return visitsFromDealerLog(bundle);
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

function kvTable(rows: Array<{ label: string; value: string }>): string {
  const body = rows
    .filter((r) => r.value.trim())
    .map((r) => `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`)
    .join("");
  if (!body) return "";
  return `<table class="oem-kv"><tbody>${body}</tbody></table>`;
}

function serviceTable(visits: OemServiceVisit[]): string {
  if (visits.length === 0) return "";
  const head = `<thead><tr>
    <th>Date</th><th>km</th><th>Type</th><th>Additional work</th>
    <th>Guarantee</th><th>Dealer</th><th>Address</th><th>Order no.</th>
  </tr></thead>`;
  const body = visits
    .map((v) => {
      const extra = v.extra.trim()
        ? `<div class="oem-extra">${escapeHtml(v.extra).replace(/\n/g, "<br/>")}</div>`
        : "";
      const work = `${escapeHtml(v.extraWork).replace(/\n/g, "<br/>")}${extra}`;
      return `<tr>
        <td>${escapeHtml(v.date)}</td>
        <td class="num">${escapeHtml(v.km)}</td>
        <td>${escapeHtml(v.type)}</td>
        <td>${work}</td>
        <td>${escapeHtml(v.guarantee)}</td>
        <td>${escapeHtml(v.dealer)}</td>
        <td>${escapeHtml(v.address)}</td>
        <td class="num">${escapeHtml(v.orderNumber)}</td>
      </tr>`;
    })
    .join("");
  return `<table class="oem-svc">${head}<tbody>${body}</tbody></table>`;
}

function equipmentTable(bundle: OutvinDataBundle): string {
  const rows = bundle.equipment.filter((l) => l.code.trim() || l.description.trim());
  if (rows.length === 0) return "";
  const body = rows
    .map((l) => `<tr><td class="num">${escapeHtml(l.code)}</td><td>${escapeHtml(l.description)}</td></tr>`)
    .join("");
  return `<h2>Equipment / SA</h2><table class="oem-svc"><thead><tr><th>Code</th><th>Description</th></tr></thead><tbody>${body}</tbody></table>`;
}

function dumpUnknownJson(title: string, value: unknown): string {
  if (value == null) return "";
  let text = "";
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (!text.trim() || text === "{}" || text === "[]") return "";
  return `<h2>${escapeHtml(title)}</h2><pre class="oem-json">${escapeHtml(text)}</pre>`;
}

const OEM_CSS = `
  :root{color-scheme:light;}
  html,body{margin:0;padding:0;background:#fff;color:#111;font:12px/1.4 Helvetica,Arial,sans-serif;}
  .oem{max-width:210mm;margin:0 auto;padding:12mm 10mm 16mm;}
  h1{margin:0 0 4px;font-size:16px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;}
  .oem-meta{margin:0 0 10px;color:#333;font-size:12px;}
  .oem-vin{font-family:ui-monospace,Menlo,monospace;letter-spacing:0.06em;}
  h2{margin:16px 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#444;}
  table{width:100%;border-collapse:collapse;margin:0 0 10px;}
  .oem-kv th{width:32%;text-align:left;font-weight:600;color:#555;padding:3px 8px 3px 0;vertical-align:top;}
  .oem-kv td{padding:3px 0;vertical-align:top;}
  .oem-svc th,.oem-svc td{border:1px solid #ccc;padding:4px 6px;vertical-align:top;text-align:left;font-size:10px;}
  .oem-svc th{background:#f3f3f3;font-weight:700;}
  .num{font-variant-numeric:tabular-nums;white-space:nowrap;}
  .oem-extra{margin-top:4px;color:#333;white-space:pre-wrap;}
  .oem-json{font:10px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;border:1px solid #ddd;padding:8px;background:#fafafa;overflow:auto;}
  .oem-empty{color:#666;font-size:12px;}
  @media print{
    @page{margin:10mm;size:A4;}
    html,body{padding:0!important;background:#fff!important;}
    .no-print{display:none!important;}
  }
`;

export function buildOemDealerDocumentHtml(args: {
  vin?: string | null;
  makeModel?: string | null;
  autoRecords: AutoRecordsBlockState;
}): string {
  const bundle = getAutoRecordsOutvinBundle(args.autoRecords, args.vin ?? "");
  const vi = bundle.vehicleInfo;
  const vin = (vi.vinCode.trim() || args.vin?.trim() || "").toUpperCase();
  const title = (vi.model.trim() || args.makeModel?.trim() || "Official dealer data").trim();
  const visits = collectOemDealerVisits(args.autoRecords, bundle);
  const specRows = OUTVIN_VEHICLE_INFO_ROWS.map((row) => ({
    label: `${row.labelEn} / ${row.labelLv}`,
    value: vi[row.key],
  }));
  const checks = kvTable([
    { label: "Accident check", value: bundle.accidentCheck },
    { label: "Stolen check", value: bundle.stolenCheck },
  ]);
  const leftoverPurchases = bundle.purchases
    .map((p, i) => dumpUnknownJson(`API payload ${i + 1} (type ${p.historyType})`, p.payload))
    .join("");
  const vehicleOrderDump = dumpUnknownJson("Vehicle order API", bundle.vehicleOrder?.payload);
  const hasBody =
    specRows.some((r) => r.value.trim()) ||
    visits.length > 0 ||
    bundle.equipment.length > 0 ||
    leftoverPurchases.length > 0 ||
    vehicleOrderDump.length > 0 ||
    Boolean(bundle.accidentCheck.trim() || bundle.stolenCheck.trim());

  const inner = hasBody
    ? `${kvTable(specRows)}${serviceTable(visits)}${equipmentTable(bundle)}${checks}${vehicleOrderDump}${leftoverPurchases}`
    : `<p class="oem-empty">Nav dīlera API datu šim pasūtījumam.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)} ${escapeHtml(vin)}</title>
<style>${OEM_CSS}</style>
</head>
<body>
  <div class="oem">
    <p class="no-print" style="margin:0 0 12px;font-size:11px;color:#666;">Drukā / saglabā kā PDF no pārlūka.</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="oem-meta">
      ${vin ? `<span class="oem-vin">VIN ${escapeHtml(vin)}</span>` : ""}
      ${vehicleMetaLine(vi) ? ` · ${escapeHtml(vehicleMetaLine(vi))}` : ""}
    </p>
    ${inner}
  </div>
</body>
</html>`;
}
