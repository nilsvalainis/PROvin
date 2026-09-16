/**
 * VIN Audit pullreport JSON → ASV bloks.
 * Nobraukums vienmēr km. ASV title odometrs parasti ir jūdzēs (meter_unit M).
 */

import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import { oneautoOdometerToKm } from "@/lib/oneauto-catalog";
import { convertAmountTextToEur } from "@/lib/currency-eur-convert";
import {
  emptyAsvBlock,
  type AsvBlockState,
  type AsvCheckRow,
  type AsvDamageRow,
  type AsvRecordRow,
  type AsvSaleRow,
  type AsvTitleRow,
} from "@/lib/asv-report";
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";

const MILES_TO_KM = 1.609344;

export type AsvImageHint = {
  url: string;
  title: string;
};

export type AsvParseResult = {
  block: AsvBlockState;
  imageHints: AsvImageHint[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function unwrapVinaudit(raw: unknown): Record<string, unknown> | null {
  const o = asRecord(raw);
  if (!o) return null;
  if (o.result != null) {
    const inner = asRecord(o.result) ?? unwrapVinaudit(o.result);
    if (inner) return inner;
  }
  if (o.data != null) {
    const inner = asRecord(o.data) ?? unwrapVinaudit(o.data);
    if (inner) return inner;
  }
  return o;
}

function stringifyVal(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "jā" : "nē";
  return "";
}

function toLvDate(raw: unknown): string {
  const t = stringifyVal(raw);
  if (!t) return "";
  const formatted = formatAutoRecordsDateForOutput(t);
  return formatted || t.slice(0, 40);
}

function looksLikeMiles(unitRaw: string, contextMilesDefault: boolean): boolean {
  const u = unitRaw.trim().toLowerCase();
  if (/^(mi|mile|miles|m)$/i.test(u)) return true;
  if (/^(km|k|kilometr)/i.test(u)) return false;
  return contextMilesDefault;
}

function odometerKm(raw: unknown, unitRaw = "", milesDefault = true): string {
  const t = stringifyVal(raw);
  if (!t) return "";
  const unit = stringifyVal(unitRaw);
  if (looksLikeMiles(unit, milesDefault)) {
    return oneautoOdometerToKm(t, "miles");
  }
  return oneautoOdometerToKm(t, unit || "km");
}

function amountEur(raw: unknown): string {
  const t = stringifyVal(raw);
  if (!t) return "";
  const withUsd = /usd|\$/i.test(t) ? t : `${t} USD`;
  const conversion = convertAmountTextToEur(withUsd);
  return conversion?.display ?? t;
}

function usRegion(stateRaw: unknown): string {
  const state = stringifyVal(stateRaw).toUpperCase();
  if (!state) return "ASV";
  return `ASV, ${state.slice(0, 8)}`;
}

const CHECK_LABELS: Record<string, string> = {
  salvage: "Salvage (norakstīts)",
  rebuilt: "Rebuilt (atjaunots title)",
  flood: "Flood (plūdi)",
  fire: "Fire (ugunsgrēks)",
  hail: "Hail (krusa)",
  lemon: "Lemon",
  odometer: "Odometra kļūda / rollback",
  theft: "Zādzība",
  title_problem: "Title problēma",
  insurance: "Apdrošināšanas total loss",
  junk: "Junk",
  junk_salvage: "Junk / salvage",
  grey_market: "Grey market",
  export: "Eksports",
  impound: "Aizturēšana (impound)",
  lien: "Ķīla",
};

function parseChecks(raw: unknown): AsvCheckRow[] {
  const o = asRecord(raw);
  if (!o) return [];
  const out: AsvCheckRow[] = [];
  for (const [key, val] of Object.entries(o)) {
    if (typeof val === "object" && val != null) continue;
    const truthy =
      val === true ||
      val === 1 ||
      (typeof val === "string" && /^(true|yes|found|hit|1)$/i.test(val.trim()));
    const label = CHECK_LABELS[key] ?? key.replace(/_/g, " ");
    out.push({
      label: label.slice(0, 120),
      status: truthy ? "atrasts ieraksts" : "nav ieraksta",
      severity: truthy ? "alert" : "ok",
    });
  }
  return out;
}

function dedupeMileage(rows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  const seen = new Set<string>();
  const out: AutoRecordsServiceRow[] = [];
  for (const r of rows) {
    const key = `${r.date}|${r.odometer}|${r.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function listingUrl(listingId: string, location: string): string {
  const id = listingId.trim();
  if (!id) return "";
  const loc = location.toLowerCase();
  if (loc.includes("iaai") || loc.includes("iaa ")) {
    return `https://www.iaai.com/Vehicle?itemID=${encodeURIComponent(id)}`;
  }
  return `https://www.copart.com/lot/${encodeURIComponent(id)}`;
}

const IMAGE_KEY_RE = /^(image|photo|picture|thumbnail|url)$/i;
const IMAGE_URL_RE = /^https?:\/\/\S+\.(jpe?g|png|webp|gif)(\?\S*)?$/i;
const LOOSE_IMAGE_URL_RE = /^https?:\/\/\S*(image|photo|img|copart|iaai)\S*/i;

export function collectAsvImageHints(node: unknown, title = "", depth = 0, acc: AsvImageHint[] = []): AsvImageHint[] {
  if (depth > 8 || node == null) return acc;
  if (typeof node === "string") {
    const t = node.trim();
    if (IMAGE_URL_RE.test(t) || LOOSE_IMAGE_URL_RE.test(t)) {
      if (!acc.some((h) => h.url === t)) acc.push({ url: t.slice(0, 2000), title: title.slice(0, 120) });
    }
    return acc;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectAsvImageHints(item, title, depth + 1, acc);
    return acc;
  }
  const o = asRecord(node);
  if (!o) return acc;
  const nextTitle =
    stringifyVal(o.date ?? o.location ?? o.damages ?? o.collision ?? o.listing_id) || title;
  for (const [k, v] of Object.entries(o)) {
    if (IMAGE_KEY_RE.test(k) && typeof v === "string") {
      collectAsvImageHints(v, nextTitle, depth + 1, acc);
    } else {
      collectAsvImageHints(v, nextTitle, depth + 1, acc);
    }
  }
  return acc;
}

function parseTitles(raw: unknown): { titles: AsvTitleRow[]; mileage: AutoRecordsServiceRow[] } {
  if (!Array.isArray(raw)) return { titles: [], mileage: [] };
  const titles: AsvTitleRow[] = [];
  const mileage: AutoRecordsServiceRow[] = [];
  for (const item of raw.slice(0, 80)) {
    const o = asRecord(item);
    if (!o) continue;
    const date = toLvDate(o.date ?? o.title_date ?? o.issued ?? o.title_issued_date);
    const region = usRegion(o.state ?? o.state_code ?? o.region ?? o.jurisdiction);
    const odometer = odometerKm(
      o.meter ?? o.odometer ?? o.mileage,
      stringifyVal(o.meter_unit ?? o.mileage_unit ?? o.unit),
      true,
    );
    const note = [
      stringifyVal(o.brand),
      stringifyVal(o.type),
      stringifyVal(o.note),
      stringifyVal(o.title_type),
      o.is_current === true ? "aktuālais title" : "",
    ]
      .filter(Boolean)
      .join("; ")
      .slice(0, 200);
    if (date || region || odometer || note) {
      titles.push({ date, region, odometer, note });
    }
    if (date && odometer) {
      mileage.push({ date, odometer, country: region });
    }
  }
  return { titles, mileage };
}

function parseAccidents(raw: unknown): AsvDamageRow[] {
  if (!Array.isArray(raw)) return [];
  const out: AsvDamageRow[] = [];
  for (const item of raw.slice(0, 80)) {
    const o = asRecord(item);
    if (!o) continue;
    const source = asRecord(o.source);
    const description = [
      stringifyVal(o.collision ?? o.type ?? o.damage ?? o.damages ?? o.impact_point),
      stringifyVal(o.impact ?? o.severity ?? o.damage_severity),
      stringifyVal(o.cause_of_damage),
      stringifyVal(o.object_struck),
      stringifyVal(o.light_condition) ? `gaisma: ${stringifyVal(o.light_condition)}` : "",
      stringifyVal(o.airbag) ? `airbag: ${stringifyVal(o.airbag)}` : "",
    ]
      .filter(Boolean)
      .join(". ")
      .slice(0, 400);
    out.push({
      date: toLvDate(o.date ?? o.report_date),
      region: usRegion(o.state ?? o.state_code ?? source?.state_code ?? o.region ?? o.city ?? o.location),
      amount: amountEur(o.estimated_damage ?? o.damage_amount ?? o.amount ?? o.loss),
      description,
    });
  }
  return out.filter((r) => r.date || r.description || r.amount);
}

function parseSalvage(
  raw: unknown,
): { sales: AsvSaleRow[]; brands: AsvRecordRow[]; mileage: AutoRecordsServiceRow[]; damages: AsvDamageRow[] } {
  if (!Array.isArray(raw)) return { sales: [], brands: [], mileage: [], damages: [] };
  const sales: AsvSaleRow[] = [];
  const brands: AsvRecordRow[] = [];
  const mileage: AutoRecordsServiceRow[] = [];
  const damages: AsvDamageRow[] = [];
  for (const item of raw.slice(0, 80)) {
    const o = asRecord(item);
    if (!o) continue;
    const date = toLvDate(o.date ?? o.sale_date ?? o.salvage_auction_lot_date);
    const location = stringifyVal(o.location ?? o.auction ?? o.seller ?? o.salvage_auction_location);
    const listingId = stringifyVal(o.listing_id ?? o.lot ?? o.lot_number ?? o.salvage_auction_record_id);
    const odometer = odometerKm(
      o.odometer ?? o.meter ?? o.mileage,
      stringifyVal(o.meter_unit ?? o.mileage_unit),
      true,
    );
    const doc = stringifyVal(o.sale_document ?? o.document ?? o.title ?? o.salvage_title_type);
    const damagesTxt = [
      stringifyVal(o.damages ?? o.damage ?? o.primary_damage ?? o.primary_damage_desc),
      stringifyVal(o.secondary_damage_desc),
    ]
      .filter(Boolean)
      .join("; ");
    const url = listingUrl(listingId, location);
    const venue = [location, listingId ? `#${listingId}` : ""].filter(Boolean).join(" ").slice(0, 160);
    sales.push({
      date,
      venue,
      odometer,
      price: amountEur(o.sale_price ?? o.price ?? o.high_bid),
      status: (doc || "izsole").slice(0, 80),
    });
    brands.push({
      date,
      label: doc || "Salvage / izsole",
      detail: [damagesTxt, url].filter(Boolean).join(". ").slice(0, 400),
    });
    if (date && odometer) mileage.push({ date, odometer, country: usRegion(o.state) || "ASV" });
    if (damagesTxt) {
      damages.push({
        date,
        region: location.slice(0, 120) || usRegion(o.state),
        amount: amountEur(o.estimated_damage ?? o.sale_price),
        description: damagesTxt.slice(0, 400),
      });
    }
  }
  return { sales, brands, mileage, damages };
}

function parseSales(raw: unknown): { sales: AsvSaleRow[]; mileage: AutoRecordsServiceRow[] } {
  if (!Array.isArray(raw)) return { sales: [], mileage: [] };
  const sales: AsvSaleRow[] = [];
  const mileage: AutoRecordsServiceRow[] = [];
  for (const item of raw.slice(0, 80)) {
    const o = asRecord(item);
    if (!o) continue;
    const seller = asRecord(o.seller_details);
    const date = toLvDate(o.date ?? o.sale_date ?? o.listed ?? o.record_date);
    const venue = stringifyVal(
      o.seller ?? o.dealer ?? o.source ?? o.venue ?? o.site ?? seller?.name,
    ).slice(0, 160);
    const odometer = odometerKm(
      o.odometer ?? o.meter ?? o.mileage ?? o.mileage_observed,
      stringifyVal(o.meter_unit ?? o.mileage_unit),
      true,
    );
    sales.push({
      date,
      venue,
      odometer,
      price: amountEur(o.price ?? o.sale_price ?? o.asking ?? o.advertised_price),
      status: stringifyVal(o.status ?? o.type ?? o.record_type ?? o.state ?? seller?.seller_type).slice(0, 80),
    });
    if (date && odometer) {
      mileage.push({ date, odometer, country: usRegion(o.state ?? o.state_code ?? seller?.state_code) });
    }
  }
  return { sales, mileage };
}

function parseRecordList(raw: unknown, defaultLabel: string): AsvRecordRow[] {
  if (!Array.isArray(raw)) return [];
  const out: AsvRecordRow[] = [];
  for (const item of raw.slice(0, 40)) {
    const o = asRecord(item);
    if (!o) continue;
    out.push({
      date: toLvDate(o.date ?? o.record_date ?? o.stolen_date),
      label:
        stringifyVal(o.type ?? o.record_type ?? o.status ?? o.vehicle_status ?? o.brand ?? defaultLabel).slice(
          0,
          160,
        ) || defaultLabel,
      detail: [
        stringifyVal(o.state ?? o.state_code ?? o.region ?? o.theft_reported_state),
        stringifyVal(o.lienholder ?? o.holder ?? o.agency),
        stringifyVal(o.stolen_status),
        stringifyVal(o.recovery_date) ? `atgūts: ${toLvDate(o.recovery_date)}` : "",
        stringifyVal(o.note ?? o.detail ?? o.description ?? o.theft_report_id),
      ]
        .filter(Boolean)
        .join(". ")
        .slice(0, 400),
    });
  }
  return out.filter((r) => r.date || r.detail || r.label);
}

function parseJsi(raw: unknown): AsvRecordRow[] {
  if (!Array.isArray(raw)) return [];
  const out: AsvRecordRow[] = [];
  for (const item of raw.slice(0, 40)) {
    const o = asRecord(item);
    if (!o) continue;
    out.push({
      date: toLvDate(o.date),
      label: stringifyVal(o.int_type ?? o.type ?? o.record_type ?? o.brand ?? "JSI").slice(0, 160),
      detail: [
        stringifyVal(o.state ?? o.brander_state_code),
        stringifyVal(o.reporting_entity ?? o.brander_name),
        stringifyVal(o.brander_city),
        stringifyVal(o.vehicle_disposition),
        stringifyVal(o.intended_for_export) === "Y" ? "paredzēts eksportam" : "",
        stringifyVal(o.note),
      ]
        .filter(Boolean)
        .join(". ")
        .slice(0, 400),
    });
  }
  return out.filter((r) => r.date || r.detail);
}

function parseTitleBrands(raw: unknown): AsvRecordRow[] {
  if (!Array.isArray(raw)) return [];
  const out: AsvRecordRow[] = [];
  for (const item of raw.slice(0, 40)) {
    const o = asRecord(item);
    if (!o) continue;
    out.push({
      date: toLvDate(o.date),
      label: stringifyVal(o.brand_title ?? o.brand ?? o.title).slice(0, 160) || "Title zīme",
      detail: [
        stringifyVal(o.brander_name ?? o.state ?? o.state_code),
        stringifyVal(o.brand_code),
        stringifyVal(o.brand_desc).slice(0, 220),
      ]
        .filter(Boolean)
        .join(". ")
        .slice(0, 400),
    });
  }
  return out.filter((r) => r.date || r.label || r.detail);
}

function listLen(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

function brandTextHits(raw: unknown, re: RegExp): boolean {
  if (!Array.isArray(raw)) return false;
  return raw.some((item) => {
    const o = asRecord(item);
    if (!o) return false;
    return re.test(`${stringifyVal(o.brand_title)} ${stringifyVal(o.brand)} ${stringifyVal(o.label)}`);
  });
}

function deriveChecks(root: Record<string, unknown>): AsvCheckRow[] {
  const salvageHit =
    listLen(root.salvage_data ?? root.salvage) > 0 ||
    listLen(root.junk_salvage_insurance ?? root.jsi) > 0 ||
    brandTextHits(root.title_brands, /salvage|junk|rebuilt|flood|lemon/i);
  const rows: Array<{ key: string; hit: boolean }> = [
    { key: "salvage", hit: salvageHit },
    { key: "rebuilt", hit: brandTextHits(root.title_brands, /rebuilt/i) },
    { key: "flood", hit: brandTextHits(root.title_brands, /flood/i) },
    { key: "theft", hit: listLen(root.thefts ?? root.theft) > 0 },
    { key: "lien", hit: listLen(root.liens ?? root.lien) > 0 },
    { key: "insurance", hit: listLen(root.accidents) > 0 || listLen(root.junk_salvage_insurance) > 0 },
    { key: "export", hit: listLen(root.export ?? root.exports) > 0 },
    { key: "impound", hit: listLen(root.impound ?? root.impounds) > 0 },
  ];
  return rows.map(({ key, hit }) => ({
    label: (CHECK_LABELS[key] ?? key).slice(0, 120),
    status: hit ? "atrasts ieraksts" : "nav ieraksta",
    severity: hit ? "alert" : "ok",
  }));
}

export function parseVinauditPayload(raw: unknown, meta?: { productUsed?: string; costUsd?: string; vin?: string }): AsvParseResult {
  const root = unwrapVinaudit(raw);
  const empty = emptyAsvBlock();
  if (!root) return { block: empty, imageHints: [] };

  const titlesParsed = parseTitles(root.titles ?? root.title_history ?? root.nmvtis);
  const accidents = parseAccidents(root.accidents ?? root.accident ?? root.damage_history);
  const salvage = parseSalvage(root.salvage_data ?? root.salvage ?? root.salvage_records ?? root.auctions);
  const salesParsed = parseSales(root.sales_data ?? root.sale ?? root.sales ?? root.listings);
  const parsedChecks = parseChecks(root.checks ?? root.brands ?? root.brand_checks);
  const checks = parsedChecks.length > 0 ? parsedChecks : deriveChecks(root);
  const liens = [
    ...parseRecordList(root.lien ?? root.liens, "Ķīla"),
    ...parseRecordList(root.impound ?? root.impounds, "Aizturēšana"),
    ...parseRecordList(root.export ?? root.exports, "Eksports"),
  ];
  const thefts = parseRecordList(root.thefts ?? root.theft, "Zādzība");
  const jsi = parseJsi(root.jsi ?? root.junk_salvage_insurance);
  const titleBrands = parseTitleBrands(root.title_brands);

  const mileage = dedupeMileage([
    ...titlesParsed.mileage,
    ...salvage.mileage,
    ...salesParsed.mileage,
  ]);

  const brands = [...titleBrands, ...jsi, ...salvage.brands];
  const sales = [...salvage.sales, ...salesParsed.sales];
  const damages = [...accidents, ...salvage.damages];

  const alertCount = checks.filter((c) => c.severity === "alert").length;
  const attentionMarks = checks.length > 0 ? `${alertCount}/${checks.length}` : "";

  const vehicle = asRecord(root.vehicle_data) ?? asRecord(root.attributes) ?? asRecord(root.vehicle) ?? {};
  const ownerRaw = stringifyVal(vehicle.owner_count ?? vehicle.owners ?? root.owners ?? root.owner_count);
  const reportDate = toLvDate(
    vehicle.vehicle_history_checked_datetime ?? root.date ?? root.generated ?? root.created,
  );
  const reportId = stringifyVal(vehicle.report_id ?? root.id ?? root.report_id ?? root.reportId);
  const vin =
    stringifyVal(meta?.vin) ||
    stringifyVal(vehicle.vehicle_identification_number ?? root.vin);

  const identity = [
    stringifyVal(vehicle.model_year ?? vehicle.year),
    stringifyVal(vehicle.manufacturer_desc ?? vehicle.make),
    stringifyVal(vehicle.model_range_desc ?? vehicle.model),
    stringifyVal(vehicle.trim_desc ?? vehicle.trim),
  ]
    .filter(Boolean)
    .join(" ");

  const aiBits = [
    identity ? `Identitāte: ${identity}` : "",
    reportId ? `ASV report_id: ${reportId} (atkārtota ielāde ar šo ID, lai nepirktu jaunu atskaiti)` : "",
    stringifyVal(root.clean) ? `clean: ${stringifyVal(root.clean)}` : "",
    meta?.productUsed ? `Ielādētais produkts: ${meta.productUsed}` : "",
    "Servisa apmeklējumi no ASV title/izsoļu datiem nav pieejami. Tie nav OEM apkopes.",
  ].filter(Boolean);

  const imageHints = collectAsvImageHints(root);

  const block: AsvBlockState = {
    ...empty,
    reportDate,
    attentionMarks,
    ownersCount: ownerRaw.slice(0, 20),
    productUsed: (meta?.productUsed ?? "").slice(0, 40),
    reportId: reportId.slice(0, 80),
    lastCostUsd: (meta?.costUsd ?? "").slice(0, 20),
    lastFetchedVin: vin.slice(0, 20),
    fetchedAt: new Date().toISOString().slice(0, 40),
    checks,
    mileage: mileage.length > 0 ? mileage : empty.mileage,
    damages: damages.length > 0 ? damages : empty.damages,
    brands: brands.length > 0 ? brands : empty.brands,
    titles: titlesParsed.titles.length > 0 ? titlesParsed.titles : empty.titles,
    sales: sales.length > 0 ? sales : empty.sales,
    liens: liens.length > 0 ? liens : empty.liens,
    thefts: thefts.length > 0 ? thefts : empty.thefts,
    rawUnprocessedData: JSON.stringify(root).slice(0, 200000),
    aiContextRaw: aiBits.join("\n").slice(0, 200000),
  };

  return { block, imageHints };
}

export function milesToKmRounded(miles: number): number {
  return Math.round(miles * MILES_TO_KM);
}

export function vinauditPayloadLooksEmpty(raw: unknown): boolean {
  const root = unwrapVinaudit(raw);
  if (!root) return true;
  const hasList = [
    "titles",
    "title_brands",
    "accidents",
    "salvage",
    "salvage_data",
    "sale",
    "sales",
    "sales_data",
    "lien",
    "liens",
    "thefts",
    "jsi",
    "junk_salvage_insurance",
    "impound",
    "export",
  ].some((k) => Array.isArray(root[k]) && (root[k] as unknown[]).length > 0);
  if (hasList) return false;
  const checks = asRecord(root.checks);
  if (checks && Object.values(checks).some((v) => v === true)) return false;
  const vehicle = asRecord(root.vehicle_data);
  if (vehicle && stringifyVal(vehicle.vehicle_identification_number).length >= 8) return false;
  return stringifyVal(root.vin).length < 8 && stringifyVal(root.id).length < 2;
}
