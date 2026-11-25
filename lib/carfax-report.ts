/**
 * CARFAX avota bloks (admin: „CARFAX”).
 *
 * Bloks izmanto to pašu formu kā AutoDNA / CarVertical (`VendorAvotuBlockState`: nobraukums,
 * negadījumi, laikposma ieraksti, bojājumu detaļas, komentāri, foto) + strukturēto
 * `report` (visi CARFAX lauki). `report` aizpilda PDF parsētājs (`parseCarfaxReportText`)
 * vai nākotnē automātika (carfax.eu) - abos gadījumos rindas veido `carfaxReportToVendorRows`.
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import { autoRecordsRowHasData, formatAutoRecordsDateForOutput, sortAutoRecordsDescending } from "@/lib/auto-records-paste-parse";
import type { CarVerticalDamageDetailRow, CarVerticalTimelineRow } from "@/lib/carvertical-pdf-parse";
import { carVerticalTimelineRowHasData } from "@/lib/carvertical-pdf-parse";
import {
  carfaxReportCounts,
  emptyCarfaxReport,
  parseCarfaxReportText,
  type CarfaxDamage,
  type CarfaxHistoryEvent,
  type CarfaxReport,
} from "@/lib/carfax-report-parse";
import { ADMIN_INCIDENT_DATA_UNAVAILABLE } from "@/lib/admin-incident-field-presets";
import { mergeAutoRecordsServiceHistory } from "@/lib/auto-records-pdf-parse";

export type { CarfaxReport } from "@/lib/carfax-report-parse";

export const CARFAX_ADMIN_LABEL = "CARFAX";
export const CARFAX_HOME_URL = "https://www.carfax.eu";

/** Minimāla vendor bloka forma (lai šis modulis neimportē `admin-source-blocks` - bez cikla). */
type VendorLike = {
  serviceHistory: AutoRecordsServiceRow[];
  incidents: Array<{ incidentNo: string; csngDate: string; lossAmount: string }>;
  vehicleHistoryTimeline?: CarVerticalTimelineRow[];
  damageDetails?: CarVerticalDamageDetailRow[];
};

/* ------------------------------------------------------------------ */
/* Normalizācija (melnraksta JSON → droša struktūra)                  */
/* ------------------------------------------------------------------ */

function s(v: unknown, max = 400): string {
  return typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "";
}

function arr<T>(v: unknown, map: (x: Record<string, unknown>) => T, max = 300): T[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, max)
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .map(map);
}

function strList(v: unknown, max = 300, len = 300): string[] {
  return Array.isArray(v) ? v.slice(0, max).map((x) => s(x, len)).filter(Boolean) : [];
}

const STATUS = new Set(["ok", "attention", "unavailable"]);

/** Bojāts / daļējs `report` neizraisa kļūdas; nederīgs → null. */
export function normalizeCarfaxReport(raw: unknown): CarfaxReport | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const e = emptyCarfaxReport();
  const mc = (o.mileageCheck && typeof o.mileageCheck === "object" ? o.mileageCheck : {}) as Record<string, unknown>;
  const price = (o.originalPrice && typeof o.originalPrice === "object" ? o.originalPrice : {}) as Record<string, unknown>;
  const maint = (o.maintenance && typeof o.maintenance === "object" ? o.maintenance : {}) as Record<string, unknown>;
  const pdf = o.pdf && typeof o.pdf === "object" ? (o.pdf as Record<string, unknown>) : null;
  const report: CarfaxReport = {
    ...e,
    origin: o.origin === "auto" ? "auto" : "pdf",
    parsedAt: s(o.parsedAt, 40),
    reportCreatedAt: s(o.reportCreatedAt, 40),
    vin: s(o.vin, 40),
    vehicleTitle: s(o.vehicleTitle, 160),
    modelYear: s(o.modelYear, 8),
    vehicle: arr(o.vehicle, (x) => ({ label: s(x.label, 80), value: s(x.value, 200) }), 40),
    quickChecks: arr(o.quickChecks, (x) => ({
      title: s(x.title, 80),
      titleLv: s(x.titleLv, 80),
      status: (STATUS.has(s(x.status)) ? s(x.status) : "attention") as CarfaxReport["quickChecks"][number]["status"],
      text: s(x.text, 600),
      textLv: s(x.textLv, 600),
    }), 40),
    noDamageReported: o.noDamageReported === true,
    damages: arr(o.damages, (x) => ({
      date: s(x.date, 20),
      country: s(x.country, 80),
      cause: s(x.cause, 120),
      areas: strList(x.areas, 20, 60),
      components: strList(x.components, 30, 80),
      repairCost: s(x.repairCost, 60),
      severity: s(x.severity, 60),
    }), 60),
    mileageCheck: {
      statusLv: s(mc.statusLv, 200),
      status: (STATUS.has(s(mc.status)) ? s(mc.status) : "") as CarfaxReport["mileageCheck"]["status"],
      lastReadingKm: s(mc.lastReadingKm, 12),
      lastReadingDate: s(mc.lastReadingDate, 20),
      projectionKm: s(mc.projectionKm, 12),
      projectionSimilarKm: s(mc.projectionSimilarKm, 12),
    },
    owners: arr(o.owners, (x) => ({
      index: typeof x.index === "number" ? x.index : Number.parseInt(s(x.index), 10) || 0,
      country: s(x.country, 80),
      purchaseYear: s(x.purchaseYear, 8),
      lengthOfUse: s(x.lengthOfUse, 60),
      ownerType: s(x.ownerType, 60),
    }), 30),
    ownersNote: s(o.ownersNote, 200),
    technical: arr(o.technical, (x) => ({ label: s(x.label, 80), value: s(x.value, 200) }), 60),
    equipment: strList(o.equipment, 200, 300),
    originalPrice: { base: s(price.base, 40), options: s(price.options, 40), total: s(price.total, 40) },
    maintenance: { vehicleAge: s(maint.vehicleAge, 40), due: strList(maint.due, 20, 200) },
    history: arr(o.history, (x) => ({
      date: s(x.date, 20),
      odometerKm: s(x.odometerKm, 12),
      ...(s(x.odometerMiles, 12) ? { odometerMiles: s(x.odometerMiles, 12) } : {}),
      event: s(x.event, 200),
      eventLv: s(x.eventLv, 200),
      country: s(x.country, 80),
      details: strList(x.details, 10, 120),
      kind: (s(x.kind, 30) || "other") as CarfaxHistoryEvent["kind"],
    }), 400),
    photos: arr(o.photos, (x) => ({ url: s(x.url, 1000), date: s(x.date, 20), caption: s(x.caption, 200) }), 200),
    ...(pdf && s(pdf.name)
      ? {
          pdf: {
            name: s(pdf.name, 200),
            size: typeof pdf.size === "number" && Number.isFinite(pdf.size) ? pdf.size : 0,
            savedAt: s(pdf.savedAt, 40),
            ...(s(pdf.blobPath) ? { blobPath: s(pdf.blobPath, 300) } : {}),
            ...(s(pdf.dropboxPath) ? { dropboxPath: s(pdf.dropboxPath, 600) } : {}),
            ...(/^[a-f0-9]{32}$/.test(s(pdf.md5, 40)) ? { md5: s(pdf.md5, 40) } : {}),
            ...(pdf.via === "email" || pdf.via === "upload" ? { via: pdf.via } : {}),
          },
        }
      : {}),
  };
  return report;
}

export function carfaxReportHasContent(r: CarfaxReport | null | undefined): boolean {
  if (!r) return false;
  return Boolean(
    r.vin || r.history.length > 0 || r.quickChecks.length > 0 || r.damages.length > 0 || r.noDamageReported,
  );
}

/* ------------------------------------------------------------------ */
/* Report → bloka rindas                                                */
/* ------------------------------------------------------------------ */

/** Notikumi, kas PDF laikposma joslā ir pēc noklusējuma (operators var izslēgt). */
const TIMELINE_PDF_KINDS = new Set<CarfaxHistoryEvent["kind"]>([
  "manufactured",
  "registered",
  "first_traffic",
  "owner",
  "leasing",
  "damage",
  "total_loss",
  "insurance_claim",
  "salvage",
  "airbag",
  "import",
  "other",
]);

function ownerTypeOf(e: CarfaxHistoryEvent): string {
  const typeDetail = e.details.find((d) => d.startsWith("īpašnieka tips: "));
  return typeDetail ? typeDetail.slice("īpašnieka tips: ".length) : "";
}

/**
 * Laikposma apraksts. Nila lēmums 25.11: dīleris ir juridiski reģistrēts īpašnieks - tā ir īpašnieka maiņa
 * („Īpašnieka maiņa · dīleris”), skaitā to skaita, bet vienmēr ar sadalījumu (sk. `carfaxOwnerStats`).
 */
export function carfaxTimelineDescription(e: CarfaxHistoryEvent): string {
  if (e.kind === "owner") {
    const type = ownerTypeOf(e);
    return type ? `Īpašnieka maiņa · ${type}` : "Īpašnieka maiņa";
  }
  const extra = e.details.filter((d) => !d.startsWith("īpašnieka tips: "));
  return extra.length > 0 ? `${e.eventLv} (${extra.join(", ")})` : e.eventLv;
}

function damageToIncident(d: CarfaxDamage): VendorLike["incidents"][number] {
  return {
    csngDate: d.date,
    lossAmount: d.repairCost || ADMIN_INCIDENT_DATA_UNAVAILABLE,
    incidentNo: d.country,
  };
}

/** CARFAX „Affected components” → tās pašas detaļu grupas, ko lieto CarVertical / AutoDNA. */
const COMPONENT_LV: Record<string, string> = {
  "external lighting": "Ārējais apgaismojums",
  lighting: "Ārējais apgaismojums",
  "body exterior": "Virsbūves ārējās daļas",
  "exterior body": "Virsbūves ārējās daļas",
  body: "Virsbūves ārējās daļas",
  "body structure": "Virsbūves konstrukcija",
  glass: "Stikli",
  windows: "Stikli",
  wheels: "Riteņi un riepas",
  tires: "Riteņi un riepas",
  suspension: "Balstiekārta",
  airbags: "Drošības spilveni",
  "safety systems": "Drošības sistēmas",
  engine: "Dzinējs",
  powertrain: "Spēka agregāts",
  cooling: "Dzesēšanas sistēma",
  "cooling system": "Dzesēšanas sistēma",
  interior: "Salons",
  electrical: "Elektrosistēma",
  electronics: "Elektrosistēma",
  mechanical: "Mehāniskās daļas",
};

export function carfaxComponentLv(raw: string): string {
  return COMPONENT_LV[raw.trim().toLowerCase()] ?? raw.trim();
}

/**
 * Bojājumu detaļa tieši CarVertical formā: zonas (siluetam) + detaļu grupas + summa.
 * Cēlonis / smagums paliek faktu kartē un AI kontekstā (CarVertical detaļās to nav).
 */
function damageToDetail(d: CarfaxDamage): CarVerticalDamageDetailRow {
  const groups = d.components.map(carfaxComponentLv);
  return {
    date: d.date,
    country: d.country,
    lossAmount: d.repairCost,
    damagedSides: d.areas.join(", "),
    damageGroups: groups.join(", "),
  };
}

const HISTORY_DAMAGE_KINDS = new Set<CarfaxHistoryEvent["kind"]>(["damage", "total_loss"]);

export function carfaxReportToVendorRows(r: CarfaxReport): Required<Pick<VendorLike, "serviceHistory" | "incidents" | "vehicleHistoryTimeline" | "damageDetails">> {
  const serviceHistory: AutoRecordsServiceRow[] = [];
  const seenMileage = new Set<string>();
  for (const e of r.history) {
    if (!e.odometerKm) continue;
    const date = formatAutoRecordsDateForOutput(e.date);
    const key = `${date}|${e.odometerKm}`;
    if (seenMileage.has(key)) continue;
    seenMileage.add(key);
    serviceHistory.push({ date, odometer: e.odometerKm, country: e.country, unit: "km" });
  }
  // „Mileage Check” pēdējais rādījums ar precīzu dienu, ja vēsturē tas ir tikai mēneša precizitātē.
  const mc = r.mileageCheck;
  if (mc.lastReadingKm && mc.lastReadingDate && !serviceHistory.some((x) => x.odometer === mc.lastReadingKm)) {
    serviceHistory.push({ date: formatAutoRecordsDateForOutput(mc.lastReadingDate), odometer: mc.lastReadingKm, country: "", unit: "km" });
  }

  const incidents = r.damages.map(damageToIncident);
  if (incidents.length === 0) {
    // Bojājumu pārskats tukšs, bet vēsturē ir bojājuma notikums - neko nepazaudē.
    const seen = new Set<string>();
    for (const e of r.history) {
      if (!HISTORY_DAMAGE_KINDS.has(e.kind)) continue;
      const key = `${e.date}|${e.country}`;
      if (seen.has(key)) continue;
      seen.add(key);
      incidents.push({ csngDate: e.date, lossAmount: ADMIN_INCIDENT_DATA_UNAVAILABLE, incidentNo: e.country });
    }
  }

  const vehicleHistoryTimeline: CarVerticalTimelineRow[] = r.history.map((e) => ({
    date: e.date,
    country: e.country,
    description: carfaxTimelineDescription(e),
    ...(e.odometerKm ? { odometer: e.odometerKm } : {}),
    includeInPdf: TIMELINE_PDF_KINDS.has(e.kind),
  }));

  return {
    serviceHistory: sortAutoRecordsDescending(serviceHistory),
    incidents,
    vehicleHistoryTimeline,
    damageDetails: r.damages.filter((d) => d.areas.length || d.components.length).map(damageToDetail),
  };
}

/* ------------------------------------------------------------------ */
/* Ielase blokā                                                         */
/* ------------------------------------------------------------------ */

function mergeIncidents(
  existing: VendorLike["incidents"],
  imported: VendorLike["incidents"],
): VendorLike["incidents"] {
  const has = (r: VendorLike["incidents"][number]) => Boolean(r.csngDate.trim() || r.lossAmount.trim() || r.incidentNo.trim());
  const seen = new Set<string>();
  const out: VendorLike["incidents"] = [];
  for (const r of [...existing, ...imported]) {
    if (!has(r)) continue;
    const key = `${r.csngDate.trim()}|${r.incidentNo.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function mergeTimeline(existing: CarVerticalTimelineRow[], imported: CarVerticalTimelineRow[]): CarVerticalTimelineRow[] {
  const keyOf = (r: CarVerticalTimelineRow) => `${r.date.trim()}|${r.description.trim().toLowerCase()}`;
  const byKey = new Map<string, CarVerticalTimelineRow>();
  // Operatora rindas paliek (arī viņa PDF ķeksis); jaunās pievienojas.
  for (const r of existing.filter(carVerticalTimelineRowHasData)) byKey.set(keyOf(r), r);
  for (const r of imported) if (!byKey.has(keyOf(r))) byKey.set(keyOf(r), r);
  return [...byKey.values()];
}

export type CarfaxApplyResult<B extends VendorLike & { report?: CarfaxReport }> = {
  block: B;
  report: CarfaxReport;
  summary: string;
};

/**
 * PDF teksts → bloks. `null`, ja teksts nav CARFAX atskaite.
 * Rindas pievieno esošajām (dublikātus izlaiž); `report` vienmēr aizstāj ar jaunāko.
 */
export function applyCarfaxReportToBlock<B extends VendorLike & { report?: CarfaxReport }>(
  prev: B,
  text: string,
  opts?: { now?: Date },
): CarfaxApplyResult<B> | null {
  const report = parseCarfaxReportText(text, opts);
  if (!report || !carfaxReportHasContent(report)) return null;
  return applyCarfaxReportObject(prev, report);
}

/** Tas pats bez teksta - automātikai, kas jau dod `CarfaxReport`. */
export function applyCarfaxReportObject<B extends VendorLike & { report?: CarfaxReport }>(
  prev: B,
  report: CarfaxReport,
): CarfaxApplyResult<B> {
  const rows = carfaxReportToVendorRows(report);
  const existingMileage = (prev.serviceHistory ?? []).filter(autoRecordsRowHasData);
  const serviceHistory = mergeAutoRecordsServiceHistory(existingMileage, rows.serviceHistory);
  const block = {
    ...prev,
    serviceHistory: serviceHistory.length > 0 ? serviceHistory : prev.serviceHistory,
    incidents: (() => {
      const merged = mergeIncidents(prev.incidents ?? [], rows.incidents);
      return merged.length > 0 ? merged : prev.incidents;
    })(),
    vehicleHistoryTimeline: mergeTimeline(prev.vehicleHistoryTimeline ?? [], rows.vehicleHistoryTimeline),
    ...(rows.damageDetails.length > 0 || (prev.damageDetails ?? []).length > 0
      ? { damageDetails: rows.damageDetails.length > 0 ? rows.damageDetails : prev.damageDetails }
      : {}),
    report: prev.report?.pdf && !report.pdf ? { ...report, pdf: prev.report.pdf } : report,
  } as B;
  const c = carfaxReportCounts(report);
  const summary = [
    `CARFAX${report.vin ? ` ${report.vin}` : ""}${report.reportCreatedAt ? ` (${report.reportCreatedAt})` : ""}:`,
    `${c.mileage} nobraukuma rādījumi`,
    `${c.damages} bojājumi`,
    `${c.history} vēstures ieraksti`,
    c.owners > 0 ? `${c.owners} īpašnieki` : "",
    `${c.quickChecks} ātrās pārbaudes`,
  ]
    .filter(Boolean)
    .join(", ")
    .replace(":,", ":");
  return { block, report: block.report!, summary };
}

/* ------------------------------------------------------------------ */
/* Teksts AI kontekstam un PDF faktu kartei                              */
/* ------------------------------------------------------------------ */

const STATUS_LV: Record<string, string> = { ok: "kārtībā", attention: "jāpievērš uzmanība", unavailable: "nav datu" };

/** PDF faktu kartes rindas („Atslēga: vērtība”) - `ownersSummary` / `statusRecords` / `autoNotes`. */
export type CarfaxOwnerStats = {
  /** Visi īpašnieki (arī dīleri - juridiski reģistrēti īpašnieki). */
  total: number;
  dealers: number;
  /** total - dealers (privātpersonas, uzņēmumi, līzings). */
  nonDealers: number;
  /** Valsts (LV nosaukums), ja visi ieraksti vienā valstī; citādi tukšs. */
  country: string;
  /** No kā skaitīts: CARFAX „Owners” saraksts vai vēstures „New owner reported” ieraksti. */
  basis: "owners_list" | "history" | "";
};

/**
 * Īpašnieku skaits no CARFAX. Ja ir „Owners” saraksts - tas; citādi vēstures īpašnieka ieraksti.
 * Valsts: notikumā minētā; ja nav, bet visā atskaitē minēta tikai viena valsts - tā (citādi nezināma).
 */
export function carfaxOwnerStats(r: CarfaxReport | null | undefined): CarfaxOwnerStats {
  const empty: CarfaxOwnerStats = { total: 0, dealers: 0, nonDealers: 0, country: "", basis: "" };
  if (!r) return empty;
  if (r.owners.length > 0) {
    const dealers = r.owners.filter((o) => o.ownerType === "dīleris").length;
    const countries = [...new Set(r.owners.map((o) => o.country).filter(Boolean))];
    return {
      total: r.owners.length,
      dealers,
      nonDealers: r.owners.length - dealers,
      country: countries.length === 1 ? countries[0]! : "",
      basis: "owners_list",
    };
  }
  const events = r.history.filter((e) => e.kind === "owner");
  if (events.length === 0) return empty;
  const dealers = events.filter((e) => ownerTypeOf(e) === "dīleris").length;
  const reportCountries = [...new Set(r.history.map((e) => e.country).filter(Boolean))];
  const eventCountries = [...new Set(events.map((e) => e.country).filter(Boolean))];
  const allSame =
    reportCountries.length === 1 && eventCountries.every((c) => c === reportCountries[0]) ? reportCountries[0]! : "";
  return { total: events.length, dealers, nonDealers: events.length - dealers, country: allSame, basis: "history" };
}

/** „9 (t. sk. 4 dīleri)” / „3”. */
export function formatCarfaxOwnerCount(st: CarfaxOwnerStats): string {
  if (st.total === 0) return "";
  if (st.dealers === 0) return String(st.total);
  return `${st.total} (t. sk. ${st.dealers} ${st.dealers === 1 ? "dīleris" : "dīleri"})`;
}

export function carfaxPdfFactTexts(r: CarfaxReport | null | undefined): {
  ownersSummary: string;
  statusRecords: string;
  autoNotes: string;
} {
  if (!r) return { ownersSummary: "", statusRecords: "", autoNotes: "" };
  const owners: string[] = [];
  const st = carfaxOwnerStats(r);
  if (st.total > 0) {
    // „Īpašnieku skaits: 9 (Zviedrija; t. sk. 4 dīleri)” - kopskaits pirmais (to lasa īpašnieku sintēze).
    const countries = r.owners.length > 0 ? [...new Set(r.owners.map((o) => o.country).filter(Boolean))] : st.country ? [st.country] : [];
    const dealerPart = st.dealers > 0 ? `t. sk. ${st.dealers} ${st.dealers === 1 ? "dīleris" : "dīleri"}` : "";
    const paren = [countries.join(", "), dealerPart].filter(Boolean).join("; ");
    owners.push(`Īpašnieku skaits: ${st.total}${paren ? ` (${paren})` : ""}`);
  }
  if (r.owners.length > 0) {
    for (const o of r.owners) {
      const parts = [o.purchaseYear ? `no ${o.purchaseYear}` : "", o.lengthOfUse, o.ownerType].filter(Boolean);
      // Atslēga nedrīkst būt „N. īpašnieks:” - klienta PDF to uzskata par personas vārdu un izgriež.
      owners.push(`${o.index}. īpašnieka periods: ${[o.country, ...parts].filter(Boolean).join(", ")}`);
    }
  }

  const status: string[] = [];
  for (const q of r.quickChecks) status.push(`${q.titleLv}: ${q.textLv}`);
  if (r.mileageCheck.statusLv && !r.quickChecks.some((q) => q.title === "Mileage")) {
    status.push(`Nobraukuma pārbaude: ${r.mileageCheck.statusLv}`);
  }

  const notes: string[] = [];
  // Zonas, grupas, summa un valsts ir negadījumu kartītē (kā CarVertical) - šeit tikai tas, kā tur nav.
  for (const d of r.damages) {
    const parts = [d.cause, d.severity ? `smagums: ${d.severity}` : ""].filter(Boolean);
    if (parts.length > 0) notes.push(`Bojājums ${d.date}: ${parts.join("; ")}`);
  }
  const flag = (kind: CarfaxHistoryEvent["kind"], label: string) => {
    const hits = r.history.filter((e) => e.kind === kind);
    if (hits.length === 0) return;
    notes.push(`${label}: ${hits.map((e) => [e.date, e.country].filter(Boolean).join(" ")).join(", ")}`);
  };
  flag("salvage", "Salvage title");
  flag("airbag", "Drošības spilveni nostrādājuši");
  flag("leasing", "Līzings");
  for (const e of r.history.filter((x) => x.kind === "import")) notes.push(`Imports: ${e.date} - ${e.eventLv.replace(/^Importēts /, "")}`);
  return { ownersSummary: owners.join("\n"), statusRecords: status.join("\n"), autoNotes: notes.join("\n") };
}

/** Pilns strukturēts teksts AI kontekstam (avota komentārs, kopsavilkums, pretrunas). */
export function carfaxReportToPlainText(r: CarfaxReport | null | undefined): string {
  if (!r || !carfaxReportHasContent(r)) return "";
  const lines: string[] = [];
  lines.push(`CARFAX atskaite${r.reportCreatedAt ? ` (izveidota ${r.reportCreatedAt})` : ""}${r.vin ? ` VIN ${r.vin}` : ""}`);
  if (r.vehicleTitle) lines.push(`Auto: ${r.vehicleTitle}`);
  for (const v of r.vehicle) lines.push(`${v.label}: ${v.value}`);
  if (r.quickChecks.length > 0) {
    lines.push("ĀTRĀ PĀRBAUDE");
    for (const q of r.quickChecks) lines.push(`${q.titleLv}: ${q.textLv} [${STATUS_LV[q.status] ?? q.status}]`);
  }
  lines.push("BOJĀJUMI");
  if (r.noDamageReported) lines.push("CARFAX bojājumus nav saņēmis (No issues reported)");
  for (const d of r.damages) {
    lines.push(
      [
        d.date,
        d.country,
        d.cause ? `cēlonis ${d.cause}` : "",
        d.areas.length ? `zonas ${d.areas.join(", ")}` : "",
        d.components.length ? `komponentes ${d.components.join(", ")}` : "",
        d.severity ? `smagums ${d.severity}` : "",
        d.repairCost ? `remonta aplēse ${d.repairCost}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }
  const mc = r.mileageCheck;
  if (mc.statusLv || mc.lastReadingKm) {
    lines.push("NOBRAUKUMA PĀRBAUDE");
    if (mc.statusLv) lines.push(mc.statusLv);
    if (mc.lastReadingKm) lines.push(`Pēdējais rādījums: ${mc.lastReadingKm} km (${mc.lastReadingDate || "-"})`);
    if (mc.projectionKm) lines.push(`CARFAX prognoze šodien: ~${mc.projectionKm} km`);
    if (mc.projectionSimilarKm) lines.push(`Līdzīgiem auto: ~${mc.projectionSimilarKm} km`);
  }
  const st = carfaxOwnerStats(r);
  if (st.total > 0) {
    lines.push(
      `Īpašnieku skaits (CARFAX${st.basis === "history" ? " vēstures ieraksti" : " Owners"}): kopā ${st.total}, t. sk. dīleri ${st.dealers}, pārējie (privātpersonas / uzņēmumi) ${st.nonDealers}${st.country ? ` · ${st.country}` : ""}. Dīleris ir juridiski reģistrēts īpašnieks.`,
    );
  }
  if (r.owners.length > 0 || r.ownersNote) {
    lines.push("ĪPAŠNIEKI (CARFAX BETA)");
    if (r.ownersNote) lines.push(r.ownersNote);
    for (const o of r.owners) {
      lines.push(`${o.index}. ${o.country} · iegāde ${o.purchaseYear || "-"} · ${o.lengthOfUse || "-"} · ${o.ownerType || "-"}`);
    }
  }
  if (r.history.length > 0) {
    lines.push("VĒSTURE (CARFAX)");
    for (const e of r.history) {
      lines.push(
        [e.date, e.odometerKm ? `${e.odometerKm} km` : "", e.country, carfaxTimelineDescription(e)].filter(Boolean).join("\t"),
      );
    }
  }
  if (r.technical.length > 0) {
    lines.push("TEHNISKIE DATI");
    for (const t of r.technical) lines.push(`${t.label}: ${t.value}`);
  }
  if (r.equipment.length > 0) {
    lines.push(`KOMPLEKTĀCIJA (${r.equipment.length})`);
    lines.push(r.equipment.join("; "));
  }
  if (r.originalPrice.total) {
    lines.push(`Jauna auto cena: ${r.originalPrice.total} (bāze ${r.originalPrice.base || "-"}, opcijas ${r.originalPrice.options || "-"})`);
  }
  if (r.maintenance.due.length > 0) {
    lines.push(`CARFAX vispārīgais apkopju grafiks (nav auto vēsture), vecums ${r.maintenance.vehicleAge || "-"}:`);
    lines.push(r.maintenance.due.join("; "));
  }
  return lines.join("\n");
}
