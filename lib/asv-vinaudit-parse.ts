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
    const date = toLvDate(o.date ?? o.title_date ?? o.issued);
    const region = usRegion(o.state ?? o.region ?? o.jurisdiction);
    const odometer = odometerKm(o.meter ?? o.odometer ?? o.mileage, stringifyVal(o.meter_unit ?? o.unit), true);
    const note = [stringifyVal(o.brand), stringifyVal(o.type), stringifyVal(o.note), stringifyVal(o.title_type)]
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
    const description = [
      stringifyVal(o.collision ?? o.type ?? o.damage ?? o.damages),
      stringifyVal(o.impact ?? o.severity),
      stringifyVal(o.airbag) ? `airbag: ${stringifyVal(o.airbag)}` : "",
    ]
      .filter(Boolean)
      .join(". ")
      .slice(0, 400);
    out.push({
      date: toLvDate(o.date),
      region: usRegion(o.state ?? o.region ?? o.location),
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
    const date = toLvDate(o.date ?? o.sale_date);
    const location = stringifyVal(o.location ?? o.auction ?? o.seller);
    const listingId = stringifyVal(o.listing_id ?? o.lot ?? o.lot_number);
    const odometer = odometerKm(o.odometer ?? o.meter ?? o.mileage, stringifyVal(o.meter_unit), true);
    const doc = stringifyVal(o.sale_document ?? o.document ?? o.title);
    const damagesTxt = stringifyVal(o.damages ?? o.damage ?? o.primary_damage);
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
    const date = toLvDate(o.date ?? o.sale_date ?? o.listed);
    const venue = stringifyVal(o.seller ?? o.dealer ?? o.source ?? o.venue ?? o.site).slice(0, 160);
    const odometer = odometerKm(o.odometer ?? o.meter ?? o.mileage, stringifyVal(o.meter_unit), true);
    sales.push({
      date,
      venue,
      odometer,
      price: amountEur(o.price ?? o.sale_price ?? o.asking),
      status: stringifyVal(o.status ?? o.type ?? o.state).slice(0, 80),
    });
    if (date && odometer) mileage.push({ date, odometer, country: usRegion(o.state) });
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
      date: toLvDate(o.date),
      label: stringifyVal(o.type ?? o.status ?? o.brand ?? defaultLabel).slice(0, 160) || defaultLabel,
      detail: [
        stringifyVal(o.state ?? o.region),
        stringifyVal(o.lienholder ?? o.holder ?? o.agency),
        stringifyVal(o.note ?? o.detail ?? o.description),
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
      label: stringifyVal(o.int_type ?? o.type ?? o.brand ?? "JSI").slice(0, 160),
      detail: [stringifyVal(o.state), stringifyVal(o.reporting_entity), stringifyVal(o.note)]
        .filter(Boolean)
        .join(". ")
        .slice(0, 400),
    });
  }
  return out.filter((r) => r.date || r.detail);
}

export function parseVinauditPayload(raw: unknown, meta?: { productUsed?: string; costUsd?: string; vin?: string }): AsvParseResult {
  const root = unwrapVinaudit(raw);
  const empty = emptyAsvBlock();
  if (!root) return { block: empty, imageHints: [] };

  const titlesParsed = parseTitles(root.titles ?? root.title_history ?? root.nmvtis);
  const accidents = parseAccidents(root.accidents ?? root.accident ?? root.damage_history);
  const salvage = parseSalvage(root.salvage ?? root.salvage_records ?? root.auctions);
  const salesParsed = parseSales(root.sale ?? root.sales ?? root.listings);
  const checks = parseChecks(root.checks ?? root.brands ?? root.brand_checks);
  const liens = [
    ...parseRecordList(root.lien ?? root.liens, "Ķīla"),
    ...parseRecordList(root.impound ?? root.impounds, "Aizturēšana"),
    ...parseRecordList(root.export ?? root.exports, "Eksports"),
  ];
  const thefts = parseRecordList(root.thefts ?? root.theft, "Zādzība");
  const jsi = parseJsi(root.jsi ?? root.junk_salvage_insurance);

  const mileage = dedupeMileage([
    ...titlesParsed.mileage,
    ...salvage.mileage,
    ...salesParsed.mileage,
  ]);

  const brands = [...jsi, ...salvage.brands];
  const sales = [...salvage.sales, ...salesParsed.sales];
  const damages = [...accidents, ...salvage.damages];

  const alertCount = checks.filter((c) => c.severity === "alert").length;
  const attentionMarks = checks.length > 0 ? `${alertCount}/${checks.length}` : "";

  const attrs = asRecord(root.attributes) ?? asRecord(root.vehicle) ?? {};
  const ownerRaw = stringifyVal(attrs.owner_count ?? attrs.owners ?? root.owners ?? root.owner_count);
  const reportDate = toLvDate(root.date ?? root.generated ?? root.created);
  const reportId = stringifyVal(root.id ?? root.report_id ?? root.reportId);

  const aiBits = [
    attrs.year || attrs.make || attrs.model
      ? `Identitāte: ${[stringifyVal(attrs.year), stringifyVal(attrs.make), stringifyVal(attrs.model), stringifyVal(attrs.trim)].filter(Boolean).join(" ")}`
      : "",
    reportId ? `VIN Audit report_id: ${reportId} (kešs ~90 dienas)` : "",
    stringifyVal(root.clean) ? `clean: ${stringifyVal(root.clean)}` : "",
    meta?.productUsed ? `Ielādētais produkts: ${meta.productUsed}` : "",
    "Servisa apmeklējumi no VIN Audit nav pieejami — title/izsoles nav OEM apkopes.",
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
    lastFetchedVin: (meta?.vin ?? stringifyVal(root.vin)).slice(0, 20),
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
  const hasList = ["titles", "accidents", "salvage", "sale", "sales", "lien", "thefts", "jsi"].some(
    (k) => Array.isArray(root[k]) && (root[k] as unknown[]).length > 0,
  );
  if (hasList) return false;
  const checks = asRecord(root.checks);
  if (checks && Object.values(checks).some((v) => v === true)) return false;
  return stringifyVal(root.vin).length < 8 && stringifyVal(root.id).length < 2;
}
