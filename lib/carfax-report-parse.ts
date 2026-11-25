/**
 * CARFAX Europe (carfax.eu) «Vehicle History Report» PDF teksta parsētājs.
 *
 * Deterministisks, pa sadaļām (bez AI): galvene, Quick check, Damage overview, Mileage Check,
 * Owners, Equipment, Technical details, History information. Ievade ir PDF teksta slānis
 * (`extractPdfTextDetailed`) - rindas, kā tās dod pdf-parse; pārlūka drukas galvenes/kājenes
 * (`11/9/26, 9:31 PM...`, `https://www.carfax.eu/vhr?...1/10`) tiek izmestas.
 *
 * Datu modelis (`CarfaxReport`) nav piesaistīts PDF: nākotnes automātika (carfax.eu) var aizpildīt
 * to pašu struktūru un izsaukt `carfaxReportToVendorRows` / `applyCarfaxReportToBlock`.
 */

import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";

export type CarfaxCheckStatus = "ok" | "attention" | "unavailable";

export type CarfaxQuickCheck = {
  /** Oriģinālais virsraksts (piem. „Stolen”). */
  title: string;
  titleLv: string;
  status: CarfaxCheckStatus;
  /** Oriģinālais statusa teksts (angliski). */
  text: string;
  textLv: string;
};

export type CarfaxDamage = {
  /** DD.MM.YYYY vai MM.YYYY (avots bieži dod tikai mēnesi). */
  date: string;
  country: string;
  /** Damage type/cause (LV), tukšs, ja „Not available”. */
  cause: string;
  /** Zonas (LV), piem. „Priekša kreisā”. */
  areas: string[];
  /** Affected components (oriģināli, angliski - CARFAX komponentu nosaukumi). */
  components: string[];
  /** Estimated repair cost, normalizēts (piem. „250 - 500 €”). */
  repairCost: string;
  /** Damage severity (LV). */
  severity: string;
};

export type CarfaxOwner = {
  index: number;
  country: string;
  purchaseYear: string;
  lengthOfUse: string;
  ownerType: string;
};

export type CarfaxHistoryEvent = {
  /** DD.MM.YYYY, MM.YYYY vai YYYY. */
  date: string;
  /** Nobraukums km (tikai cipari), ja ierakstā ir. */
  odometerKm: string;
  /** Ja avots deva jūdzes (ASV) - oriģinālā vērtība. */
  odometerMiles?: string;
  /** Oriģinālais notikums (angliski). */
  event: string;
  /** Notikums latviski (laikposma tabulai / PDF). */
  eventLv: string;
  /** Valsts (LV nosaukums), ja notikumā minēta. */
  country: string;
  /** Papildu rindas (Owner type, Inspection type ...) latviski. */
  details: string[];
  kind: CarfaxEventKind;
};

export type CarfaxEventKind =
  | "manufactured"
  | "registered"
  | "first_traffic"
  | "owner"
  | "inspection"
  | "leasing"
  | "insured"
  | "damage"
  | "total_loss"
  | "insurance_claim"
  | "salvage"
  | "airbag"
  | "odometer"
  | "listing"
  | "import"
  | "other";

export type CarfaxLabeledValue = { label: string; value: string };

export type CarfaxPhoto = {
  url: string;
  /** DD.MM.YYYY vai MM.YYYY. */
  date: string;
  caption: string;
};

export type CarfaxPdfFileMeta = {
  name: string;
  size: number;
  savedAt: string;
  blobPath?: string;
  dropboxPath?: string;
  /** PDF md5 (pasta ielases idempotence - tas pats PDF netiek ielikts divreiz). */
  md5?: string;
  /** "email" - PDF automātiski no info@provin.lv pasta (Apps Script). */
  via?: "upload" | "email";
};

export type CarfaxReport = {
  version: 1;
  /** Kā dati nonāca: PDF augšupielāde vai (nākotnē) automātika. */
  origin: "pdf" | "auto";
  parsedAt: string;
  /** „Report created on” - DD.MM.YYYY HH:MM. */
  reportCreatedAt: string;
  vin: string;
  /** Virsraksta rinda, piem. „2018 AUDI A6”. */
  vehicleTitle: string;
  modelYear: string;
  /** Galvenes lauki (LV etiķetes). */
  vehicle: CarfaxLabeledValue[];
  quickChecks: CarfaxQuickCheck[];
  /** `true`, ja Damage overview saka „No issues reported”. */
  noDamageReported: boolean;
  damages: CarfaxDamage[];
  mileageCheck: {
    statusLv: string;
    status: CarfaxCheckStatus | "";
    lastReadingKm: string;
    lastReadingDate: string;
    projectionKm: string;
    projectionSimilarKm: string;
  };
  owners: CarfaxOwner[];
  /** „No owners found” u.tml. */
  ownersNote: string;
  technical: CarfaxLabeledValue[];
  equipment: string[];
  originalPrice: { base: string; options: string; total: string };
  maintenance: { vehicleAge: string; due: string[] };
  history: CarfaxHistoryEvent[];
  /** carfax.eu PDF bilžu nesatur (25.11 izpēte); automātika var aizpildīt. */
  photos: CarfaxPhoto[];
  pdf?: CarfaxPdfFileMeta;
};

export function emptyCarfaxReport(): CarfaxReport {
  return {
    version: 1,
    origin: "pdf",
    parsedAt: "",
    reportCreatedAt: "",
    vin: "",
    vehicleTitle: "",
    modelYear: "",
    vehicle: [],
    quickChecks: [],
    noDamageReported: false,
    damages: [],
    mileageCheck: {
      statusLv: "",
      status: "",
      lastReadingKm: "",
      lastReadingDate: "",
      projectionKm: "",
      projectionSimilarKm: "",
    },
    owners: [],
    ownersNote: "",
    technical: [],
    equipment: [],
    originalPrice: { base: "", options: "", total: "" },
    maintenance: { vehicleAge: "", due: [] },
    history: [],
    photos: [],
  };
}

/* ------------------------------------------------------------------ */
/* Palīgfunkcijas                                                       */
/* ------------------------------------------------------------------ */

const BROWSER_HEADER_RE = /^\d{1,2}\/\d{1,2}\/\d{2},\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\s*CARFAX Vehicle History Report/i;
const BROWSER_FOOTER_RE = /^https?:\/\/(?:www\.)?carfax\.[a-z.]+\/\S*$/i;

/** Teksta slānis → tīras rindas (bez pārlūka drukas galvenēm / kājenēm). */
export function carfaxTextLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .replace(/ /g, " ")
    .replace(/[’‘]/g, "'")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !BROWSER_HEADER_RE.test(l) && !BROWSER_FOOTER_RE.test(l));
}

export function looksLikeCarfaxReport(text: string): boolean {
  return /CARFAX/i.test(text) && /Vehicle History Report/i.test(text) && /History information|Quick check/i.test(text);
}

function indexOfLine(lines: string[], re: RegExp, from = 0): number {
  for (let i = Math.max(0, from); i < lines.length; i++) if (re.test(lines[i]!)) return i;
  return -1;
}

/** Sadaļa no virsraksta līdz pirmajam no beigu virsrakstiem. */
function section(lines: string[], start: RegExp, ends: RegExp[], from = 0): string[] {
  const s = indexOfLine(lines, start, from);
  if (s < 0) return [];
  let e = lines.length;
  for (const re of ends) {
    const i = indexOfLine(lines, re, s + 1);
    if (i >= 0 && i < e) e = i;
  }
  return lines.slice(s + 1, e);
}

/** „235,525” / „4.233” / „93 419” → „235525”. */
export function carfaxDigits(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * CARFAX datumi → PROVIN formāts: YYYY-MM-DD / DD.MM.YYYY → DD.MM.YYYY; MM/YYYY, MM.YYYY → MM.YYYY; YYYY paliek.
 */
export function carfaxDateToLv(raw: string): string {
  const t = raw.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${pad2(+m[1]!)}.${pad2(+m[2]!)}.${m[3]}`;
  m = t.match(/^(\d{1,2})[/.](\d{4})$/);
  if (m) return `${pad2(+m[1]!)}.${m[2]}`;
  m = t.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}.${m[1]}`;
  if (/^\d{4}$/.test(t)) return t;
  return t;
}

/** Vēstures rindas sākums: datums (fiksēts garums), tad uzreiz km / jūdzes vai notikums. */
function splitHistoryDateLine(line: string): { date: string; rest: string } | null {
  for (const re of [/^(\d{4}-\d{2}-\d{2})/, /^(\d{2}\.\d{2}\.\d{4})/, /^(\d{2}[/.]\d{4})/, /^((?:19|20)\d{2})(?=[A-Z])/]) {
    const m = line.match(re);
    if (m) return { date: m[1]!, rest: line.slice(m[1]!.length).trim() };
  }
  return null;
}

function country(raw: string): string {
  const t = raw.replace(/[.,;]+$/, "").trim();
  if (!t) return "";
  if (/^EU country$/i.test(t)) return "";
  return normalizeCountryNameLv(t) || t;
}

/* ------------------------------------------------------------------ */
/* Tulkojumi                                                            */
/* ------------------------------------------------------------------ */

const VEHICLE_LABELS: Array<[RegExp, string]> = [
  [/^Vehicle reference$/i, "VIN"],
  [/^Color$/i, "Krāsa"],
  [/^Body type$/i, "Virsbūve"],
  [/^Engine size$/i, "Motora tilpums"],
  [/^Total system power$/i, "Kopējā jauda"],
  [/^Combustion engine power$/i, "Iekšdedzes motora jauda"],
  [/^Electric engine power$/i, "Elektromotora jauda"],
  [/^Gearbox type$/i, "Ātrumkārba"],
  [/^Fuel type$/i, "Degviela"],
  [/^Drive$/i, "Piedziņa"],
  [/^Number of doors$/i, "Durvju skaits"],
  [/^Number of seats$/i, "Sēdvietu skaits"],
  [/^Hybrid vehicle$/i, "Hibrīds"],
  [/^Model year$/i, "Modeļa gads"],
];

const HEADER_LABEL_NAMES = [
  "Vehicle reference",
  "Color",
  "Body type",
  "Engine size",
  "Total system power",
  "Combustion engine power",
  "Electric engine power",
  "Gearbox type",
  "Fuel type",
  "Drive",
  "Number of doors",
  "Number of seats",
  "Hybrid vehicle",
  "Model year",
];

const VALUE_LV: Record<string, string> = {
  black: "melna",
  white: "balta",
  "gray/silver": "pelēka / sudraba",
  gray: "pelēka",
  silver: "sudraba",
  blue: "zila",
  red: "sarkana",
  green: "zaļa",
  brown: "brūna",
  beige: "bēša",
  yellow: "dzeltena",
  orange: "oranža",
  estate: "universālis",
  sedan: "sedans",
  hatchback: "hečbeks",
  pickup: "pikaps",
  suv: "apvidus",
  coupe: "kupeja",
  convertible: "kabriolets",
  van: "furgons",
  automatic: "automātiskā",
  manual: "manuālā",
  diesel: "dīzelis",
  petrol: "benzīns",
  gasoline: "benzīns",
  electric: "elektrība",
  "electric, diesel": "elektrība, dīzelis",
  "electric, petrol": "elektrība, benzīns",
  rear: "aizmugures",
  front: "priekšējā",
  awd: "pilnpiedziņa",
  "4wd": "pilnpiedziņa",
  "all-wheel drive": "pilnpiedziņa",
  "not available": "nav datu",
};

/** „1,995 kg” / „4.233 mm” → „1 995 kg”; „5.1 l/100km” → „5,1 l/100km” (LV pieraksts). */
export function carfaxNumberLv(raw: string): string {
  let t = raw.trim();
  let prev = "";
  while (prev !== t) {
    prev = t;
    t = t.replace(/(\d)[,.](\d{3})(?!\d)/g, "$1 $2");
  }
  return t.replace(/(\d)\.(\d{1,2})(?!\d)/g, "$1,$2");
}

function valueLv(raw: string): string {
  const t = raw.trim();
  return VALUE_LV[t.toLowerCase()] ?? carfaxNumberLv(t);
}

const TECH_LABELS: Record<string, string> = {
  "Fuel type": "Degviela",
  "Combustion engine power": "Iekšdedzes motora jauda",
  "Electric engine power": "Elektromotora jauda",
  "Total system power": "Kopējā jauda",
  "Hybrid vehicle": "Hibrīds",
  "CO2 emissions in mixed driving": "CO2 izmeši (jauktais cikls)",
  "Fuel consumption in mixed driving": "Degvielas patēriņš (jauktais cikls)",
  "EU emission standard": "Euro klase",
  "Curb weight": "Pašmasa",
  "Max payload": "Kravnesība",
  "Gross vehicle weight": "Pilnā masa",
  Length: "Garums",
  Width: "Platums",
  Height: "Augstums",
  Wheelbase: "Garenbāze",
  "European vehicle category": "EK kategorija",
  "EU standard code": "EK tipa apstiprinājums",
  "Number of doors": "Durvju skaits",
  "Number of seats": "Sēdvietu skaits",
};

const TECH_GROUP_HEADINGS = /^(Engine and performance|Environment and consumption|Weight|Dimensions|Other information)$/i;

const QUICK_CHECK_TITLES: Record<string, string> = {
  Mileage: "Nobraukums",
  Stolen: "Zādzība",
  "Identity check": "Norakstīšana",
  Import: "Imports",
  Taxi: "Taksometrs",
  Recalls: "Atsaukumi",
  Damage: "Bojājumi",
  Vincoli: "Apgrūtinājumi (ACI)",
  Ipoteca: "Ķīla (ACI)",
  "Commercial use": "Komerclietošana",
  Rental: "Noma",
  Police: "Policija",
  Export: "Eksports",
};

const STATUS_TEXT_LV: Array<[RegExp, string, CarfaxCheckStatus]> = [
  [/logical progression/i, "Odometra rādījumi pieaug loģiski", "ok"],
  [/no indications of odometer manipulation/i, "Nav odometra manipulāciju pazīmju", "ok"],
  [/^Not reported stolen/i, "Nav ziņots par zādzību", "ok"],
  [/^Reported stolen|has been reported stolen/i, "Ziņots par zādzību", "attention"],
  [/^Not reported scrapped/i, "Nav ziņots par norakstīšanu", "ok"],
  [/reported scrapped/i, "Ziņots par norakstīšanu", "attention"],
  [/^Not a private import/i, "Nav privāts imports", "ok"],
  [/private import/i, "Privāts imports", "attention"],
  [/^Not used as taxi/i, "Nav lietots kā taksometrs", "ok"],
  [/used as taxi/i, "Lietots kā taksometrs", "attention"],
  [/no recalls/i, "Atsaukumu nav", "ok"],
  [/^No damage reported/i, "Bojājumi nav ziņoti", "ok"],
  [/Total loss reported/i, "Ziņots par pilnīgu bojāeju (total loss)", "attention"],
  [/has had a damage/i, "Ziņots par bojājumu", "attention"],
  [/ACI does not provide information/i, "ACI datus nesniedz", "unavailable"],
  [/^No data available/i, "Nav datu", "unavailable"],
  [/^No issues reported/i, "Problēmas nav ziņotas", "ok"],
];

function statusFromText(text: string): { lv: string; status: CarfaxCheckStatus } {
  for (const [re, lv, status] of STATUS_TEXT_LV) if (re.test(text)) return { lv, status };
  if (/^(Not |No )/i.test(text)) return { lv: text, status: "ok" };
  return { lv: text, status: "attention" };
}

/** Zonas - tie paši kanoniskie nosaukumi kā AutoDNA / CarVertical (`lib/damage-zones.ts`), lai siluets sakrīt. */
const AREA_LV: Record<string, string> = {
  front: "Priekšpuse",
  rear: "Aizmugure",
  left: "Kreisais sāns",
  right: "Labais sāns",
  "left front": "Kreisā sāna priekšpuse",
  "right front": "Labā sāna priekšpuse",
  "left rear": "Kreisā sāna aizmugure",
  "right rear": "Labā sāna aizmugure",
  "front left": "Kreisā sāna priekšpuse",
  "front right": "Labā sāna priekšpuse",
  "rear left": "Kreisā sāna aizmugure",
  "rear right": "Labā sāna aizmugure",
  roof: "Jumts",
  top: "Jumts",
  underbody: "Apakša",
  undercarriage: "Apakša",
  interior: "Salons",
};

const SEVERITY_LV: Record<string, string> = {
  minor: "neliels",
  moderate: "vidējs",
  "moderate to severe": "vidējs līdz smags",
  severe: "smags",
  "minor to moderate": "neliels līdz vidējs",
};

const CAUSE_LV: Record<string, string> = {
  collision: "sadursme",
  "total loss": "pilnīga bojāeja (total loss)",
  hail: "krusa",
  flood: "plūdi",
  fire: "ugunsgrēks",
  vandalism: "vandālisms",
  theft: "zādzība",
  "not available": "",
};

const OWNER_TYPE_LV: Record<string, string> = {
  dealer: "dīleris",
  commercial: "uzņēmums",
  "commercial business": "uzņēmums",
  "private individual": "privātpersona",
  private: "privātpersona",
  leasing: "līzinga kompānija",
  rental: "nomas kompānija",
  government: "valsts iestāde",
};

function ownerTypeLv(raw: string): string {
  const t = raw.trim();
  return OWNER_TYPE_LV[t.toLowerCase()] ?? t;
}

/* ------------------------------------------------------------------ */
/* Sadaļu parsētāji                                                     */
/* ------------------------------------------------------------------ */

function parseHeader(lines: string[], report: CarfaxReport): void {
  const titleIdx = indexOfLine(lines, /^Vehicle History Report$/i);
  const endIdx = indexOfLine(lines, /^Report created on:/i, Math.max(0, titleIdx));
  if (titleIdx < 0) return;
  const titleLine = lines[titleIdx + 1] ?? "";
  if (titleLine && !/:$/.test(titleLine) && !/^Vehicle reference/i.test(titleLine)) {
    report.vehicleTitle = titleLine;
    const y = titleLine.match(/^((?:19|20)\d{2})\s+/);
    if (y) report.modelYear = y[1]!;
  }
  const headerLines = lines.slice(titleIdx + (report.vehicleTitle ? 2 : 1), endIdx >= 0 ? endIdx : titleIdx + 30);
  const joined = headerLines.join(" ");
  const labelAlt = HEADER_LABEL_NAMES.map((l) => l.replace(/ /g, "\\s+")).join("|");
  const re = new RegExp(`(${labelAlt})\\s*:\\s*`, "gi");
  const hits: Array<{ label: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(joined))) hits.push({ label: m[1]!.replace(/\s+/g, " "), start: m.index, end: re.lastIndex });
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]!;
    const value = joined.slice(h.end, hits[i + 1]?.start ?? joined.length).trim();
    if (!value) continue;
    if (/^Vehicle reference$/i.test(h.label)) {
      report.vin = value.split(/\s+/)[0]!.toUpperCase();
      continue;
    }
    const lv = VEHICLE_LABELS.find(([r]) => r.test(h.label))?.[1] ?? h.label;
    if (report.vehicle.some((v) => v.label === lv)) continue;
    report.vehicle.push({ label: lv, value: valueLv(value) });
  }
  if (endIdx >= 0) {
    const created = lines[endIdx]!.match(/Report created on:\s*(\S+)\s+at\s+(\d{1,2}:\d{2})/i);
    if (created) report.reportCreatedAt = `${carfaxDateToLv(created[1]!)} ${created[2]}`;
  }
}

function parseQuickCheck(lines: string[], report: CarfaxReport): void {
  const body = section(lines, /^Quick check$/i, [/^Legend$/i, /^Damage overview$/i]);
  const known = new Set(Object.keys(QUICK_CHECK_TITLES).map((k) => k.toLowerCase()));
  let cur: { title: string; text: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const text = cur.text.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      const st = statusFromText(text);
      report.quickChecks.push({
        title: cur.title,
        titleLv: QUICK_CHECK_TITLES[cur.title] ?? cur.title,
        status: st.status,
        text,
        textLv: st.lv,
      });
    }
    cur = null;
  };
  for (const line of body) {
    const isTitle =
      known.has(line.toLowerCase()) ||
      (/^[A-Z][a-z]+(?: [a-z]+){0,2}$/.test(line) &&
        !/^(Not|No|There|This|Total|Please|ACI|The|Reported|Our)\b/.test(line) &&
        (cur === null || /[.)]$/.test(cur.text.join(" ")) || cur.text.length > 0));
    if (isTitle && (cur === null || cur.text.length > 0)) {
      flush();
      const canonical = Object.keys(QUICK_CHECK_TITLES).find((k) => k.toLowerCase() === line.toLowerCase()) ?? line;
      cur = { title: canonical, text: [] };
      continue;
    }
    if (cur) cur.text.push(line);
  }
  flush();
}

const DAMAGE_DATE_LINE_RE = /^(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|\d{2}[/.]\d{4})$/;

function parseRepairCost(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const orLess = t.match(/^€?\s*([\d.,]+)\s*€?\s*or less$/i);
  if (orLess) return `līdz ${normalizeLossAmountEurDisplay(`${orLess[1]} EUR`)}`;
  const range = t.match(/^€?\s*([\d.,]+)\s*€?\s*-\s*€?\s*([\d.,]+)\s*€?$/);
  if (range) return normalizeLossAmountEurDisplay(`${carfaxDigits(range[1]!)} - ${carfaxDigits(range[2]!)} EUR`);
  const single = t.match(/^€?\s*([\d.,]+)\s*€?$/);
  if (single) return normalizeLossAmountEurDisplay(`${carfaxDigits(single[1]!)} EUR`);
  return t;
}

function parseDamageOverview(lines: string[], report: CarfaxReport): void {
  const body = section(lines, /^Damage overview$/i, [
    /^Damage Glossary$/i,
    /^Recommended maintenance$/i,
    /^Mileage Check$/i,
    /^Owners$/i,
    /^Equipment$/i,
    /^Technical details$/i,
  ]);
  if (body.length === 0) return;
  if (/^No issues reported$/i.test(body[0] ?? "")) {
    report.noDamageReported = true;
    return;
  }
  type Mode = "" | "country" | "cause" | "areas" | "components" | "cost" | "severity";
  let cur: (CarfaxDamage & { _mode: Mode }) | null = null;
  const out: CarfaxDamage[] = [];
  const flush = () => {
    if (cur) {
      const { _mode, ...d } = cur;
      void _mode;
      out.push(d);
    }
    cur = null;
  };
  for (const line of body) {
    if (DAMAGE_DATE_LINE_RE.test(line)) {
      flush();
      cur = {
        date: carfaxDateToLv(line),
        country: "",
        cause: "",
        areas: [],
        components: [],
        repairCost: "",
        severity: "",
        _mode: "",
      };
      continue;
    }
    if (!cur) continue;
    if (/^Reported in$/i.test(line)) {
      cur._mode = "country";
      continue;
    }
    const reportedIn = line.match(/^Reported in\s+(.+)$/i);
    if (reportedIn) {
      cur.country = country(reportedIn[1]!);
      cur._mode = "";
      continue;
    }
    if (/^Damage$/i.test(line) || /^type\/cause$/i.test(line) || /^Damage type\/cause$/i.test(line)) {
      cur._mode = "cause";
      continue;
    }
    if (/^Affected area/i.test(line)) {
      cur._mode = "areas";
      continue;
    }
    if (/^Affected components/i.test(line)) {
      cur._mode = "components";
      continue;
    }
    if (/^Estimated repair cost:?$/i.test(line)) {
      cur._mode = "cost";
      continue;
    }
    if (/^Damage severity:?$/i.test(line)) {
      cur._mode = "severity";
      continue;
    }
    if (/^(Location reference|extent of the damage|This is a rough estimate|may be higher|the damage has already|based on local rates|countries\.)/i.test(line)) {
      continue;
    }
    if (/^(FRONT|REAR|LEFT|RIGHT)$/.test(line) || /^Area not reported$/i.test(line)) continue;
    switch (cur._mode) {
      case "country":
        cur.country = country(line);
        cur._mode = "";
        break;
      case "cause":
        cur.cause = CAUSE_LV[line.toLowerCase()] ?? line;
        cur._mode = "";
        break;
      case "areas": {
        const lv = AREA_LV[line.toLowerCase()];
        if (lv && !cur.areas.includes(lv)) cur.areas.push(lv);
        break;
      }
      case "components":
        if (/^Estimated repair cost/i.test(line)) cur._mode = "cost";
        else if (line.length <= 60 && !cur.components.includes(line)) cur.components.push(line);
        break;
      case "cost":
        cur.repairCost = parseRepairCost(line);
        cur._mode = "";
        break;
      case "severity":
        cur.severity = SEVERITY_LV[line.toLowerCase()] ?? line;
        cur._mode = "";
        break;
      default:
        break;
    }
  }
  flush();
  report.damages = out;
}

function parseMileageCheck(lines: string[], report: CarfaxReport): void {
  const body = section(lines, /^Mileage Check$/i, [/^CARFAX tips$/i, /^Owners$/i, /^Technical details$/i, /^Equipment$/i]);
  if (body.length === 0) return;
  const mc = report.mileageCheck;
  const statusLine = body[0] ?? "";
  const description = body.slice(1, 4).join(" ");
  const st = statusFromText(`${statusLine} ${description}`.trim());
  mc.status = /^No issues reported$/i.test(statusLine) ? "ok" : st.status;
  mc.statusLv = /no indications of odometer manipulation/i.test(description)
    ? "Nav odometra manipulāciju pazīmju"
    : st.lv;
  const lastIdx = body.findIndex((l) => /^Last odometer reading$/i.test(l));
  if (lastIdx >= 0) {
    mc.lastReadingKm = carfaxDigits(body[lastIdx + 1] ?? "");
    const rep = body.slice(lastIdx, lastIdx + 5).join(" ").match(/Reported on:\s*(\S+)/i);
    if (rep) mc.lastReadingDate = carfaxDateToLv(rep[1]!);
  }
  const thisIdx = body.findIndex((l) => /^For this vehicle$/i.test(l));
  if (thisIdx >= 0) mc.projectionKm = carfaxDigits(body[thisIdx + 1] ?? "");
  const simIdx = body.findIndex((l) => /^For similar vehicles$/i.test(l));
  if (simIdx >= 0) mc.projectionSimilarKm = carfaxDigits(body[simIdx + 1] ?? "");
}

function parseOwners(lines: string[], report: CarfaxReport): void {
  const body = section(lines, /^Owners$/i, [/^Technical details$/i, /^Equipment$/i, /^History information$/i]);
  if (body.length === 0) return;
  let cur: CarfaxOwner | null = null;
  for (const line of body) {
    if (/^BETA$/i.test(line)) continue;
    const head = line.match(/^Owner\s+(\d+)\s+in\s+(.+)$/i);
    if (head) {
      if (cur) report.owners.push(cur);
      cur = { index: +head[1]!, country: country(head[2]!), purchaseYear: "", lengthOfUse: "", ownerType: "" };
      continue;
    }
    const no = line.match(/^No owners found/i);
    if (no) {
      report.ownersNote = "Īpašnieku dati nav atrasti";
      continue;
    }
    if (!cur) continue;
    const py = line.match(/^Purchase year:\s*(\d{4})/i);
    if (py) cur.purchaseYear = py[1]!;
    const lu = line.match(/^Length of use:\s*(.+)$/i);
    if (lu) cur.lengthOfUse = lengthOfUseLv(lu[1]!);
    const ot = line.match(/^Type of owner:\s*(.+)$/i);
    if (ot) cur.ownerType = ownerTypeLv(ot[1]!);
  }
  if (cur) report.owners.push(cur);
}

function lengthOfUseLv(raw: string): string {
  const t = raw.trim();
  if (/less than a month/i.test(t)) return "mazāk par mēnesi";
  return t
    .replace(/(\d+)\s*years?/i, (_, n) => `${n} g.`)
    .replace(/(\d+)\s*months?/i, (_, n) => `${n} mēn.`)
    .trim();
}

function parseTechnical(lines: string[], report: CarfaxReport): void {
  const body = section(lines, /^Technical details$/i, [/^History information$/i, /^For this Vehicle History Report/i]);
  for (let i = 0; i < body.length; i++) {
    const label = body[i]!;
    if (TECH_GROUP_HEADINGS.test(label)) continue;
    const lv = TECH_LABELS[label];
    if (!lv) {
      // Golf (DE) CO2 rinda bez etiķetes: „165 g/km” zem „Environment and consumption”.
      if (/^\d+\s*g\/km$/i.test(label) && !report.technical.some((t) => t.label === TECH_LABELS["CO2 emissions in mixed driving"])) {
        report.technical.push({ label: TECH_LABELS["CO2 emissions in mixed driving"]!, value: label });
      }
      continue;
    }
    const value = body[i + 1] ?? "";
    if (!value || TECH_LABELS[value] || TECH_GROUP_HEADINGS.test(value)) continue;
    i++;
    if (report.technical.some((t) => t.label === lv)) continue;
    report.technical.push({ label: lv, value: valueLv(value) });
  }
}

function parseEquipment(lines: string[], report: CarfaxReport): void {
  const body = section(lines, /^Equipment$/i, [/^Technical details$/i, /^History information$/i]);
  if (body.length === 0) return;
  const items: string[] = [];
  // „Highlights” ir īss izvilkums no pilnā saraksta - nedublē.
  let inHighlights = false;
  for (let i = 0; i < body.length; i++) {
    const line = body[i]!;
    if (/^Highlights$/i.test(line)) {
      inHighlights = true;
      continue;
    }
    if (/^Original features and costs$/i.test(line)) {
      inHighlights = false;
      continue;
    }
    if (inHighlights) continue;
    if (/^(CARFAX tips|Value of originally installed options)$/i.test(line)) continue;
    if (/^[A-Z][A-Za-z &]+ \(\d+\)$/.test(line)) continue;
    if (/^(incl\.|€ ?[\d.,]+)$/i.test(line)) continue;
    if (/^Base price$/i.test(line)) {
      report.originalPrice.base = carfaxNumberLv(body[i + 1] ?? "");
      i++;
      continue;
    }
    if (/^Options total$/i.test(line)) {
      report.originalPrice.options = carfaxNumberLv(body[i + 1] ?? "");
      i++;
      continue;
    }
    if (/^New price$/i.test(line)) {
      report.originalPrice.total = carfaxNumberLv(body[i + 1] ?? "");
      i++;
      continue;
    }
    if (/^(Trims and optional|we highlight|Original vehicle price|Compare this original|condition\.|owner for documentation|Over time,|or possible damage)/i.test(line)) {
      continue;
    }
    if (/^•/.test(line)) {
      const prev = items.pop();
      items.push(prev ? `${prev}; ${line.replace(/^•\s*/, "")}` : line.replace(/^•\s*/, ""));
      continue;
    }
    // „Value of originally installed options” apakšā - marka un modelis (virsraksta rinda bez gada).
    if (report.vehicleTitle && report.vehicleTitle.replace(/^(?:19|20)\d{2}\s+/, "").toLowerCase() === line.toLowerCase()) continue;
    // Pārnesta rinda (piem. „height/longitudinal adjustment”) - pievieno iepriekšējai.
    if (/^[a-z]/.test(line) && items.length > 0 && /[,(]$/.test(items[items.length - 1]!)) {
      items[items.length - 1] = `${items[items.length - 1]} ${line}`;
      continue;
    }
    items.push(line);
  }
  report.equipment = items.filter((s) => s.length > 1);
}

function parseMaintenance(lines: string[], report: CarfaxReport): void {
  const body = section(lines, /^Recommended maintenance$/i, [/^Mileage Check$/i, /^Owners$/i, /^Equipment$/i, /^Technical details$/i]);
  if (body.length === 0) return;
  const ageIdx = body.findIndex((l) => /^Vehicle age$/i.test(l));
  if (ageIdx >= 0) {
    const age = (body[ageIdx + 1] ?? "").match(/(\d+)\s*years?,?\s*(\d+)\s*months?/i);
    if (age) report.maintenance.vehicleAge = `${age[1]} g. ${age[2]} mēn.`;
  }
  for (let i = 0; i < body.length; i++) {
    const due = body[i]!.match(/^due (\d+) times?$/i);
    if (!due) continue;
    const task = body[i - 2] ?? "";
    const interval = body[i - 1] ?? "";
    if (task) report.maintenance.due.push(`${task} (${interval}) - ${due[1]}x`);
  }
}

/* ------------------------------------------------------------------ */
/* History information                                                 */
/* ------------------------------------------------------------------ */

type EventRule = { re: RegExp; kind: CarfaxEventKind; lv: (m: RegExpMatchArray) => string; country?: (m: RegExpMatchArray) => string };

const EVENT_RULES: EventRule[] = [
  { re: /^Vehicle manufactured$/i, kind: "manufactured", lv: () => "Izgatavots" },
  { re: /^Registered(?: in (.+))?$/i, kind: "registered", lv: () => "Reģistrēts", country: (m) => m[1] ?? "" },
  { re: /^First time in traffic(?: in (.+))?$/i, kind: "first_traffic", lv: () => "Pirmo reizi satiksmē", country: (m) => m[1] ?? "" },
  { re: /^New owner reported(?: in (.+))?$/i, kind: "owner", lv: () => "Ziņots jaunais īpašnieks", country: (m) => m[1] ?? "" },
  { re: /^Inspected(?: in (.+))?$/i, kind: "inspection", lv: () => "Tehniskā apskate", country: (m) => m[1] ?? "" },
  { re: /^Leasing reported(?: in (.+))?$/i, kind: "leasing", lv: () => "Ziņots par līzingu", country: (m) => m[1] ?? "" },
  { re: /^Vehicle insured(?: in (.+))?$/i, kind: "insured", lv: () => "Apdrošināts", country: (m) => m[1] ?? "" },
  { re: /^Total loss reported(?: in (.+))?$/i, kind: "total_loss", lv: () => "Ziņots par pilnīgu bojāeju (total loss)", country: (m) => m[1] ?? "" },
  { re: /^Damage reported(?: in (.+))?$/i, kind: "damage", lv: () => "Ziņots par bojājumu", country: (m) => m[1] ?? "" },
  { re: /^Insurance claim reported(?: in (.+))?$/i, kind: "insurance_claim", lv: () => "Apdrošināšanas atlīdzības pieteikums", country: (m) => m[1] ?? "" },
  { re: /^Salvage title was issued(?: in (.+))?$/i, kind: "salvage", lv: () => "Izsniegts salvage title (bojāta auto statuss)", country: (m) => m[1] ?? "" },
  { re: /^Airbag deployed$/i, kind: "airbag", lv: () => "Nostrādājuši drošības spilveni" },
  { re: /^Odometer reading reported(?: in (.+))?$/i, kind: "odometer", lv: () => "Odometra rādījums", country: (m) => m[1] ?? "" },
  { re: /^Offered for sale(?: in (.+))?$/i, kind: "listing", lv: () => "Piedāvāts pārdošanai", country: (m) => m[1] ?? "" },
  {
    re: /^Imported from (.+?) to (.+)$/i,
    kind: "import",
    lv: (m) => `Importēts no ${country(m[1]!) || m[1]} uz ${country(m[2]!) || m[2]}`,
    country: (m) => m[2] ?? "",
  },
  { re: /^Exported(?: to (.+))?$/i, kind: "other", lv: (m) => (m[1] ? `Eksportēts uz ${country(m[1])}` : "Eksportēts"), country: (m) => m[1] ?? "" },
  { re: /^(?:Vehicle )?scrapped$/i, kind: "other", lv: () => "Norakstīts" },
  { re: /^(?:Vehicle )?(?:reported )?stolen$/i, kind: "other", lv: () => "Ziņots par zādzību" },
];

/** CARFAX paskaidrojošais teksts vēstures sadaļā (piem. Salvage title skaidrojums). */
const HISTORY_NOISE_RE =
  /^(Salvage Title$|This vehicle had|the USA\.|vehicle with a mechanic|purchasing\.|DateMileageEvent$|Date$|Mileage$|Event$|Check the condition)/i;

function parseHistoryDetail(line: string): string | null {
  let m = line.match(/^Owner type:\s*(.+)$/i);
  if (m) return `īpašnieka tips: ${ownerTypeLv(m[1]!)}`;
  m = line.match(/^Inspection type:\s*(.+)$/i);
  if (m) {
    const t = m[1]!.trim().toLowerCase();
    return t === "regular" ? "kārtējā" : t === "type approval" ? "tipa apstiprinājums" : `veids: ${m[1]!.trim()}`;
  }
  if (/^Inspection passed$/i.test(line)) return "izturēta";
  if (/^Inspection failed$/i.test(line)) return "neizturēta";
  m = line.match(/^Inspection valid until\s+(\S+)$/i);
  if (m) return `derīga līdz ${carfaxDateToLv(m[1]!)}`;
  return null;
}

function parseMileageToken(rest: string): { km: string; miles?: string; rest: string } | null {
  // Teksta slānī km bieži salīp ar notikumu: „93,419 kmInspected in Sweden”.
  const mi = rest.match(/^([\d.,]+)\s*miles(?![a-z])\s*(.*)$/);
  if (mi) return { km: "", miles: carfaxDigits(mi[1]!), rest: mi[2]!.trim() };
  const km = rest.match(/^([\d.,]+)\s*km(?![a-z])\s*(.*)$/);
  if (km) return { km: carfaxDigits(km[1]!), rest: km[2]!.trim() };
  return null;
}

function parseHistory(lines: string[], report: CarfaxReport): void {
  const body = section(lines, /^History information$/i, [/^For this Vehicle History Report/i, /^CARFAX Glossary$/i]);
  type Group = { date: string; km: string; miles?: string; lines: string[] };
  const groups: Group[] = [];
  for (const line of body) {
    if (HISTORY_NOISE_RE.test(line)) continue;
    const dl = splitHistoryDateLine(line);
    if (dl) {
      const g: Group = { date: carfaxDateToLv(dl.date), km: "", lines: [] };
      let rest = dl.rest;
      const mt = parseMileageToken(rest);
      if (mt) {
        g.km = mt.km;
        if (mt.miles) g.miles = mt.miles;
        rest = mt.rest;
      }
      if (rest) g.lines.push(rest);
      groups.push(g);
      continue;
    }
    const g = groups[groups.length - 1];
    if (!g) continue;
    // ASV: „548 miles” rindā ar datumu, „882 km” nākamajā rindā.
    const kmOnly = line.match(/^([\d.,]+)\s*km$/i);
    if (kmOnly && !g.km && g.lines.length === 0) {
      g.km = carfaxDigits(kmOnly[1]!);
      continue;
    }
    g.lines.push(line);
  }

  for (const g of groups) {
    const events: CarfaxHistoryEvent[] = [];
    for (const line of g.lines) {
      const detail = parseHistoryDetail(line);
      if (detail) {
        const last = events[events.length - 1];
        if (last) last.details.push(detail);
        continue;
      }
      const rule = EVENT_RULES.map((r) => ({ r, m: line.match(r.re) })).find((x) => x.m);
      if (rule && rule.m) {
        events.push({
          date: g.date,
          odometerKm: "",
          event: line,
          eventLv: rule.r.lv(rule.m),
          country: country(rule.r.country?.(rule.m) ?? ""),
          details: [],
          kind: rule.r.kind,
        });
        continue;
      }
      // Nezināms notikums - saglabā oriģinālu, lai nekas nepazūd.
      if (/^[A-Z]/.test(line) && line.length <= 120 && !/\.$/.test(line)) {
        events.push({ date: g.date, odometerKm: "", event: line, eventLv: line, country: "", details: [], kind: "other" });
      }
    }
    if (events.length === 0 && (g.km || g.miles)) {
      events.push({ date: g.date, odometerKm: "", event: "Odometer reading reported", eventLv: "Odometra rādījums", country: "", details: [], kind: "odometer" });
    }
    // Valsts grupā: ja kāds notikums to nosauc, tā pati diena - tā pati valsts (piem. „Registered in Sweden” + „New owner reported”).
    const groupCountry = events.find((e) => e.country)?.country ?? "";
    for (const [i, e] of events.entries()) {
      if (!e.country && groupCountry && e.kind !== "import") e.country = groupCountry;
      if (i === 0) {
        e.odometerKm = g.km;
        if (g.miles) e.odometerMiles = g.miles;
      }
    }
    report.history.push(...events);
  }
}

/* ------------------------------------------------------------------ */
/* Publiskais API                                                       */
/* ------------------------------------------------------------------ */

export function parseCarfaxReportText(text: string, opts?: { now?: Date }): CarfaxReport | null {
  if (!looksLikeCarfaxReport(text)) return null;
  const lines = carfaxTextLines(text);
  const report = emptyCarfaxReport();
  report.parsedAt = (opts?.now ?? new Date()).toISOString();
  parseHeader(lines, report);
  parseQuickCheck(lines, report);
  parseDamageOverview(lines, report);
  parseMaintenance(lines, report);
  parseMileageCheck(lines, report);
  parseOwners(lines, report);
  parseEquipment(lines, report);
  parseTechnical(lines, report);
  parseHistory(lines, report);
  return report;
}

/** Cik ierakstu izvilkts (atskaitei / UI paziņojumam). */
export function carfaxReportCounts(r: CarfaxReport): {
  history: number;
  mileage: number;
  damages: number;
  owners: number;
  quickChecks: number;
  technical: number;
  equipment: number;
} {
  return {
    history: r.history.length,
    mileage: r.history.filter((e) => e.odometerKm).length,
    damages: r.damages.length,
    owners: r.owners.length,
    quickChecks: r.quickChecks.length,
    technical: r.technical.length,
    equipment: r.equipment.length,
  };
}
