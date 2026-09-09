/**
 * OEM-stila dīlera PDF (atsevišķs fails no PROVIN dīlera atskaites).
 *
 * - Portrets A4, izskatās kā oficiālā dīlera / ražotāja izdruka (markas logo augšā).
 * - NETULKO: rāda ielasītos oriģinālos API datus oriģinālvalodā.
 * - PROVIN dīlera atskaite (klienta PDF) var būt tulkota; šis dokuments - nē.
 */
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import {
  outvinDealerServiceRowHasData,
  type OutvinDataBundle,
  type OutvinPurchaseRecord,
} from "@/lib/outvin-data-bundle";
import { OUTVIN_VEHICLE_INFO_ROWS, type OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { extractEventsFromPayload } from "@/lib/outvin-history-map";
import { pdfDealerBrandFileKey, pdfDealerLogoDataUri } from "@/lib/pdf-source-brand-logos";

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

/**
 * Tikai oriģinālie OEM avoti (purchase payload / dealer log).
 * Apzināti NEŅEM admin `serviceWorks` tabulu - tur bieži ir LV tulkojums PROVIN atskaitei.
 */
export function collectOemDealerVisits(
  _block: AutoRecordsBlockState,
  bundle: OutvinDataBundle,
): OemServiceVisit[] {
  const fromApi = visitsFromPurchases(bundle.purchases);
  if (fromApi.length > 0) return fromApi;
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

function brandDisplayName(makeModel: string, vi: OutvinVehicleInfo): string {
  const fromMake = (makeModel.trim().split(/\s+/)[0] || "").trim();
  if (fromMake) return fromMake.toUpperCase();
  const fromModel = (vi.model.trim().split(/\s+/)[0] || "").trim();
  if (fromModel) return fromModel.toUpperCase();
  const key = pdfDealerBrandFileKey(makeModel || vi.model);
  return key ? key.replace(/-/g, " ").toUpperCase() : "OEM";
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
  html,body{margin:0;padding:0;background:#fff;color:#111;font:11.5px/1.4 Helvetica,Arial,sans-serif;}
  .oem{
    box-sizing:border-box;
    width:210mm;max-width:100%;min-height:297mm;margin:0 auto;
    padding:0 0 14mm;background:#fff;
  }
  .oem-masthead{
    display:flex;align-items:center;justify-content:space-between;gap:16px;
    padding:11mm 12mm 10mm;background:#0b1220;color:#E8EEF5;
  }
  .oem-brand-row{display:flex;align-items:center;gap:12px;min-width:0;}
  .oem-logo{
    display:block;width:40px;height:40px;object-fit:contain;flex-shrink:0;
  }
  .oem-brand-name{
    margin:0;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;
  }
  .oem-brand-sub{
    margin:3px 0 0;font-size:9px;font-weight:600;letter-spacing:0.12em;
    text-transform:uppercase;color:#94a3b8;
  }
  .oem-doc-side{text-align:right;font-size:9.5px;line-height:1.45;color:#94a3b8;}
  .oem-doc-side b{display:block;color:#E8EEF5;font-size:11px;font-weight:700;letter-spacing:0.04em;}
  .oem-body{padding:10mm 12mm 0;}
  h1{margin:0 0 4px;font-size:17px;font-weight:700;letter-spacing:-0.01em;color:#0f172a;}
  .oem-meta{margin:0 0 12px;color:#334155;font-size:11.5px;}
  .oem-vin{font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.05em;}
  h2{
    margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #cbd5e1;
    font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;
  }
  table{width:100%;border-collapse:collapse;margin:0 0 8px;}
  .oem-kv th{width:32%;text-align:left;font-weight:600;color:#64748b;padding:4px 8px 4px 0;vertical-align:top;}
  .oem-kv td{padding:4px 0;vertical-align:top;color:#0f172a;}
  .oem-svc th,.oem-svc td{
    border:1px solid #cbd5e1;padding:4px 6px;vertical-align:top;text-align:left;font-size:9.5px;
  }
  .oem-svc th{background:#f1f5f9;font-weight:700;color:#334155;}
  .num{font-variant-numeric:tabular-nums;white-space:nowrap;}
  .oem-extra{margin-top:4px;color:#334155;white-space:pre-wrap;}
  .oem-json{
    font:9.5px/1.35 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;
    border:1px solid #cbd5e1;padding:8px;background:#f8fafc;overflow:auto;
  }
  .oem-empty{color:#64748b;font-size:12px;}
  .oem-foot{
    margin:16px 0 0;padding-top:8px;border-top:1px solid #e2e8f0;
    font-size:9px;line-height:1.4;color:#94a3b8;
  }
  @media print{
    @page{size:A4 portrait;margin:0;}
    html,body{padding:0!important;background:#fff!important;}
    .oem{width:auto;min-height:auto;box-shadow:none;}
    .no-print{display:none!important;}
  }
`;

export function buildOemDealerDocumentHtml(args: {
  vin?: string | null;
  makeModel?: string | null;
  autoRecords: AutoRecordsBlockState;
}): string {
  const makeModel = (args.makeModel ?? "").trim();
  const bundle = getAutoRecordsOutvinBundle(args.autoRecords, args.vin ?? "");
  const vi = bundle.vehicleInfo;
  const vin = (vi.vinCode.trim() || args.vin?.trim() || "").toUpperCase();
  const title = (vi.model.trim() || makeModel || "Vehicle").trim();
  const brand = brandDisplayName(makeModel, vi);
  const logoUri = pdfDealerLogoDataUri(makeModel || title);
  const visits = collectOemDealerVisits(args.autoRecords, bundle);
  const specRows = OUTVIN_VEHICLE_INFO_ROWS.map((row) => ({
    label: row.labelEn,
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
    ? `${kvTable(specRows)}${visits.length ? `<h2>Service history</h2>${serviceTable(visits)}` : ""}${equipmentTable(bundle)}${checks}${vehicleOrderDump}${leftoverPurchases}`
    : `<p class="oem-empty">No dealer network records for this VIN.</p>`;

  const logoHtml = logoUri
    ? `<img class="oem-logo" src="${logoUri}" alt="" width="40" height="40"/>`
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
    <p class="no-print" style="margin:0;padding:10px 12mm;font-size:11px;color:#666;background:#f8fafc;">
      Portrait A4 · original OEM language (not translated) · print / save as PDF from the browser.
    </p>
    <header class="oem-masthead">
      <div class="oem-brand-row">
        ${logoHtml}
        <div>
          <p class="oem-brand-name">${escapeHtml(brand)}</p>
          <p class="oem-brand-sub">Official dealer data</p>
        </div>
      </div>
      <div class="oem-doc-side">
        <b>Service history</b>
        Manufacturer network extract
      </div>
    </header>
    <div class="oem-body">
      <h1>${escapeHtml(title)}</h1>
      <p class="oem-meta">
        ${vin ? `<span class="oem-vin">VIN ${escapeHtml(vin)}</span>` : ""}
        ${vehicleMetaLine(vi) ? ` · ${escapeHtml(vehicleMetaLine(vi))}` : ""}
      </p>
      ${inner}
      <p class="oem-foot">
        Source data as provided by the manufacturer / authorised dealer systems. Field values are shown in their original language and are not translated.
      </p>
    </div>
  </div>
</body>
</html>`;
}
