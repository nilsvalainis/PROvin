/**
 * PRO ADMIN sadaļa «Dīlera datu pārbaude»: tīra loģika bez I/O.
 * Iekšēja OneAuto ielāde bez klienta pasūtījuma. Speckr nav.
 */
import { formatEurFromCents } from "@/lib/order-upsell";
import { isValidPlateNumber, isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";
import {
  ONEAUTO_PRODUCTS,
  ONEAUTO_PRODUCT_IDS,
  filledOneautoServiceEvents,
  oneautoChargedCostCents,
  oneautoProductsCostCents,
  type OneautoDisplaySections,
  type OneautoProductId,
  type OneautoResultLike,
} from "@/lib/oneauto-catalog";
import { oneautoDisplayToServiceWorks } from "@/lib/oneauto-dealer";
import { oneautoDisplayToMileageRows, oneautoPowertrainToVehicleInfo } from "@/lib/oneauto-to-auto-records";
import { formatKmGrouped } from "@/lib/miles-to-km";
import { LV_MONTH_NAMES, rigaYearMonthKey } from "@/lib/admin-riga-calendar";
import { formatRigaIsoShort } from "@/lib/riga-datetime";
import type { OneautoProductResult } from "@/lib/oneauto-block";

export const DEALER_CHECK_PAGE_PATH = "/admin/dilera-dati" as const;

export const DEALER_CHECK_TEMPLATES = ["dzintarzeme", "cits"] as const;
export type DealerCheckTemplateId = (typeof DEALER_CHECK_TEMPLATES)[number];

export const DEALER_CHECK_TEMPLATE_LABEL: Record<DealerCheckTemplateId, string> = {
  dzintarzeme: "Dzintarzeme Auto",
  cits: "Cits",
};

export const DEALER_CHECK_TEMPLATE_SHORT: Record<DealerCheckTemplateId, string> = {
  dzintarzeme: "Dzintarzeme",
  cits: "Cits",
};

export const DEALER_CHECK_DEFAULT_TEMPLATE: DealerCheckTemplateId = "dzintarzeme";

/** Noklusējumā visi OneAuto avoti izslēgti. Nils atzīmē pats. */
export const DEALER_CHECK_DEFAULT_SELECTED: readonly OneautoProductId[] = [];

export const DEALER_CHECK_SOURCE_HINTS: Record<OneautoProductId, string> = {
  vin_decoder: "Pamatdati",
  oe_vin_lookup: "Rūpnīcas specifikācija",
  oe_build_sheet: "Komplektācija, PR kodi",
  oe_service_history: "Dīlera servisa ieraksti",
};

export type DealerCheckSource = {
  id: OneautoProductId;
  label: string;
  hint: string;
  priceCents: number;
};

export const DEALER_CHECK_SOURCES: readonly DealerCheckSource[] = ONEAUTO_PRODUCTS.map((p) => ({
  id: p.id,
  label: p.label,
  hint: DEALER_CHECK_SOURCE_HINTS[p.id],
  priceCents: p.priceCents,
}));

export type DealerCheckVehicleInfo = {
  make: string;
  model: string;
  body: string;
  engine: string;
  firstReg: string;
  color: string;
  gearbox: string;
  manufacturer: string;
  vin: string;
};

export type DealerCheckMileageRow = { date: string; odometer: string; source: string };
export type DealerCheckServiceRow = { date: string; km: string; works: string; dealer: string };

export type DealerCheckComments = {
  serviceHistory: string;
  oilIntervals: string;
};

export type DealerCheckCsddCompare = {
  firstRegLv: string;
  odometer: string;
  inspectionUntil: string;
  match: "match" | "none" | "mismatch";
  matchLabel: string;
};

export type DealerCheckAutoparksLink = {
  carId: string;
  title: string;
  stockPath: string;
  dropboxFolderId: string;
};

export type DealerCheckLedgerSlot = { cents: number; loads: number };

export type DealerCheckLedgerMonth = {
  monthKey: string;
  dzintarzeme: DealerCheckLedgerSlot;
  cits: DealerCheckLedgerSlot;
};

export type DealerCheckRecord = {
  id: string;
  vin: string;
  plate: string;
  template: DealerCheckTemplateId;
  selectedProducts: OneautoProductId[];
  results: Partial<Record<OneautoProductId, OneautoProductResult>>;
  display: OneautoDisplaySections;
  displayOriginal: OneautoDisplaySections;
  vehicle: DealerCheckVehicleInfo;
  mileageRows: DealerCheckMileageRow[];
  serviceRows: DealerCheckServiceRow[];
  comments: DealerCheckComments;
  csdd: DealerCheckCsddCompare | null;
  chargedCents: number;
  quotedCents: number;
  fetchedAt: string;
  monthKey: string;
  autoparks: DealerCheckAutoparksLink | null;
  saved: boolean;
  createdAt: string;
  updatedAt: string;
};

const HTTP_206_ERROR = "http_206";

const NO_HISTORY_PHRASES = [
  "vēstures nav",
  "nav vēstures",
  "vēsture nav",
  "history not found",
  "no service history",
  "nav servisa vēstures",
];

export function isDealerCheckTemplateId(v: unknown): v is DealerCheckTemplateId {
  return typeof v === "string" && (DEALER_CHECK_TEMPLATES as readonly string[]).includes(v);
}

export function parseDealerCheckTemplateId(raw: unknown): DealerCheckTemplateId {
  return isDealerCheckTemplateId(raw) ? raw : DEALER_CHECK_DEFAULT_TEMPLATE;
}

export function isSafeDealerCheckId(id: string): boolean {
  return /^dc-[a-zA-Z0-9-]{8,80}$/.test(id.trim());
}

export function oneautoResultIsHttp206(result: OneautoResultLike | null | undefined): boolean {
  if (!result) return false;
  return result.httpStatus === 206 || result.error === HTTP_206_ERROR;
}

export function dealerCheckHasHttp206(
  results: Partial<Record<OneautoProductId, OneautoResultLike | undefined>>,
): boolean {
  return ONEAUTO_PRODUCT_IDS.some((id) => oneautoResultIsHttp206(results[id]));
}

export function dealerCheckServiceHistoryHttp206(
  results: Partial<Record<OneautoProductId, OneautoResultLike | undefined>>,
): boolean {
  return oneautoResultIsHttp206(results.oe_service_history);
}

export function dealerCheckSelection(ids: readonly OneautoProductId[]): {
  count: number;
  cents: number;
  canLoad: boolean;
} {
  const unique = [...new Set(ids)];
  const cents = oneautoProductsCostCents(unique);
  return { count: unique.length, cents, canLoad: unique.length > 0 };
}

export function dealerCheckCanLoad(ids: readonly OneautoProductId[]): boolean {
  return dealerCheckSelection(ids).canLoad;
}

/** Iekasē tikai ok rezultātus. HTTP 206 / no_data / kļūda = 0. */
export function dealerCheckChargedCents(
  ids: readonly OneautoProductId[],
  results: Partial<Record<OneautoProductId, OneautoResultLike>>,
): number {
  return oneautoChargedCostCents(ids, results);
}

export function formatDealerCheckEur(cents: number): string {
  return formatEurFromCents(cents);
}

export function dealerCheckPageHref(args: { vin?: string; from?: "autoparks"; plate?: string } = {}): string {
  const q = new URLSearchParams();
  const vin = normalizeVin(args.vin ?? "");
  if (vin) q.set("vin", vin);
  const plate = (args.plate ?? "").trim();
  if (plate) q.set("vn", plate);
  if (args.from === "autoparks") q.set("no", "autoparks");
  const qs = q.toString();
  return qs ? `${DEALER_CHECK_PAGE_PATH}?${qs}` : DEALER_CHECK_PAGE_PATH;
}

export function parseDealerCheckSearchVin(raw: string | null | undefined): string {
  const vin = normalizeVin(raw ?? "");
  return isValidVin(vin) ? vin : "";
}

export function parseDealerCheckSearchPlate(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (isValidPlateNumber(t)) return normalizeDealerCheckPlate(t);
  return t.toUpperCase();
}

export function emptyDealerCheckVehicle(vin = ""): DealerCheckVehicleInfo {
  return {
    make: "",
    model: "",
    body: "",
    engine: "",
    firstReg: "",
    color: "",
    gearbox: "",
    manufacturer: "",
    vin: normalizeVin(vin),
  };
}

export function emptyDealerCheckComments(): DealerCheckComments {
  return { serviceHistory: "", oilIntervals: "" };
}

export function emptyDealerCheckLedgerMonth(monthKey: string): DealerCheckLedgerMonth {
  return {
    monthKey,
    dzintarzeme: { cents: 0, loads: 0 },
    cits: { cents: 0, loads: 0 },
  };
}

export function addDealerCheckLedgerLoad(
  month: DealerCheckLedgerMonth,
  template: DealerCheckTemplateId,
  chargedCents: number,
): DealerCheckLedgerMonth {
  const slot = month[template];
  return {
    ...month,
    [template]: {
      cents: slot.cents + Math.max(0, chargedCents),
      loads: slot.loads + 1,
    },
  };
}

export function formatDealerCheckMonthName(monthKey: string): string {
  const month = Number(monthKey.slice(5, 7));
  return LV_MONTH_NAMES[month - 1] ?? monthKey;
}

export function formatDealerCheckLedgerBar(month: DealerCheckLedgerMonth): string {
  const name = formatDealerCheckMonthName(month.monthKey);
  const dza = month.dzintarzeme;
  const other = month.cits;
  return `${DEALER_CHECK_TEMPLATE_SHORT.dzintarzeme} · ${name} ${formatDealerCheckEur(dza.cents)} · ${dza.loads} ielādes | ${DEALER_CHECK_TEMPLATE_SHORT.cits} · ${formatDealerCheckEur(other.cents)} · ${other.loads}`;
}

export function formatDealerCheckDateLv(isoOrDot: string): string {
  const t = isoOrDot.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const ym = /^(\d{4})-(\d{2})$/.exec(t);
  if (ym) return `${ym[2]}.${ym[1]}`;
  return t;
}

function pickPowertrain(rows: OneautoDisplaySections["powertrain"], re: RegExp): string {
  for (const row of rows) {
    if (re.test(row.label)) return row.value.trim();
  }
  return "";
}

export function dealerCheckVehicleFromDisplay(
  display: OneautoDisplaySections | null | undefined,
  vin: string,
): DealerCheckVehicleInfo {
  const rows = display?.powertrain ?? [];
  const mapped = oneautoPowertrainToVehicleInfo(rows).vehicleInfo;
  const make =
    pickPowertrain(rows, /^(make|marka|brand|manufacturer)$/i) ||
    (mapped.model ?? "").split(/\s+/)[0] ||
    "";
  const model = (mapped.model ?? "").trim();
  const modelWithoutMake =
    make && model.toLowerCase().startsWith(make.toLowerCase()) ? model.slice(make.length).trim() : model;
  const displacement = (mapped.displacement ?? "").trim();
  const fuel = (mapped.fuel ?? "").trim();
  const power = (mapped.power ?? "").trim();
  const engineParts = [displacement, fuel, power].filter(Boolean);
  return {
    make: make || (mapped.model ? mapped.model.split(/\s+/)[0] ?? "" : ""),
    model: modelWithoutMake || model,
    body: (mapped.body ?? "").trim() || pickPowertrain(rows, /body|virsbūv|body.?style/i),
    engine: engineParts.join(" · ") || (mapped.engineCode ?? "").trim(),
    firstReg: formatDealerCheckDateLv((mapped.firstRegistration ?? mapped.productionDate ?? "").trim()),
    color: (mapped.color ?? "").trim(),
    gearbox: (mapped.transmission ?? "").trim() || pickPowertrain(rows, /transmission|pārnesum|gearbox/i),
    manufacturer: pickPowertrain(rows, /manufacturer|ražotāj|oem/i),
    vin: normalizeVin(vin) || (mapped.vinCode ?? "").trim(),
  };
}

export function dealerCheckMileageRowsFromDisplay(
  display: OneautoDisplaySections | null | undefined,
): DealerCheckMileageRow[] {
  return oneautoDisplayToMileageRows(display ?? { equipment: [], serviceTimeline: [], powertrain: [] }).map((row) => {
    const km = Number.parseInt(row.odometer.replace(/\D/g, ""), 10);
    return {
      date: row.date,
      odometer: Number.isFinite(km) && km > 0 ? `${formatKmGrouped(km)} km` : row.odometer,
      source: "Dīlera serviss",
    };
  });
}

export function dealerCheckServiceRowsFromDisplay(
  display: OneautoDisplaySections | null | undefined,
): DealerCheckServiceRow[] {
  return oneautoDisplayToServiceWorks(display).map((row) => {
    const km = Number.parseInt(row.odometer.replace(/\D/g, ""), 10);
    return {
      date: row.date,
      km: Number.isFinite(km) && km > 0 ? formatKmGrouped(km) : row.odometer,
      works: row.works,
      dealer: formatDealerPlace(row.location),
    };
  });
}

function formatDealerPlace(location: string): string {
  const t = location.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const country = /^(DE|LV|LT|EE|PL|AT|NL|BE|FR|IT|ES|GB|UK|SE|NO|FI|CZ|SK|HU|RO|BG)\b/i.exec(t);
  if (country && t.includes("·")) return t;
  const city = t.split(",")[0]?.trim() ?? t;
  if (/^[A-Z]{2}\b/.test(t)) return t.replace(/\s*[,/|-]\s*/, " · ");
  return city;
}

export function lastDealerCheckOdometerKm(rows: readonly DealerCheckMileageRow[]): number | null {
  for (const row of rows) {
    const n = Number.parseInt(row.odometer.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function compareDealerCheckCsdd(args: {
  dealerLastKm: number | null;
  csddKm: number | null;
  http206: boolean;
  firstRegLv?: string;
  inspectionUntil?: string;
}): DealerCheckCsddCompare {
  const firstRegLv = (args.firstRegLv ?? "").trim();
  const inspectionUntil = (args.inspectionUntil ?? "").trim();
  const odometer =
    args.csddKm != null && args.csddKm > 0 ? `${formatKmGrouped(args.csddKm)} km` : "";
  if (args.http206 || args.dealerLastKm == null || args.csddKm == null) {
    return {
      firstRegLv,
      odometer,
      inspectionUntil,
      match: "none",
      matchLabel: "nav ar ko salīdzināt",
    };
  }
  const diff = Math.abs(args.dealerLastKm - args.csddKm);
  const pct = args.csddKm > 0 ? diff / args.csddKm : 1;
  const close = diff <= 2000 || pct <= 0.03;
  return {
    firstRegLv,
    odometer,
    inspectionUntil,
    match: close ? "match" : "mismatch",
    matchLabel: close ? "✓ sakrīt ar dīlera datiem" : "atšķiras no dīlera datiem",
  };
}

export function dealerCheckHttp206Comments(make = ""): DealerCheckComments {
  const brand = make.trim();
  return {
    serviceHistory:
      "Servisa ieraksti no API nav saņemti (206). Neizdarīt secinājumu par vēstures neesamību.",
    oilIntervals: brand
      ? `${brand} apkopes intervāls pēc ražotāja; dati nepietiekami (206).`
      : "Dati nepietiekami (206). Neizdarīt secinājumu par vēstures neesamību.",
  };
}

export function dealerCheckForbidsNoHistoryClaim(text: string): boolean {
  const n = text.toLowerCase().replace(/tukšs\s*≠\s*vēstures nav/g, "");
  return NO_HISTORY_PHRASES.some((p) => n.includes(p));
}

export function sanitizeDealerCheckComment(text: string, http206: boolean): string {
  const trimmed = text.replace(/\u2014|\u2013/g, "-").trim();
  if (!http206) return trimmed.slice(0, 8000);
  if (!trimmed) return dealerCheckHttp206Comments().serviceHistory;
  if (dealerCheckForbidsNoHistoryClaim(trimmed)) {
    return dealerCheckHttp206Comments().serviceHistory;
  }
  return trimmed.slice(0, 8000);
}

export function formatDealerCheckProductLog(
  id: OneautoProductId,
  result: OneautoResultLike | undefined,
): string {
  const product = DEALER_CHECK_SOURCES.find((s) => s.id === id);
  const label = product?.label ?? id;
  if (!result) return `${label} nav atbildes`;
  if (oneautoResultIsHttp206(result)) {
    return `⚠ ${label} · HTTP 206 (0,00 €)`;
  }
  if (result.ok) {
    return `✓ ${label} ${formatDealerCheckEur(product?.priceCents ?? 0)}`;
  }
  return `✗ ${label} · nav iekasēts`;
}

export function formatDealerCheckLoadLog(args: {
  results: Partial<Record<OneautoProductId, OneautoResultLike>>;
  selected: readonly OneautoProductId[];
  fetchedAt: string;
  template: DealerCheckTemplateId;
  chargedCents: number;
  monthKey?: string;
}): string {
  const lines = args.selected.map((id) => formatDealerCheckProductLog(id, args.results[id]));
  const when = formatRigaIsoShort(args.fetchedAt) || args.fetchedAt;
  const monthName = formatDealerCheckMonthName(args.monthKey ?? rigaYearMonthKey(Date.parse(args.fetchedAt) || Date.now()));
  const footer = `Ielādēts ${when} · šablons ${DEALER_CHECK_TEMPLATE_LABEL[args.template]} · ${formatDealerCheckEur(args.chargedCents)} pieskaitīts ${monthName} uzskaitei`;
  return `${lines.join(" · ")}\n${footer}`;
}

export function dealerCheckHttp206Warning(): { title: string; body: string } {
  return {
    title: "OneAuto 206 - nav datu no API (bez maksas).",
    body: "BMW full coverage: pārbaudi citus avotus - tukšs ≠ vēstures nav.",
  };
}

export function dealerCheckMileageHttp206Note(opts: { mentionCsdd?: boolean } = {}): string {
  const base = "Nobraukums no servisa ierakstiem nav saņemts (206).";
  return opts.mentionCsdd ? `${base} Skatīt CSDD bloku zemāk.` : base;
}

export function dealerCheckEmptyStateText(): string {
  return "Ievadi VIN vai numurzīmi un atzīmē OneAuto avotus. Numurzīme aizpilda VIN no CSDD. Nekas netiek iekasēts līdz «Ielādēt».";
}

export function findAutoparksCarByVin<T extends { vin?: string | null }>(
  cars: readonly T[],
  vin: string,
): T | null {
  const n = normalizeVin(vin);
  if (!isValidVin(n)) return null;
  return cars.find((c) => normalizeVin(c.vin ?? "") === n) ?? null;
}

export function normalizeDealerCheckPlate(raw: string): string {
  const compact = normalizePlateNumber(raw);
  if (!compact) return "";
  if (/^[A-Z]{2}\d{1,4}$/.test(compact)) return `${compact.slice(0, 2)}-${compact.slice(2)}`;
  return compact;
}

export function dealerCheckHasResult(record: DealerCheckRecord | null | undefined): boolean {
  if (!record) return false;
  return Boolean(
    record.fetchedAt ||
      record.mileageRows.length > 0 ||
      record.serviceRows.length > 0 ||
      record.vehicle.make ||
      dealerCheckHasHttp206(record.results),
  );
}

export function buildDealerCheckLvHtml(record: DealerCheckRecord): string {
  const v = record.vehicle;
  const http206 = dealerCheckServiceHistoryHttp206(record.results);
  const comments = {
    serviceHistory: sanitizeDealerCheckComment(record.comments.serviceHistory, http206),
    oilIntervals: sanitizeDealerCheckComment(record.comments.oilIntervals, http206),
  };
  const kv = [
    ["Marka", v.make],
    ["Modelis", v.model],
    ["Virsbūve", v.body],
    ["Dzinējs", v.engine],
    ["Pirmā reģ.", v.firstReg],
    ["Krāsa", v.color],
    ["Pārnesumkārba", v.gearbox],
    ["Ražotājs", v.manufacturer],
    ["VIN", v.vin],
  ]
    .filter(([, val]) => val)
    .map(([k, val]) => `<div><span>${escapeHtml(k)}</span><b>${escapeHtml(val)}</b></div>`)
    .join("");

  const mileage = http206
    ? `<p>${escapeHtml(dealerCheckMileageHttp206Note())}</p>`
    : record.mileageRows.length === 0
      ? "<p>Nobraukuma ierakstu nav.</p>"
      : `<table><tr><th>Datums</th><th>Odometrs</th><th>Avots</th></tr>${record.mileageRows
          .map(
            (r) =>
              `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.odometer)}</td><td>${escapeHtml(r.source)}</td></tr>`,
          )
          .join("")}</table>`;

  const service = http206
    ? `<p><b>${escapeHtml(dealerCheckHttp206Warning().title)}</b><br>${escapeHtml(dealerCheckHttp206Warning().body)}</p>`
    : record.serviceRows.length === 0
      ? "<p>Servisa ierakstu nav.</p>"
      : `<table><tr><th>Datums</th><th>Km</th><th>Darbi</th><th>Dīleris</th></tr>${record.serviceRows
          .map(
            (r) =>
              `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.km)}</td><td>${escapeHtml(r.works)}</td><td>${escapeHtml(r.dealer)}</td></tr>`,
          )
          .join("")}</table>`;

  return `<!doctype html><html lang="lv"><head><meta charset="utf-8"><title>Dīlera dati ${escapeHtml(v.vin)}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;color:#111;margin:24px;font-size:13px}
h1{font-size:22px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.4px;color:#3a3a3c}
.kv{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 16px;margin:12px 0}
.kv span{display:block;color:#8e8e93;font-size:11px}.kv b{font-weight:500}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
.warn{background:#fffbeb;border:1px solid #fcd34d;padding:10px 12px;border-radius:8px}
</style></head><body>
<h1>Dīlera datu pārbaude</h1>
<p>VIN ${escapeHtml(v.vin)}${record.plate ? ` · ${escapeHtml(record.plate)}` : ""} · ${escapeHtml(DEALER_CHECK_TEMPLATE_LABEL[record.template])}</p>
<h2>Transporta informācija</h2><div class="kv">${kv}</div>
<h2>Nobraukuma vēsture</h2>${http206 ? `<div class="warn">${mileage}</div>` : mileage}
<h2>Servisa vēsture</h2>${http206 ? `<div class="warn">${service}</div>` : service}
<h2>Gemini: Servisa vēsture</h2><p>${escapeHtml(comments.serviceHistory)}</p>
<h2>Gemini: Apkopes intervāli</h2><p>${escapeHtml(comments.oilIntervals)}</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function dealerCheckHasCsddInHtml(html: string): boolean {
  return /CSDD/i.test(html);
}

export function filledServiceTimelineCount(display: OneautoDisplaySections | null | undefined): number {
  return filledOneautoServiceEvents(display?.serviceTimeline ?? []).length;
}
