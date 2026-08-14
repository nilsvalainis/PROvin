/**
 * BMW oficiālā dīlera portāla PDF (vehicle information export) → strukturēti dati.
 *
 * Sadaļas: virsraksts („BMW E61”) + lauku saraksts (MODEL SERIES … UPHOLSTERY CODE),
 * „Specifications & Options” (rūpnīcas kodi), „Service History”, „Key Read History”
 * (atslēgas nolasītie odometra rādījumi) un „Repair History” (apmeklējumi ar detaļām).
 *
 * Visi nobraukumi tiek atgriezti kilometros: atskaite dod „188,858 mi / 303,938 km”,
 * un, ja km nav, jūdzes tiek pārrēķinātas.
 */

import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import type { OutvinEquipmentLine, OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";
import { serviceWorkTermLv } from "@/lib/service-work-term-lv";

export type BmwDealerVisit = {
  /** DD.MM.YYYY */
  date: string;
  /** Odometrs kilometros (cipari). */
  odometer: string;
  /** Dīleris / servisa punkts, kā norādīts atskaitē. */
  dealer: string;
  /** Pasūtījuma numurs atskaitē. */
  orderNo: string;
  /** Detaļas / darbi, kā norādīts atskaitē (bez detaļu numuriem). */
  parts: string[];
};

export type BmwDealerKeyRead = {
  date: string;
  odometer: string;
  /** Nākamie termiņi no atslēgas nolasījuma: „Bremžu šķidrums — 10.08.2026”. */
  dueDates: { component: string; dueDate: string }[];
};

export type BmwDealerReportParse = {
  vehicleInfo: Partial<OutvinVehicleInfo>;
  equipment: OutvinEquipmentLine[];
  keyReads: BmwDealerKeyRead[];
  visits: BmwDealerVisit[];
  /** `true`, ja atskaitē ir sadaļa „Service History: No service history found.” */
  serviceHistoryEmpty: boolean;
};

const MI_TO_KM = 1.609344;

/** Lauka etiķetes tieši tādā formā, kā tās ir dīlera izdrukā. */
const VEHICLE_INFO_LABELS: { key: keyof OutvinVehicleInfo; label: string }[] = [
  { key: "modelSeries", label: "MODEL SERIES" },
  { key: "vinCode", label: "VIN" },
  { key: "vehicleType", label: "VEHICLE TYPE" },
  { key: "transmission", label: "TRANSMISSION" },
  { key: "steeringSide", label: "STEERING" },
  { key: "engineCode", label: "ENGINE" },
  { key: "engineNumber", label: "ENGINE NUMBER" },
  { key: "body", label: "BODY" },
  { key: "drive", label: "DRIVE" },
  { key: "power", label: "POWER" },
  { key: "integrationLevel", label: "INTEGRATION LEVEL" },
  { key: "currentILevel", label: "CURRENT I LEVEL" },
  { key: "developmentCode", label: "DEVELOPMENT CODE" },
  { key: "modelCode", label: "MODEL CODE" },
  { key: "productionDate", label: "PRODUCTION DATE" },
  { key: "firstRegistration", label: "FIRST REGISTRATION" },
  { key: "warrantyStartDate", label: "WARRANTY START DATE" },
  { key: "countryRegion", label: "COUNTRY/REGION" },
  { key: "color", label: "COLOUR" },
  { key: "colorCode", label: "COLOUR CODE" },
  { key: "interior", label: "UPHOLSTERY" },
  { key: "interiorCode", label: "UPHOLSTERY CODE" },
];

/** Garākā etiķete vispirms: „ENGINE NUMBER” nedrīkst nolasīties kā „ENGINE”. */
const LABELS_BY_LENGTH = [...VEHICLE_INFO_LABELS].sort((a, b) => b.label.length - a.label.length);

const DATE_ONLY_KEYS = new Set<keyof OutvinVehicleInfo>([
  "productionDate",
  "firstRegistration",
  "warrantyStartDate",
]);

/** Vai PDF ir BMW dīlera portāla izdruka (nevis AutoDNA / CarVertical / auto-records.com). */
export function looksLikeBmwDealerReport(text: string): boolean {
  const head = text.slice(0, 200_000);
  let markers = 0;
  if (/^\s*MODEL\s+SERIES\s*$/im.test(head)) markers += 1;
  if (/UPHOLSTERY\s+CODE/i.test(head)) markers += 1;
  if (/INTEGRATION\s+LEVEL/i.test(head)) markers += 1;
  if (/Key\s+Read\s+History/i.test(head)) markers += 1;
  if (/Repair\s+History/i.test(head)) markers += 1;
  if (/Specifications\s*&\s*Options/i.test(head)) markers += 1;
  return markers >= 2;
}

function normalizeSpace(raw: string): string {
  return raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/** „02/06/2008” → „02.06.2008”; citādi teksts bez izmaiņām. */
function normalizeSlashDate(raw: string): string {
  const m = normalizeSpace(raw).match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (!m) return normalizeSpace(raw);
  return `${m[1]!.padStart(2, "0")}.${m[2]!.padStart(2, "0")}.${m[3]}`;
}

function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function milesToKm(miles: string): string {
  const value = Number.parseInt(digitsOnly(miles), 10);
  if (!Number.isFinite(value) || value <= 0) return "";
  return String(Math.round(value * MI_TO_KM));
}

/** „188,858 mi / 303,938 km” → km cipari; ja km nav, pārrēķina no jūdzēm. */
export function bmwOdometerToKm(fragment: string): string {
  const km = fragment.match(/([\d.,\s]+)\s*km/i);
  if (km) {
    const digits = digitsOnly(km[1] ?? "");
    if (digits) return digits;
  }
  const mi = fragment.match(/([\d.,\s]+)\s*mi\b/i);
  if (mi) return milesToKm(mi[1] ?? "");
  return "";
}

/**
 * Odometra rādījums aiz datuma ir tikai tad, ja fragments SĀKAS ar rādījumu („145,613 mi /
 * 234,342 km”). Kolonna „Remaining Distance” satur nobraukumu līdz nākamajai apkopei tikai
 * jūdzēs („6835 mi”, „-11185 mi”) — tas nav odometrs, un tas nedrīkst nonākt nobraukuma tabulā.
 */
export function bmwOdometerReadingKm(fragment: string, opts?: { allowMilesOnly?: boolean }): string {
  const value = normalizeSpace(fragment);
  const pair = value.match(/^([\d.,]+)\s*mi\s*\/\s*([\d.,]+)\s*km\b/i);
  if (pair) return digitsOnly(pair[2] ?? "");
  const km = value.match(/^([\d.,]+)\s*km\b/i);
  if (km) return digitsOnly(km[1] ?? "");
  if (!opts?.allowMilesOnly) return "";
  const mi = value.match(/^([\d.,]+)\s*mi\b/i);
  return mi ? milesToKm(mi[1] ?? "") : "";
}

function parseVehicleInfo(lines: string[]): Partial<OutvinVehicleInfo> {
  const out: Partial<OutvinVehicleInfo> = {};
  const stopRe = /^(Specifications\s*&\s*Options|Service\s+History|Key\s+Read\s+History|Repair\s+History)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeSpace(lines[i] ?? "");
    if (!line) continue;
    if (stopRe.test(line)) break;

    const hit = LABELS_BY_LENGTH.find(({ label }) =>
      new RegExp(`^${label.replace(/[/]/g, "\\/")}\\s*:?\\s*`, "i").test(line),
    );
    if (!hit) continue;
    if (out[hit.key]) continue;

    const inline = normalizeSpace(line.slice(hit.label.length).replace(/^:\s*/, ""));
    const value = inline || normalizeSpace(lines[i + 1] ?? "");
    if (!value || LABELS_BY_LENGTH.some(({ label }) => value.toUpperCase() === label)) continue;
    out[hit.key] = DATE_ONLY_KEYS.has(hit.key) ? normalizeSlashDate(value) : value.slice(0, 300);
  }

  const title = parseHeaderTitle(lines);
  if (title) out.model = title;
  return out;
}

/** Virsraksts pirms lauku saraksta („BMW E61”) — atskaites transportlīdzekļa apzīmējums. */
function parseHeaderTitle(lines: string[]): string {
  const limit = Math.min(lines.length, 40);
  for (let i = 0; i < limit; i++) {
    const line = normalizeSpace(lines[i] ?? "");
    if (!line) continue;
    if (/^MODEL\s+SERIES$/i.test(line)) break;
    if (/^[A-ZÄÖÜ][A-Za-z0-9ÄÖÜäöü.\- ]{1,40}$/.test(line) && /\d|[A-Z]{2,}/.test(line)) return line;
  }
  return "";
}

const EQUIPMENT_LINE_RE = /^([0-9A-Z]{4})([A-Za-zÄÖÜäöüß(].*)$/;

function parseEquipment(lines: string[]): OutvinEquipmentLine[] {
  const start = lines.findIndex((l) => /^Specifications\s*&\s*Options$/i.test(normalizeSpace(l)));
  if (start < 0) return [];
  const out: OutvinEquipmentLine[] = [];
  const seen = new Set<string>();

  for (let i = start + 1; i < lines.length; i++) {
    const line = normalizeSpace(lines[i] ?? "");
    if (!line) continue;
    if (/^(Service\s+History|Key\s+Read\s+History|Repair\s+History)$/i.test(line)) break;
    if (/^CodeDescription$/i.test(line) || /^Code\s+Description$/i.test(line)) continue;
    const m = line.match(EQUIPMENT_LINE_RE);
    if (!m) continue;
    const code = m[1]!;
    const description = normalizeSpace(m[2] ?? "");
    if (!description || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, description: description.slice(0, 400) });
  }
  return out;
}

/** Nosaukums latviski, ja termins ir zināms; citādi oriģināls (nekas netiek izdomāts). */
export function bmwComponentLabelLv(raw: string): string {
  return serviceWorkTermLv(normalizeSpace(raw));
}

const KEY_READ_HEAD_RE = /^(\d{2}\/\d{2}\/\d{4})\s*(.*)$/;
const KEY_READ_COMPONENT_RE = /^(.+?)(Not due|Due soon|Overdue|-)?\s*(\d{2}\/\d{2}\/\d{4})?\s*-?\s*$/;
/** Aiz katra nolasījuma seko tabulas galva — pēc tās atpazīstam arī izdrukas, kur ir tikai jūdzes. */
const COMPONENT_TABLE_HEAD_RE = /^Icon\s*Component/i;
/** „…01/05/2025-11185 mi” → nogriež atlikuma kolonnu, lai paliek tikai termiņa datums. */
const REMAINING_DISTANCE_TAIL_RE = /\s*-?[\d.,]+\s*(?:mi|km)\s*$/i;

function parseKeyReadHistory(lines: string[]): BmwDealerKeyRead[] {
  const start = lines.findIndex((l) => /^Key\s+Read\s+History$/i.test(normalizeSpace(l)));
  if (start < 0) return [];

  const out: BmwDealerKeyRead[] = [];
  let current: BmwDealerKeyRead | null = null;

  for (let i = start + 1; i < lines.length; i++) {
    const line = normalizeSpace(lines[i] ?? "");
    if (!line) continue;
    if (/^Repair\s+History$/i.test(line)) break;
    if (COMPONENT_TABLE_HEAD_RE.test(line)) continue;

    const head = line.match(KEY_READ_HEAD_RE);
    if (head) {
      const odometer = bmwOdometerReadingKm(head[2] ?? "", {
        allowMilesOnly: COMPONENT_TABLE_HEAD_RE.test(normalizeSpace(lines[i + 1] ?? "")),
      });
      if (odometer) {
        current = { date: normalizeSlashDate(head[1] ?? ""), odometer, dueDates: [] };
        out.push(current);
        continue;
      }
    }
    if (!current) continue;

    // Kolonna „Remaining Distance” („-11185 mi”) nav daļa no termiņa rindas.
    const row = line.replace(REMAINING_DISTANCE_TAIL_RE, "");
    const comp = row.match(KEY_READ_COMPONENT_RE);
    if (!comp) continue;
    // Izdrukā statuss un termiņš mēdz būt nākamajā rindā („Brake FluidNot due” + „30/07/2026-”).
    const nextLine = normalizeSpace(lines[i + 1] ?? "").replace(REMAINING_DISTANCE_TAIL_RE, "");
    const dueDate = comp[3] || (nextLine.match(/^(\d{2}\/\d{2}\/\d{4})\s*-?$/)?.[1] ?? "");
    if (!dueDate) continue;
    const component = normalizeSpace((comp[1] ?? "").replace(/(Not due|Due soon|Overdue)\s*$/i, ""));
    if (!component || /^\d/.test(component)) continue;
    current.dueDates.push({ component: bmwComponentLabelLv(component), dueDate: normalizeSlashDate(dueDate) });
  }

  return out.filter((r) => r.date && r.odometer);
}

/** Apmeklējums bez odometra izdrukā ir „02/01/2013-Autohaus …”. */
const VISIT_HEAD_RE =
  /^(\d{2}\/\d{2}\/\d{4})\s*([\d.,]+\s*mi\s*\/\s*[\d.,]+\s*km|[\d.,]+\s*km|[\d.,]+\s*mi|-)\s*(.*)$/i;

/** Nākamā apmeklējuma sākums var salipt ar iepriekšējās detaļas rindu. */
const VISIT_HEAD_SPLIT_RE =
  /(?=\d{2}\/\d{2}\/\d{4}\s*(?:[\d.,]+\s*(?:mi|km)\b|-[A-Za-zÄÖÜ]{3,}))/;

/** Servisa punkta nosaukums, nevis „11185 mi” no atlikuma kolonnas. */
function looksLikeDealerName(rest: string): boolean {
  if (!/[A-Za-zÄÖÜ]{3,}/.test(rest)) return false;
  return !/^[\d.,\s-]*(mi|km)\b/i.test(rest);
}

/**
 * Detaļas numurs un daudzums rindas beigās (`…FTT361`, `…FL001111`, `…659024568861`,
 * `…65902456886-1`) — klientam vērtīgs ir tikai nosaukums.
 */
const PART_CODE_TAIL_RE = /\s*F[A-Z]+\d[\dA-Z]*\s*-?\d{0,3}$/;
const PART_NUMBER_TAIL_RE = /\s*\d{6,}\s*-?\d{0,3}$/;

function parsePartName(line: string): string {
  const name = normalizeSpace(line)
    .replace(PART_CODE_TAIL_RE, "")
    .replace(PART_NUMBER_TAIL_RE, "")
    .replace(/[-–\s]+$/, "")
    .trim();
  if (!name || /^part\s*name/i.test(name)) return "";
  return name.replace(/[,;]+$/, "");
}

const PART_TABLE_HEAD_RE = /^Part\s*Name/i;
const SERVICED_MARK_RE = /[✓✔]/;

/** „Engine oil-” → „Engine oil”; atdalītāji („-”, „--”) un datumi nav komponenti. */
function componentName(raw: string): string {
  const name = normalizeSpace(raw)
    .replace(/\s*(Not due|Due soon|Overdue)\s*$/i, "")
    .replace(/[-–—\s]+$/, "")
    .trim();
  if (!name || !/[A-Za-zÄÖÜäöüß]/.test(name)) return "";
  if (/^\d{2}\/\d{2}\/\d{4}/.test(name)) return "";
  return name;
}

/** PDF teksta rindas → rindas, kurās katrs apmeklējuma virsraksts sākas no jaunas rindas. */
function splitGluedVisitHeads(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const parts = normalizeSpace(line).split(VISIT_HEAD_SPLIT_RE);
    for (const part of parts) {
      const value = part.trim();
      if (value) out.push(value);
    }
  }
  return out;
}

/** „Repair History” un „Service History” bloki: apmeklējums + detaļu / darbu saraksts. */
function parseVisitSection(rawLines: string[], heading: RegExp): BmwDealerVisit[] {
  const lines = splitGluedVisitHeads(rawLines);
  const start = lines.findIndex((l) => heading.test(normalizeSpace(l)));
  if (start < 0) return [];

  const out: BmwDealerVisit[] = [];
  let current: BmwDealerVisit | null = null;
  // „Service History” dod komponentu tabulu ar ķeksīšiem, „Repair History” — detaļu sarakstu.
  let mode: "parts" | "components" = "parts";
  let pendingComponent = "";

  for (let i = start + 1; i < lines.length; i++) {
    const line = normalizeSpace(lines[i] ?? "");
    if (!line) continue;
    if (/^(Key\s+Read\s+History|Specifications\s*&\s*Options)$/i.test(line)) break;
    if (/^(Repair|Service)\s+History$/i.test(line)) continue;

    const head = line.match(VISIT_HEAD_RE);
    if (head) {
      const token = normalizeSpace(head[2] ?? "");
      const rest = normalizeSpace(head[3] ?? "");
      const hasDealer = looksLikeDealerName(rest);
      const odometer = token === "-" ? "" : bmwOdometerReadingKm(token, { allowMilesOnly: hasDealer });
      if (odometer || hasDealer) {
        const orderMatch = rest.match(/Order\s*:?\s*(.+)$/i);
        const dealer = normalizeSpace(rest.replace(/Order\s*:?.*$/i, "")).replace(/[,;]+$/, "");
        current = {
          date: normalizeSlashDate(head[1] ?? ""),
          odometer,
          dealer: dealer.replace(/^Dealer\s+ID\s*:?\s*/i, "Dīlera ID: ").slice(0, 200),
          orderNo: normalizeSpace(orderMatch?.[1] ?? "").slice(0, 80),
          parts: [],
        };
        out.push(current);
        mode = "parts";
        pendingComponent = "";
        continue;
      }
    }
    if (!current) continue;
    if (/^No additional details available\.?$/i.test(line)) continue;
    if (COMPONENT_TABLE_HEAD_RE.test(line)) {
      mode = "components";
      pendingComponent = "";
      continue;
    }
    if (PART_TABLE_HEAD_RE.test(line)) {
      mode = "parts";
      continue;
    }

    if (mode === "components") {
      // Komponents un ķeksītis „Serviced” ir atsevišķās rindās: „Engine oil-” … „✓”.
      if (SERVICED_MARK_RE.test(line)) {
        const name = componentName(line.replace(SERVICED_MARK_RE, " ")) || pendingComponent;
        if (name) current.parts.push(name);
        pendingComponent = "";
        continue;
      }
      pendingComponent = componentName(line);
      continue;
    }

    const part = parsePartName(line);
    if (part) current.parts.push(part);
  }

  return out.filter((v) => v.date);
}

export function parseBmwDealerReport(rawText: string): BmwDealerReportParse {
  const text = sanitizePdfTextForParsing(rawText);
  const lines = text.split(/\r?\n/);

  const vehicleInfo = parseVehicleInfo(lines);
  if (vehicleInfo.firstRegistration) {
    vehicleInfo.firstRegistration = formatAutoRecordsDateForOutput(vehicleInfo.firstRegistration) ||
      vehicleInfo.firstRegistration;
  }

  const repairVisits = parseVisitSection(lines, /^Repair\s+History$/i);
  const serviceVisits = parseVisitSection(lines, /^Service\s+History$/i);

  return {
    vehicleInfo,
    equipment: parseEquipment(lines),
    keyReads: parseKeyReadHistory(lines),
    visits: mergeVisits([...serviceVisits, ...repairVisits]),
    serviceHistoryEmpty: /No\s+service\s+history\s+found/i.test(text),
  };
}

function visitKey(v: BmwDealerVisit): string {
  return `${v.date}|${v.odometer}|${v.orderNo}`;
}

/** Viens ieraksts uz datumu+km+pasūtījumu; detaļu sarakstus apvieno. */
function mergeVisits(visits: BmwDealerVisit[]): BmwDealerVisit[] {
  const byKey = new Map<string, BmwDealerVisit>();
  for (const visit of visits) {
    const key = visitKey(visit);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...visit, parts: dedupeParts(visit.parts) });
      continue;
    }
    byKey.set(key, {
      ...prev,
      dealer: prev.dealer || visit.dealer,
      parts: dedupeParts([...prev.parts, ...visit.parts]),
    });
  }
  return [...byKey.values()];
}

function dedupeParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}
