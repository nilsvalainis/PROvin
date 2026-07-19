/**
 * CarVertical PDF / iekopēts RAW — odometrs, vēstures laikposms, bojājumi.
 * Atbalsta fragmentētu PDF tekstu (vārdi un datumi sadalīti pa rindām).
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sanitizeMileageCountryField,
  sortAutoRecordsDescending,
} from "@/lib/auto-records-paste-parse";
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import { CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL } from "@/lib/admin-source-blocks";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";

export const CARVERTICAL_TIMELINE_TITLE = "Transportlīdzekļa ierakstu laikposms";

export type CarVerticalTimelineRow = {
  date: string;
  country: string;
  description: string;
};

export type CarVerticalDamageDetailRow = {
  date: string;
  country: string;
  lossAmount: string;
  damagedSides: string;
  damageGroups: string;
};

export type CarVerticalParseResult = {
  serviceHistory: AutoRecordsServiceRow[];
  timeline: CarVerticalTimelineRow[];
  incidents: LtabIncidentRow[];
  damageDetails: CarVerticalDamageDetailRow[];
};

/** Salīdzina fragmentētu CarVertical PDF tekstu parsēšanai. */
export function normalizeCarVerticalPdfText(raw: string): string {
  let t = sanitizePdfTextForParsing(raw);
  t = t.replace(/[\u000c\u200b]/g, "");
  // pdf.js sadalīti vārdi (tikai zināmi fragmenti — nevis vispārīga salīmēšana)
  t = t.replace(/Transportlīdzek\s+ļ\s+a/gi, "Transportlīdzekļa");
  t = t.replace(/Transportl\s+[īi]\s*dzek\s+ļ\s+a/gi, "Transportlīdzekļa");
  t = t.replace(/Ra\s+ž\s+ots/gi, "Ražots");
  t = t.replace(/Nov\s+[eē]\s+rt\s+[eē]\s+j\s+ums/gi, "Novērtējums");
  t = t.replace(/lai\s+kposms/gi, "laikposms");
  // Ģenerēšanas datums: 24.05.2 + 26 → 24.05.2026
  t = t.replace(/(\d{1,2}\.\d{1,2}\.\d)\s+(\d{2})\b/g, "$1$2");
  // Īsi sadalīti vārdu fragmenti (1–3 burti nākamajā rindā)
  t = t.replace(/([a-zāčēģīķļņšūž])\s*\n\s*([a-zāčēģīķļņšūž]{1,3})(?=\s|\n|$|[,.:;])/gi, "$1$2");
  // MM.YYYY: 12.2 + 016. → 12.2016.
  t = t.replace(/(\d{1,2})\.(\d)\s*\n?\s*(\d{3})\./g, (_, a, b, c) => `${a}.${b}${c}.`);
  // MM.YYYY: 06.2 + 24. → 06.2024. (pirms valsts vai km)
  t = t.replace(
    /(\d{1,2})\.(\d)\s*\n?\s*(\d{2})\.(?=\s*(?:[A-Za-zĀČĒĢĪĶĻŅŠŪŽ]|$|[\d\s]*km\b))/g,
    (_, a, b, c) => `${a}.${b}${c}.`,
  );
  // 2.2 + 2 + 0. 113 km → 2.2020. 113 km
  t = t.replace(
    /(\d{1,2})\.(\d)\s*\n\s*(\d)\s*\n\s*(\d)\.\s+([\d\s]+km\b)/gi,
    (_, mo, _y1, y2, y3, km) => `${mo}.20${y2}${y3}. ${km}`,
  );
  // Timeline: 04.2 + 0 + 24. Itālija → 04.2024. Itālija
  t = t.replace(
    /(\d{1,2})\.(\d)\s*\n\s*(\d)\s*\n\s*(\d{2})\.(?=\s*[A-Za-zĀČĒĢĪĶĻŅŠŪŽ])/g,
    (_, a, b, c, d) => `${a}.${b}${c}${d}.`,
  );
  // pdf.js: 06.2 0 24. Šveice → 06.2024. Šveice
  t = t.replace(
    /(\d{1,2})\.(\d)\s+(\d)\s+(\d{2})\.(?=\s*[A-Za-zĀČĒĢĪĶĻŅŠŪŽ])/g,
    (_, a, b, c, d) => `${a}.${b}${c}${d}.`,
  );
  t = t.replace(/Raž\s*\n\s*o\s*\n\s*ts/gi, "Ražots");
  t = t.replace(/Raž\s*\n\s*ots/gi, "Ražots");
  t = t.replace(/Nov[eē]rt[eē]j\s*\n\s*ums/gi, "Novērtējums");
  // PDF kļūdaini salīmēts gads: 2.220. → 2.2020., 04.221. → 04.2021.
  t = t.replace(/(\d{1,2})\.2(\d)(\d)\./g, (_, mo, y2, y3) => `${mo}.20${y2}${y3}.`);
  // Nobraukums sadalīts pa rindām: 107 + 567 km, 173 30 + 2 km
  t = t.replace(/(\d{1,2}\.\d{4}\.\s*\d{1,2})\s*\n\s*(\d[\d\s]*km\b)/gi, "$1$2");
  t = t.replace(/(\d[\d\s]{2,})\s*\n\s*(\d\s*km\b)/gi, "$1$2");
  t = t.replace(/(\d)\s*\n\s*(\d[\d\s]*km\b)/g, "$1$2");
  t = t.replace(/(\d)\s+km\b/gi, "$1 km");
  // Atjauno atstarpes ap atslēgvārdiem
  t = t.replace(/rādījumuieraksti/gi, "rādījumu ieraksti");
  t = t.replace(/laikposms([A-ZĀ])/g, "laikposms\n$1");
  t = t.replace(/laikposms/gi, "laikposms");
  t = t.replace(/lai\s*\n\s*kposms/gi, "laikposms");
  t = t.replace(/valsts([A-ZĀ])/g, "valsts\n$1");
  t = t.replace(/(Itālija|Latvija|Šveice|Vācija|Polija)([A-ZĀ])/g, "$1\n$2");
  return joinCarVerticalOdometerColumnTwo(t);
}

/** 2. odometra kolonna: fragmenti PIRMS „ieraksti”, km — pēc. */
function joinCarVerticalOdometerColumnTwo(text: string): string {
  const matches = [...text.matchAll(/ieraksti/gi)];
  if (matches.length < 2) return text;
  const splitAt = matches[1]!.index!;
  const before = text.slice(0, splitAt);
  const after = text.slice(splitAt);

  const linesBefore = before.split("\n");
  const frags: string[] = [];
  for (let i = linesBefore.length - 1; i >= 0; i--) {
    const l = linesBefore[i]!.trim();
    if (/^\d{1,2}\.\d$/.test(l)) frags.unshift(l);
    else if (frags.length > 0) break;
  }

  const kmLines = [...after.matchAll(/(\d{2})\.\s*([\d\s\u00a0]+)\s*km\b/gi)];
  if (frags.length === 0 || frags.length !== kmLines.length) return text;

  const joinedLines: string[] = [];
  for (let i = 0; i < frags.length; i++) {
    const f = frags[i]!.match(/^(\d{1,2})\.(\d)$/);
    const k = kmLines[i];
    if (!f || !k) continue;
    joinedLines.push(`${f[1]}.20${k[1]}. ${k[2]!.trim()} km`);
  }
  if (joinedLines.length === 0) return text;

  const fragStart = before.lastIndexOf(frags[0]!);
  const lastKm = kmLines[kmLines.length - 1];
  const kmEndIdx =
    lastKm?.index != null && lastKm[0]
      ? splitAt + after.indexOf(lastKm[0]) + lastKm[0].length
      : text.length;

  return `${text.slice(0, fragStart).trimEnd()}\n${joinedLines.join("\n")}\n${text.slice(kmEndIdx).trimStart()}`;
}

function extractSection(text: string, startRe: RegExp, endRes: RegExp[]): string {
  const m = startRe.exec(text);
  if (m == null) return "";
  const from = m.index + m[0].length;
  let end = text.length;
  for (const er of endRes) {
    const em = er.exec(text.slice(from));
    if (em?.index != null && em.index < end) end = em.index;
  }
  return text.slice(from, from + end);
}

/** MM.YYYY vai DD.MM.YYYY → displeja formāts; bez dienas → `01.MM.YYYY`. */
export function normalizeCarVerticalDateToken(raw: string): string {
  const t = raw.trim().replace(/\.$/, "");
  if (!t) return "";

  const ddmmyyyy = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const d = Number.parseInt(ddmmyyyy[1] ?? "", 10);
    const m = Number.parseInt(ddmmyyyy[2] ?? "", 10);
    const y = Number.parseInt(ddmmyyyy[3] ?? "", 10);
    if (m < 1 || m > 12 || y < 1980 || y > 2100) return "";
    if (d < 1 || d > 31) return "";
    return formatAutoRecordsDateForOutput(`${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`);
  }

  const mmyyyy = t.match(/^(\d{1,2})\.(\d{4})$/);
  if (mmyyyy) {
    const mo = Number.parseInt(mmyyyy[1] ?? "", 10);
    const y = Number.parseInt(mmyyyy[2] ?? "", 10);
    if (mo < 1 || mo > 12 || y < 1980 || y > 2100) return "";
    return formatAutoRecordsDateForOutput(`01.${String(mo).padStart(2, "0")}.${y}`);
  }

  return "";
}

function rowKey(date: string, odometer: string): string {
  return `${date}|${odometer}`;
}

const CV_ODOMETER_HEADER_RE = /^\s*Odometra\s+r[aā]d[īi]jumu\s+ieraksti\s*$/i;

/** Viena rinda: MM.YYYY. … km vai DD.MM.YYYY. … km (CarVertical iekopēts žurnāls). */
export function parseCarverticalOdometerLine(line: string): AutoRecordsServiceRow | null {
  const s = line.replace(/\u00a0/g, " ").trim().replace(/[;\s]+$/g, "");
  if (!s || CV_ODOMETER_HEADER_RE.test(s)) return null;

  const ddmmyyyy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*[-–—]?\s*([\d\s]+)\s*km\b/i);
  if (ddmmyyyy) {
    const token = `${ddmmyyyy[1]}.${ddmmyyyy[2]}.${ddmmyyyy[3]}`;
    const date = normalizeCarVerticalDateToken(token);
    const km = normalizeAutoRecordsOdometer(ddmmyyyy[4] ?? "");
    if (date && km) return { date, odometer: km, country: "" };
  }

  const mmyyyy = s.match(/^(\d{1,2})\.(\d{4})\.?\s*[-–—]?\s*([\d\s]+)\s*km\b/i);
  if (mmyyyy) {
    const date = normalizeCarVerticalDateToken(`${mmyyyy[1]}.${mmyyyy[2]}`);
    const km = normalizeAutoRecordsOdometer(mmyyyy[3] ?? "");
    if (date && km) return { date, odometer: km, country: "" };
  }

  return null;
}

function parseCarverticalOdometerLines(text: string): AutoRecordsServiceRow[] {
  const out: AutoRecordsServiceRow[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const row = parseCarverticalOdometerLine(line);
    if (!row) continue;
    const key = rowKey(row.date, row.odometer);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function pushOdometerRow(
  out: AutoRecordsServiceRow[],
  seen: Set<string>,
  dateRaw: string,
  kmRaw: string,
): void {
  const date = normalizeCarVerticalDateToken(dateRaw);
  const km = normalizeAutoRecordsOdometer(kmRaw);
  if (!date || !km) return;
  const key = rowKey(date, km);
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ date, odometer: km, country: "" });
}

/** Odometra ieraksti no normalizēta vai fragmentēta teksta. */
export function parseCarverticalOdometerFromText(text: string): AutoRecordsServiceRow[] {
  const norm = normalizeCarVerticalPdfText(text);

  const lineRows = parseCarverticalOdometerLines(norm);
  if (lineRows.length > 0) return sortAutoRecordsDescending(lineRows);

  const section =
    extractSection(norm, /Odometra\s+r[aā]d[īi]jumu\s+ieraksti/i, [
      /Brauk[sš]anas\s+parad/i,
      /Juridisk[aā]\s+statusa/i,
      /\+44/,
      /VIN\s+numurs/i,
    ]) || norm;

  const out: AutoRecordsServiceRow[] = [];
  const seen = new Set<string>();

  // Pilni datumi + km vienā rindā
  const fullDateRe =
    /(\d{1,2}\.\d{1,2}\.\d{4})\.?\s*[-–—]?\s*([\d\s\u00a0]+)\s*km\b/gi;
  let m: RegExpExecArray | null;
  while ((m = fullDateRe.exec(section)) !== null) {
    pushOdometerRow(out, seen, m[1] ?? "", m[2] ?? "");
  }

  const mmYyyyRe = /(\d{1,2}\.\d{4})\.?\s*[-–—]?\s*([\d\s\u00a0]+)\s*km\b/gi;
  while ((m = mmYyyyRe.exec(section)) !== null) {
    pushOdometerRow(out, seen, m[1] ?? "", m[2] ?? "");
  }

  return sortAutoRecordsDescending(out);
}

function cleanTimelineDescription(raw: string): string {
  const t = raw
    .replace(/\s+/g, " ")
    .replace(/"carVertical"\s+secinājumi:?[\s\S]*/gi, "")
    .replace(/carVertical\s+secinājumi:?[\s\S]*/gi, "")
    .trim();

  const titles = [
    "Reģistrēts citā valstī",
    "Fiksēts novērtējums",
    "Mainītas īpašumtiesības",
    "Veikta tehniskā apskate",
    "Noņemts no uzskaites",
    "Pirmā reģistrācija",
    "Reģistrēts",
    "Ražots",
  ].sort((a, b) => b.length - a.length);

  for (const title of titles) {
    if (t.toLowerCase().startsWith(title.toLowerCase())) return title;
  }

  for (const stop of [/\s+Šim\s+transportl/i, /\s+Šī\s+transportl/i, /\s+Šis\s+transportl/i]) {
    const idx = t.search(stop);
    if (idx > 0) return t.slice(0, idx).trim().replace(/[.:]+$/, "");
  }

  const firstClause = t.match(/^(.{2,64}?)\.\s+(?:Š|Taču|Spēkrats|Mēs)/i);
  if (firstClause?.[1]) return firstClause[1].trim();

  return t.length > 64 ? t.slice(0, 64).trim() : t;
}

const TIMELINE_COUNTRY_NAMES = [
  "Nezināma valsts",
  "Latvija",
  "Itālija",
  "Šveice",
  "Vācija",
  "Polija",
  "Lietuva",
  "Igaunija",
  "Francija",
  "Spānija",
  "Nīderlande",
  "Beļģija",
  "Austrija",
  "Čehija",
  "Slovākija",
  "Ungārija",
  "Rumānija",
  "Slovēnija",
  "Horvātija",
  "Kanāda",
];

function splitTimelineCountryAndDescription(rest: string): { country: string; description: string } {
  const trimmed = rest.trim();
  for (const name of TIMELINE_COUNTRY_NAMES.sort((a, b) => b.length - a.length)) {
    if (trimmed.toLowerCase().startsWith(name.toLowerCase())) {
      const tail = trimmed.slice(name.length).trim();
      const country =
        name.toLowerCase() === "nezināma valsts" ? "" : normalizeCountryNameLv(name) || name;
      return { country, description: tail };
    }
  }
  return { country: "", description: trimmed };
}

/** Transportlīdzekļa ierakstu laikposms — hronoloģiski ieraksti. */
export function parseCarverticalTimelineFromText(text: string): CarVerticalTimelineRow[] {
  const norm = normalizeCarVerticalPdfText(text);
  const section =
    extractSection(norm, /Transportl[\s\S]{0,40}?ierakstu\s+lai\s*kposms/i, [
      /\+44\s/,
      /Datu avoti/i,
      /Specifik[aā]cija/i,
      /Dro[sš][īi]ba/i,
      /Noder[īi]gi padomi/i,
    ]) || "";

  if (!section.trim()) return [];

  const fromLines = parseCarverticalTimelineFromLines(section);
  const fromChunks = parseCarverticalTimelineFromChunks(section);
  const merged = fromLines.length >= fromChunks.length ? fromLines : fromChunks;

  const seen = new Set<string>();
  const out: CarVerticalTimelineRow[] = [];
  for (const row of merged) {
    const key = `${row.date}|${row.country}|${row.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out.sort((a, b) => {
    const da = a.date.split(".").reverse().join("-");
    const db = b.date.split(".").reverse().join("-");
    return da.localeCompare(db);
  });
}

function parseCarverticalTimelineFromLines(section: string): CarVerticalTimelineRow[] {
  const lines = section
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: CarVerticalTimelineRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const inline = lines[i]!.match(/^(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.\s*(.*)$/);
    const solo = lines[i]!.match(/^(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.?$/);
    const dateRaw = inline?.[1] ?? solo?.[1];
    if (!dateRaw) {
      i++;
      continue;
    }
    const date = normalizeCarVerticalDateToken(dateRaw);
    i++;
    if (!date) continue;

    let rest = inline?.[2]?.trim() ?? "";
    if (!rest && i < lines.length && !/^\d{1,2}(?:\.\d{1,2})?\.\d{4}/.test(lines[i]!)) {
      rest = lines[i]!;
      i++;
    }

    const { country, description: descTail } = splitTimelineCountryAndDescription(rest);
    const descParts = [descTail];
    while (i < lines.length) {
      const next = lines[i]!;
      if (/^\d{1,2}(?:\.\d{1,2})?\.\d{4}/.test(next)) break;
      if (/^\+?\d+$/.test(next)) break;
      descParts.push(next);
      i++;
    }

    const description = cleanTimelineDescription(descParts.filter(Boolean).join(" "));
    if (!description) continue;
    out.push({ date, country, description });
  }
  return out;
}

function parseCarverticalTimelineFromChunks(section: string): CarVerticalTimelineRow[] {
  const flattened = section.replace(/\s+/g, " ").trim();
  const eventChunks = flattened
    .split(/(?=\d{1,2}(?:\.\d{1,2})?\.\d{4}\.?\s)/)
    .map((c) => c.trim())
    .filter(Boolean);

  const out: CarVerticalTimelineRow[] = [];
  for (const chunk of eventChunks) {
    const m = chunk.match(/^(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.?\s*(.*)$/);
    if (!m) continue;
    const date = normalizeCarVerticalDateToken(m[1] ?? "");
    if (!date) continue;

    const { country, description: descTail } = splitTimelineCountryAndDescription(m[2] ?? "");
    const description = cleanTimelineDescription(descTail);
    if (!description) continue;
    out.push({ date, country, description });
  }
  return out;
}

function parseDamageDate(raw: string): string {
  const t = raw.trim().replace(/\.$/, "");
  const mm = t.match(/^(\d{1,2})\.(\d{4})$/);
  if (mm) return normalizeCarVerticalDateToken(t);
  const ddmm = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmm) return normalizeCarVerticalDateToken(t);
  return normalizeCarVerticalDateToken(t);
}

function normalizeCarVerticalDamageText(text: string): string {
  let t = text;
  t = t.replace(/Priek\s+š\s+puse/gi, "Priekšpuse");
  t = t.replace(/iepriek\s+š/gi, "iepriekš");
  t = t.replace(/Dzesē\s+š\s+anas/gi, "Dzesēšanas");
  t = t.replace(/kondicionē\s+š\s+anas/gi, "kondicionēšanas");
  t = t.replace(/Š\s+veice/gi, "Šveice");
  t = t.replace(/deta\s+ļ\s+as/gi, "detaļas");
  return t;
}

function flattenDamageGroups(raw: string): string {
  return raw
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 2 && !/^\d+$/.test(l))
    .join("; ")
    .replace(/\s+(Ārējās|Ārējais|Virsbūves)/g, "; $1")
    .replace(/\s+/g, " ")
    .trim();
}

function pushDamageRecord(
  incidents: LtabIncidentRow[],
  damageDetails: CarVerticalDamageDetailRow[],
  row: CarVerticalDamageDetailRow,
): void {
  if (!row.lossAmount && !row.damagedSides && !row.damageGroups) return;
  const dup = damageDetails.some(
    (d) => d.date === row.date && d.lossAmount === row.lossAmount && d.country === row.country,
  );
  if (dup) return;
  if (row.lossAmount) incidents.push({ csngDate: row.date, lossAmount: row.lossAmount, incidentNo: row.country });
  damageDetails.push(row);
}

/** Bojājumu / novērtējumu ieraksti. */
export function parseCarverticalDamagesFromText(text: string): {
  incidents: LtabIncidentRow[];
  damageDetails: CarVerticalDamageDetailRow[];
} {
  const norm = normalizeCarVerticalDamageText(normalizeCarVerticalPdfText(text));

  const hasExplicitDamage =
    /Nov[eē]rt[eē]jums/i.test(norm) &&
    (/Aptuven[āa]\s+iepriek[sš]/i.test(norm) || /Boj[āa]t[āa]\s+puse/i.test(norm));

  if (
    /Nav atrasti boj[āa]jumu/i.test(norm) &&
    !/atrada[mā]?\s+\d+\s+ierakst/i.test(norm) &&
    !hasExplicitDamage
  ) {
    return { incidents: [], damageDetails: [] };
  }

  const incidents: LtabIncidentRow[] = [];
  const damageDetails: CarVerticalDamageDetailRow[] = [];

  // pdf.js / RAW: Novērtējums bloks (datums var būt pirms vai pēc)
  for (const m of norm.matchAll(/Nov[eē]rt[eē]jums/gi)) {
    const start = Math.max(0, (m.index ?? 0) - 200);
    const block = norm.slice(start, (m.index ?? 0) + 4000);
    if (!/Aptuven[āa]\s+iepriek[sš]/i.test(block)) continue;

    const lossM = block.match(
      /Aptuven[āa]\s+iepriek[sš]\s+g[ūu]t[oa]?\s+boj[āa]jumu\s+v[eē]rt[īi]ba\s*([\s\S]{0,100}?)(?:Boj[āa]jumu\s*grupas|\d{1,2}\.\d{4}|Dabas stih|$)/i,
    );
    const lossAmount = (lossM?.[1] ?? "").replace(/\s+/g, " ").trim();
    if (!lossAmount || !/\d/.test(lossAmount)) continue;

    const dateM = block.match(/(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.?\s+/);
    const date = dateM?.[1] ? parseDamageDate(dateM[1]) : "";
    const afterDate = dateM ? block.slice((dateM.index ?? 0) + dateM[0].length, (dateM.index ?? 0) + dateM[0].length + 80) : "";
    const { country } = splitTimelineCountryAndDescription(afterDate.trim());

    const sidesM = block.match(/Boj[āa]t[āa]\s+puse\s*([\s\S]{0,120}?)(?:Aptuven)/i);
    const damagedSides = (sidesM?.[1] ?? "").replace(/\s+/g, " ").replace(/\bA\b/g, "").trim();

    const groupsM = block.match(/Boj[āa]jumu\s*grupas\s*([\s\S]{0,800}?)(?:\d{1,2}(?:\.\d{1,2})?\.\d{4}|Dabas stih|Tirgus|$)/i);
    const damageGroups = flattenDamageGroups(groupsM?.[1] ?? "");

    pushDamageRecord(incidents, damageDetails, { date, country, lossAmount, damagedSides, damageGroups });
  }

  return { incidents, damageDetails };
}

function monthYearKey(date: string): string {
  const p = date.split(".");
  if (p.length !== 3) return date;
  return `${p[1]}.${p[2]}`;
}

/** Piešķir valsti odometra rindām pēc vēstures laikposma. */
export function inferOdometerCountriesFromTimeline(
  rows: AutoRecordsServiceRow[],
  timeline: CarVerticalTimelineRow[],
): AutoRecordsServiceRow[] {
  if (timeline.length === 0) return rows;

  const byMonthYear = new Map<string, string>();
  for (const ev of timeline) {
    if (!ev.country.trim()) continue;
    byMonthYear.set(monthYearKey(ev.date), ev.country.trim());
  }

  return rows.map((r) => {
    if (r.country.trim()) {
      return { ...r, country: sanitizeMileageCountryField(r.country) };
    }
    const c = byMonthYear.get(monthYearKey(r.date));
    return c ? { ...r, country: sanitizeMileageCountryField(c) } : r;
  });
}

/** Pilna CarVertical RAW / PDF teksta parsēšana. */
export function parseCarverticalPdfText(raw: string): CarVerticalParseResult {
  const norm = normalizeCarVerticalPdfText(raw);
  let serviceHistory = parseCarverticalOdometerFromText(norm);
  const timeline = parseCarverticalTimelineFromText(norm);
  serviceHistory = inferOdometerCountriesFromTimeline(serviceHistory, timeline);
  const { incidents, damageDetails } = parseCarverticalDamagesFromText(norm);

  return {
    serviceHistory: serviceHistory.map((r) => ({
      date: formatAutoRecordsDateForOutput(r.date),
      odometer: normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
      country: sanitizeMileageCountryField(
        r.country.trim() === CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL ? "" : r.country.trim(),
      ),
    })),
    timeline,
    incidents,
    damageDetails,
  };
}
