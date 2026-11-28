/**
 * CheckCar.vin atskaites lapas datu stāvoklis (`window.__NUXT__` -> `report.data`) un izvērstais teksts
 * -> strukturēti `cc_vin` lauki.
 *
 * 28.11 (Nils): no CheckCar atskaites pasūtījumā jāieliek PILNĪGI VISS. Lapa daļu sadaļu rāda sakļautu
 * («Show more»), un dažas sadaļas vispār nerenderē (VW Amarok WV1ZZZ2HZHH001470: «Sales history 4 record(s)»,
 * bet izsoļu bloka lapā nav). Lapas datu stāvoklī ir visi ieraksti, tāpēc savācējs to sūta līdzi (`data`).
 *
 * Tīrās funkcijas, bez tīkla. Imports: `lib/checkcar-full-report.ts`.
 */

import { normalizeAutoRecordsOdometer } from "@/lib/auto-records-paste-parse";
import type { CcVinParsedReport } from "@/lib/cc-vin-report-parse";
import type { CcVinDamageRow, CcVinSaleRow, CcVinServiceRow, CcVinSpecRow, CcVinTitleRow } from "@/lib/cc-vin-report";

/** Datu JSON griesti (BMW 530d ar 29 servisiem ~26 KB; ar foto URL līdz ~60 KB). */
export const CHECKCAR_REPORT_DATA_MAX = 600_000;

export type CheckcarReportDataParsed = {
  reportDate: string;
  vehicleLine: string;
  mileage: { date: string; odometer: string; country: string }[];
  sales: CcVinSaleRow[];
  services: CcVinServiceRow[];
  specs: CcVinSpecRow[];
  damages: CcVinDamageRow[];
  titles: CcVinTitleRow[];
  /** Sadaļas ar ierakstiem, kuru struktūra nav zināma (vērtība, drošības reitingi, sūdzības) - «Citi dati». */
  other: CcVinSpecRow[];
  /** Sadaļa -> deklarētais skaits («29 record(s)») un nolasītais. */
  counts: { section: string; declared: number | null; parsed: number }[];
};

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function s(v: unknown): string {
  if (typeof v === "string") return v.replace(/\s+/g, " ").trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "YES" : "NO";
  return "";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** „2025-06-22T00:00:00.000000Z” / „2025-06-22” / „22/06/2025” / unix sekundes -> „22.06.2025”. */
export function checkcarDateLv(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 300_000_000) {
    const d = new Date(raw * 1000);
    return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  }
  const t = s(raw);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t);
  if (m) return `${pad2(Number(m[1]))}.${pad2(Number(m[2]))}.${m[3]}`;
  return "";
}

function declaredCount(text: unknown): number | null {
  const m = /^(\d+)\s+(record|service|damage|registration|sale)\(s\)$/i.exec(s(text));
  return m ? Number(m[1]) : null;
}

function kmSpaced(digits: string): string {
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
}

/** „268 200 km” / 268200 / „166,000 mi” -> „268200” (km). */
function odometerDigits(raw: unknown, metric = ""): string {
  const t = s(raw);
  if (!t) return "";
  const digits = t.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (/\bmi(les)?\b/i.test(t) || /^mi/i.test(metric)) return String(Math.round(Number(digits) * 1.609344));
  return normalizeAutoRecordsOdometer(digits) || digits;
}

/* ------------------------------------------------------------- vārdnīcas LV */

const STATUS_LV: Record<string, string> = {
  sold: "Pārdots",
  "not sold": "Nav pārdots",
  pending: "Gaida izsoli",
  "on approval": "Gaida apstiprinājumu",
  cancelled: "Atcelts",
  canceled: "Atcelts",
};

/** Izsoles vietas nosaukums kā teksta parserī (lielie burti no avota paliek - tie sakrīt pēc atslēgas). */
const VENUE_COUNTRY: Record<string, string> = { autobid: "Vācija" };

/** Specifikācijas lauks (avota virsraksts, mazie burti) -> LV nosaukums. Secība = avota secība. */
const SPEC_LABEL_LV: Record<string, string> = {
  year: "Izlaiduma gads",
  "destination market": "Tirgus",
  make: "Marka",
  model: "Modelis",
  body: "Virsbūve",
  doors: "Durvis",
  color: "Krāsa",
  "engine capacity": "Dzinēja tilpums",
  "fuel type": "Degviela",
  "standard seating": "Sēdvietas",
  "drive type": "Piedziņa",
  transmission: "Ātrumkārba",
  keys: "Atslēgas",
  series: "Sērija",
  "product type": "Transportlīdzekļa veids",
  "vehicle specification": "Modifikācija",
  "engine code": "Dzinēja kods",
  "engine type": "Dzinēja tips",
  "engine manufacturer": "Dzinēja ražotājs",
  "number of cylinders": "Cilindri",
  "engine power": "Dzinēja jauda",
  "number of gears": "Pārnesumu skaits",
  "steering type": "Stūres pastiprinātājs",
  "front suspension": "Priekšējā piekare",
  "rear suspension": "Aizmugurējā piekare",
  suspension: "Piekare",
  "front brakes": "Priekšējās bremzes",
  "rear brakes": "Aizmugurējās bremzes",
  abs: "ABS",
  "gross weight": "Pilna masa",
  "curb weight": "Pašmasa",
  length: "Garums",
  width: "Platums",
  height: "Augstums",
  "ride height": "Klīrenss",
  "track front": "Priekšējo riteņu rumbu atstatums",
  "track rear": "Aizmugurējo riteņu rumbu atstatums",
  wheelbase: "Garenbāze",
  "wheel size": "Riepu izmērs",
  "number of wheels": "Riteņu skaits",
  "number of axles": "Asu skaits",
  "max speed": "Maksimālais ātrums",
  "emission standard": "Izmešu standarts",
  "co2 emission": "CO2 izmeši",
  "max roof load": "Maks. jumta slodze",
  "trailer load without brakes": "Piekabe bez bremzēm",
  "trunk capacity": "Bagāžnieka tilpums",
  manufacturer: "Ražotājs",
  "manufacturer address": "Ražotāja adrese",
  "plant country": "Ražotnes valsts",
};

const SPEC_VALUE_LV: [RegExp, string][] = [
  [/^wagon$/i, "Universālis"],
  [/^sedan$/i, "Sedans"],
  [/^hatchback$/i, "Hečbeks"],
  [/^coupe$/i, "Kupeja"],
  [/^(convertible|cabrio(let)?)$/i, "Kabriolets"],
  [/^pickup$/i, "Pikaps"],
  [/^(suv|sport utility.*)$/i, "Apvidus (SUV)"],
  [/^(minivan|mpv)$/i, "Minivens"],
  [/^van$/i, "Furgons"],
  [/^diesel$/i, "Dīzelis"],
  [/^(petrol|gasoline)$/i, "Benzīns"],
  [/^electric$/i, "Elektrība"],
  [/^hybrid$/i, "Hibrīds"],
  [/^automatic$/i, "Automātiskā"],
  [/^manual$/i, "Manuālā"],
  [/^4x4\b.*four-wheel drive$/i, "Pilnpiedziņa (4x4)"],
  [/^(awd|all-wheel drive)$/i, "Pilnpiedziņa (AWD)"],
  [/^(fwd|front-wheel drive)$/i, "Priekšpiedziņa"],
  [/^(rwd|rear-wheel drive)$/i, "Aizmugurpiedziņa"],
  [/^electric steering$/i, "Elektriskais"],
  [/^hydraulic steering$/i, "Hidrauliskais"],
  [/^disc$/i, "Disku"],
  [/^drum$/i, "Trumuļa"],
  [/^yes$/i, "Jā"],
  [/^no$/i, "Nē"],
  [/^europe$/i, "Eiropa"],
  [/^car$/i, "Vieglais auto"],
  [/^truck$/i, "Kravas / komerciālais"],
  [/^germany$/i, "Vācija"],
  [/^(km\/h)$/i, "km/h"],
];

function specValueLv(raw: string): string {
  const t = raw.trim();
  for (const [re, lv] of SPEC_VALUE_LV) if (re.test(t)) return lv;
  return t.replace(/\bKM\/H\b/g, "km/h").replace(/,\s*Germany$/i, ", Vācija");
}

function specLabelLv(rawTitle: string): string {
  const key = rawTitle.replace(/\s+/g, " ").trim().toLowerCase();
  return SPEC_LABEL_LV[key] ?? rawTitle.trim();
}

/** Tukša / „-” vērtība netiek glabāta. */
function hasValue(v: string): boolean {
  const t = v.trim();
  return Boolean(t) && !/^[-–—]+$/.test(t) && !/^(n\/?a|null|undefined|unknown)$/i.test(t);
}

/* ------------------------------------------------------------ dati (JSON) */

/** `__NUXT__.data[].report.data` vai pats `report.data` objekts (arī JSON teksts). */
export function checkcarReportDataRoot(raw: unknown): Obj | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    if (!v.trim() || v.length > CHECKCAR_REPORT_DATA_MAX) return null;
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) v = v.map((x) => obj(obj(x).report).data).find((x) => x && typeof x === "object");
  const o = obj(v);
  if (o.report && obj(o.report).data) return obj(obj(o.report).data);
  if (o.general_info || o.specifications || o.mileages || o.auction_sale_history) return o;
  return null;
}

/** Izsoles ieraksti: `items` = {VIETA: ieraksts ar vai bez `childs`} (vai saraksts). */
function auctionEntries(items: unknown): Obj[] {
  const out: Obj[] = [];
  const list = Array.isArray(items) ? items : Object.values(obj(items));
  for (const it of list) {
    const o = obj(it);
    const childs = arr(o.childs).map(obj).filter((c) => Object.keys(c).length > 0);
    if (childs.length > 0) out.push(...childs.map((c) => ({ place: o.place, ...c })));
    else if (Object.keys(o).length > 0) out.push(o);
  }
  return out;
}

/** Nezināmas struktūras ieraksts -> „Atslēga: vērtība; …” (bez ikonām un attēliem). */
function flattenRecord(o: Obj): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (/icon|image|photo|sort_|_ts$|^val$|^metric$/i.test(k)) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = obj(v);
      const title = s(inner.title);
      const value = s(inner.value);
      if (title && hasValue(value)) parts.push(`${title}: ${value}`);
      continue;
    }
    if (Array.isArray(v)) {
      const joined = v.map(s).filter(hasValue).join(", ");
      if (joined) parts.push(`${k}: ${joined}`);
      continue;
    }
    const t = s(v);
    if (hasValue(t)) parts.push(`${k}: ${t}`);
  }
  return parts.join("; ");
}

function serviceDescription(materials: string[], labor: string[]): string {
  const lines: string[] = [];
  const clean = (xs: string[]) => xs.map((x) => x.replace(/\s+/g, " ").trim()).filter(hasValue);
  const m = clean(materials);
  const l = clean(labor);
  if (l.length) lines.push(...l);
  if (m.length) lines.push(`Materiāli: ${m.join("; ")}`);
  return lines.join("\n").slice(0, 4000);
}

export function parseCheckcarReportData(raw: unknown): CheckcarReportDataParsed | null {
  const root = checkcarReportDataRoot(raw);
  if (!root) return null;
  const out: CheckcarReportDataParsed = {
    reportDate: "",
    vehicleLine: s(root.vehicle_title),
    mileage: [],
    sales: [],
    services: [],
    specs: [],
    damages: [],
    titles: [],
    other: [],
    counts: [],
  };

  /* Nobraukums. */
  const mil = obj(root.mileages);
  for (const r of arr(mil.mileages).map(obj)) {
    const date = checkcarDateLv(r.date ?? r.sort_date);
    const odometer = odometerDigits(r.meter ?? r.val, s(r.metric));
    if (date && odometer) out.mileage.push({ date, odometer, country: "" });
  }
  out.counts.push({ section: "Odometra ieraksti", declared: declaredCount(mil.text), parsed: out.mileage.length });

  /* Izsoles / pārdošanas. */
  const auc = obj(root.auction_sale_history);
  for (const r of auctionEntries(auc.items)) {
    const venue = s(r.place);
    const odometer = odometerDigits(r.mileage ?? r.val, s(r.metric));
    const statusRaw = s(r.status);
    out.sales.push({
      date: checkcarDateLv(r.date ?? r.sort_date),
      venue,
      odometer: kmSpaced(odometer),
      price: s(r.price),
      status: STATUS_LV[statusRaw.toLowerCase()] ?? statusRaw,
    });
  }
  out.counts.push({ section: "Izsoļu pārdošanas vēsture", declared: declaredCount(auc.text), parsed: out.sales.length });

  /* Izsoles nobraukums -> nobraukuma tabula (kā teksta parserī: valsts pēc izsoles vietas). */
  for (const sale of out.sales) {
    const digits = sale.odometer.replace(/\s/g, "");
    if (!sale.date || !digits) continue;
    const country = VENUE_COUNTRY[sale.venue.toLowerCase()] ?? "";
    const same = out.mileage.find((m) => m.date === sale.date && m.odometer === digits);
    if (same) {
      if (!same.country) same.country = country;
    } else out.mileage.push({ date: sale.date, odometer: digits, country });
  }

  /* Servisa ieraksti (nobraukums - no tā paša datuma odometra ieraksta, ja tāds ir). */
  const svc = obj(root.services_records);
  for (const r of arr(svc.services).map(obj)) {
    const date = checkcarDateLv(r.date ?? r.date_ts);
    const description = serviceDescription(arr(r.materialItems).map(s), arr(r.laborItems).map(s));
    const extra = flattenRecord(
      Object.fromEntries(Object.entries(r).filter(([k]) => !/^(date|date_ts|materialItems|laborItems)$/.test(k))),
    );
    const odometer = out.mileage.find((m) => m.date === date)?.odometer ?? "";
    if (date || description || extra) {
      out.services.push({
        date,
        odometer: kmSpaced(odometer),
        description: [description, extra].filter(Boolean).join("\n").slice(0, 4000),
      });
    }
  }
  out.counts.push({ section: "Servisa ieraksti", declared: declaredCount(svc.text), parsed: out.services.length });

  /* Specifikācija. */
  for (const v of Object.values(obj(root.specifications))) {
    const o = obj(v);
    const title = s(o.title);
    const value = s(o.value);
    if (!title || !hasValue(value)) continue;
    out.specs.push({ label: specLabelLv(title), value: specValueLv(value) });
  }

  /* Bojājumi / negadījumi (struktūra nav redzēta - vispārīgi). */
  for (const [key, listKey, label] of [
    ["vehicle_damages", "items", "Bojājums"],
    ["accident_records", "accidents", "Negadījums"],
  ] as const) {
    const sec = obj(root[key]);
    for (const r of arr(sec[listKey]).map(obj)) {
      const flat = flattenRecord(r);
      if (!flat) continue;
      out.damages.push({
        date: checkcarDateLv(r.date ?? r.sort_date),
        region: s(r.country ?? r.location ?? r.place),
        amount: "",
        description: `${label}: ${flat}`.slice(0, 400),
      });
    }
  }

  /* Reģistrācijas. */
  const reg = obj(root.registration_record);
  for (const r of arr(reg.registrations).map(obj)) {
    const flat = flattenRecord(r);
    if (!flat) continue;
    out.titles.push({
      date: checkcarDateLv(r.date ?? r.sort_date),
      region: s(r.country ?? r.region ?? r.state),
      odometer: odometerDigits(r.mileage ?? r.odometer ?? r.meter),
      note: flat.slice(0, 200),
    });
  }

  /* Pārējās sadaļas ar ierakstiem. */
  for (const [key, label] of [
    ["vehicle_value_information", "Vērtība"],
    ["safety_ratings_records", "Drošības reitings"],
    ["complaints", "Sūdzības"],
  ] as const) {
    for (const r of arr(obj(root[key]).items).map(obj)) {
      const flat = flattenRecord(r);
      if (flat) out.other.push({ label, value: flat.slice(0, 600) });
    }
  }
  return out;
}

/* ---------------------------------------------------------- teksts (lapa) */

function textLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** „Report Date: 28/11/2026” -> „28.11.2026”. */
export function checkcarReportDateFromText(raw: string): string {
  const m = /report\s+date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(raw || "");
  return m ? checkcarDateLv(m[1]) : "";
}

/**
 * Izvērstā lapas teksta servisa ieraksti: „01/02/2023 / Services #29 / MATERIALS INSTALLED: / … /
 * WORK PERFORMED: / …”. Sakļautajā lapā redzami tikai pirmie; savācējs pirms tam izvērš sadaļu.
 */
export function parseCheckcarServicesText(raw: string): CcVinServiceRow[] {
  const lines = textLines(raw);
  const out: CcVinServiceRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^services\s+#\d+$/i.test(lines[i]!)) continue;
    const date = checkcarDateLv(lines[i - 1] ?? "");
    const materials: string[] = [];
    const labor: string[] = [];
    let mode: "m" | "l" | "" = "";
    let j = i + 1;
    for (; j < lines.length; j++) {
      const line = lines[j]!;
      if (/^services\s+#\d+$/i.test(line) || /^source:/i.test(line) || /^show\s+(more|less)$/i.test(line)) break;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(line) && /^services\s+#\d+$/i.test(lines[j + 1] ?? "")) break;
      if (/^materials\s+installed:?$/i.test(line)) {
        mode = "m";
        continue;
      }
      if (/^work\s+performed:?$/i.test(line)) {
        mode = "l";
        continue;
      }
      if (mode === "m") materials.push(line);
      else if (mode === "l") labor.push(line);
    }
    out.push({ date, odometer: "", description: serviceDescription(materials, labor) });
  }
  return out;
}

/** Specifikācija no lapas teksta: pāri „Virsraksts / vērtība” starp „Vehicle Specifications” un „Source:”. */
export function parseCheckcarSpecsText(raw: string): CcVinSpecRow[] {
  const lines = textLines(raw);
  const start = lines.findIndex((l, i) => /^vehicle\s+specifications$/i.test(l) && /^year$/i.test(lines[i + 1] ?? ""));
  if (start < 0) return [];
  const out: CcVinSpecRow[] = [];
  for (let i = start + 1; i + 1 < lines.length; i += 2) {
    const title = lines[i]!;
    if (/^source:/i.test(title)) break;
    const key = title.toLowerCase();
    if (!(key in SPEC_LABEL_LV)) break;
    const value = lines[i + 1]!;
    if (hasValue(value)) out.push({ label: specLabelLv(title), value: specValueLv(value) });
  }
  return out;
}

/* ------------------------------------------------------ apvienošana ar PDF */

function squish(v: string): string {
  return v.replace(/\s+/g, "").toLowerCase();
}

/**
 * Teksta parsera rezultāts + lapas dati + teksta servisi/specifikācija -> viens `CcVinParsedReport`.
 * Dati ir pilnīgāki (arī nerenderētās sadaļas), teksts paliek rezervei (userscript bez datiem).
 */
export function mergeCheckcarParsed(
  main: CcVinParsedReport,
  data: CheckcarReportDataParsed | null,
  text: string,
): CcVinParsedReport {
  const out: CcVinParsedReport = { ...main, notes: [...main.notes] };
  if (!out.reportDate) out.reportDate = checkcarReportDateFromText(text);

  const mileage = new Map<string, { date: string; odometer: string; country: string }>();
  for (const r of [...main.mileage, ...(data?.mileage ?? [])]) {
    const k = `${r.date}|${r.odometer}`;
    const prev = mileage.get(k);
    if (!prev || (!prev.country && r.country)) mileage.set(k, r);
  }
  out.mileage = [...mileage.values()];

  const sales = new Map<string, CcVinSaleRow>();
  for (const r of [...main.sales, ...(data?.sales ?? [])]) {
    const k = `${r.date}|${squish(r.odometer)}|${squish(r.venue)}|${r.status}`;
    if (!sales.has(k)) sales.set(k, r);
  }
  out.sales = [...sales.values()];

  const damageKeys = new Set(main.damages.map((d) => `${d.date}|${squish(d.description)}`));
  out.damages = [...main.damages, ...(data?.damages ?? []).filter((d) => !damageKeys.has(`${d.date}|${squish(d.description)}`))];
  out.titles = [...main.titles, ...(data?.titles ?? [])];

  const textServices = parseCheckcarServicesText(text);
  out.services = (data?.services.length ?? 0) >= textServices.length && data ? data.services : textServices;
  // Teksta servisiem nobraukums no tā paša datuma odometra ieraksta.
  out.services = out.services.map((r) =>
    r.odometer || !r.date
      ? r
      : { ...r, odometer: kmSpaced(out.mileage.find((m) => m.date === r.date)?.odometer ?? "") },
  );

  const specs = data?.specs.length ? data.specs : parseCheckcarSpecsText(text);
  out.specs = [...specs, ...(data?.other ?? [])];
  if (!out.vehicleLine && data?.vehicleLine) out.vehicleLine = data.vehicleLine;

  for (const c of data?.counts ?? []) {
    if (c.declared != null && c.declared !== c.parsed) {
      out.notes.push(`${c.section}: avotā ${c.declared}, nolasīti ${c.parsed} - pārbaudi pret avotu.`);
    }
  }
  return out;
}

/** Datu kopsavilkums tekstā `rawUnprocessedData` sadaļai (sadaļas, ko lapa nerenderē, arī šeit). */
export function checkcarReportDataToText(data: CheckcarReportDataParsed | null): string {
  if (!data) return "";
  const lines: string[] = ["--- Lapas dati (visi ieraksti) ---"];
  if (data.sales.length) {
    lines.push("Izsoles / pārdošanas:");
    for (const r of data.sales) lines.push(`  ${[r.date, r.venue, r.odometer && `${r.odometer} km`, r.price, r.status].filter(Boolean).join(" | ")}`);
  }
  if (data.mileage.length) {
    lines.push(`Odometra ieraksti (${data.mileage.length}):`);
    for (const r of data.mileage) lines.push(`  ${r.date} | ${kmSpaced(r.odometer)} km${r.country ? ` | ${r.country}` : ""}`);
  }
  if (data.services.length) {
    lines.push(`Servisa ieraksti (${data.services.length}):`);
    for (const r of data.services) {
      lines.push(`  ${r.date}${r.odometer ? ` | ${r.odometer} km` : ""}`);
      for (const l of r.description.split("\n")) if (l.trim()) lines.push(`    ${l}`);
    }
  }
  for (const r of data.damages) lines.push(`Bojājums: ${[r.date, r.region, r.description].filter(Boolean).join(" | ")}`);
  for (const r of data.titles) lines.push(`Reģistrācija: ${[r.date, r.region, r.odometer, r.note].filter(Boolean).join(" | ")}`);
  for (const r of data.other) lines.push(`${r.label}: ${r.value}`);
  return lines.length > 1 ? lines.join("\n") : "";
}
