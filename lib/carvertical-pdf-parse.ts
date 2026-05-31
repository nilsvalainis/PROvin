/**
 * CarVertical PDF / iekopēts RAW — odometrs, vēstures laikposms, bojājumi.
 * Atbalsta fragmentētu PDF tekstu (vārdi un datumi sadalīti pa rindām).
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
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

/** MM.YYYY vai DD.MM.YYYY → displeja formāts ar 00. prefiksu, ja trūkst dienas/mēneša. */
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
    return formatAutoRecordsDateForOutput(`00.${String(mo).padStart(2, "0")}.${y}`);
  }

  return "";
}

function parseMmYyyyFromParts(monthOrDay: string, yearDigits: string): string {
  const head = Number.parseInt(monthOrDay, 10);
  const year = Number.parseInt(yearDigits, 10);
  if (head < 1 || head > 12 || year < 1980 || year > 2100) return "";
  return formatAutoRecordsDateForOutput(`00.${String(head).padStart(2, "0")}.${year}`);
}

function rowKey(date: string, odometer: string): string {
  return `${date}|${odometer}`;
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
  return raw
    .replace(/\s+/g, " ")
    .replace(/"carVertical"\s+secinājumi:?/gi, "")
    .replace(/carVertical\s+secinājumi:?/gi, "")
    .trim()
    .slice(0, 400);
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
    extractSection(norm, /Transportl[īi]dzekļa\s+ierakstu\s+lai\s*kposms/i, [
      /\+44\s/,
      /Datu avoti/i,
      /Specifik[aā]cija/i,
      /Dro[sš][īi]ba/i,
      /Noder[īi]gi padomi/i,
    ]) || "";

  if (!section.trim()) return [];

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

  return out.sort((a, b) => {
    const da = a.date.split(".").reverse().join("-");
    const db = b.date.split(".").reverse().join("-");
    return da.localeCompare(db);
  });
}

function parseDamageDate(raw: string): string {
  const t = raw.trim().replace(/\.$/, "");
  const mm = t.match(/^(\d{1,2})\.(\d{4})$/);
  if (mm) return normalizeCarVerticalDateToken(t);
  const ddmm = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmm) return normalizeCarVerticalDateToken(t);
  return normalizeCarVerticalDateToken(t);
}

/** Bojājumu / novērtējumu ieraksti. */
export function parseCarverticalDamagesFromText(text: string): {
  incidents: LtabIncidentRow[];
  damageDetails: CarVerticalDamageDetailRow[];
} {
  const norm = normalizeCarVerticalPdfText(text);
  const section =
    extractSection(norm, /Boj[āa]jumi[\s\S]{0,80}?Vai\s+transportl/i, [
      /Dabas stih/i,
      /Tirgus v[eē]rt/i,
      /Emisijas/i,
      /Specifik[aā]cija/i,
    ]) || extractSection(norm, /Nov[eē]rt[eē]jums/i, [/Dabas stih/i, /Tirgus v[eē]rt/i]) || "";

  if (!section.trim()) return { incidents: [], damageDetails: [] };
  if (
    /Nav atrasti boj[āa]jumu|Nav konstat[eē]tas probl[eē]mas/i.test(section) &&
    !/Nov[eē]rt[eē]jums/i.test(section) &&
    !/atrada[mā]?[\s\S]{0,60}\d+\s+ierakst/i.test(section)
  ) {
    return { incidents: [], damageDetails: [] };
  }

  const incidents: LtabIncidentRow[] = [];
  const damageDetails: CarVerticalDamageDetailRow[] = [];

  const blockRe =
    /(\d{1,2}(?:\.\d{1,2})?\.\d{4})\.?\s+([A-Za-zĀČĒĢĪĪĶĻŅŠŪŽāčēģīķļņšūž]+)[\s\S]{0,1200}?(?=Dabas stih|Tirgus v|Specifik|$)/gi;
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(norm)) !== null) {
    const chunk = bm[0] ?? "";
    if (!/Nov[eē]rt[eē]jums|Aptuven[āa]\s+iepriek[sš]\s+g[ūu]t/i.test(chunk)) continue;
    if (!/5001|10\s*000|boj[āa]jumu\s+v[eē]rt/i.test(chunk) && !/Boj[āa]t[āa]\s+puse/i.test(chunk)) continue;

    const date = parseDamageDate(bm[1] ?? "");
    const country = normalizeCountryNameLv((bm[2] ?? "").trim()) || (bm[2] ?? "").trim();
    if (!date) continue;

    const lossM = chunk.match(/Aptuven[āa]\s+iepriek[sš]\s+g[ūu]t[oa]\s+boj[āa]jumu\s+v[eē]rt[īi]ba\s*([\s\S]{0,120}?)(?:Boj[āa]jumu|Dabas|$)/i);
    const lossAmount = (lossM?.[1] ?? "").replace(/\s+/g, " ").trim();

    const sidesM = chunk.match(/Boj[āa]t[āa]\s+puse\s*([\s\S]{0,100}?)(?:Aptuven|Boj[āa]jumu|$)/i);
    const damagedSides = (sidesM?.[1] ?? "").replace(/\s+/g, " ").replace(/\bA\b/g, "").trim();

    const groupsM = chunk.match(/Boj[āa]jumu\s*grupas\s*([\s\S]{0,600}?)(?:\n\s*\d+\s*$|Dabas stih|M[eē]s sal|$)/i);
    const damageGroups = (groupsM?.[1] ?? "")
      .split(/\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l.length > 2 && !/^\d+$/.test(l))
      .join("; ")
      .trim();

    if (!lossAmount && !damagedSides && !damageGroups) continue;

    if (lossAmount) incidents.push({ csngDate: date, lossAmount, incidentNo: country });
    damageDetails.push({ date, country, lossAmount, damagedSides, damageGroups });
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
    if (r.country.trim()) return r;
    const c = byMonthYear.get(monthYearKey(r.date));
    return c ? { ...r, country: c } : r;
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
      country: r.country.trim() === CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL ? "" : r.country.trim(),
    })),
    timeline,
    incidents,
    damageDetails,
  };
}
