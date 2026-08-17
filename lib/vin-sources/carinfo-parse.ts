/**
 * car.info — kopīgs parseris Playwright DOM izvilkumam un operatora iekopētajam lapas tekstam.
 * Bez server-only, lai admin pārlūks varētu aizpildīt tabulas pēc RAW ielīmēšanas.
 *
 * car.info header meklēšanas rezultāts bieži ir „salīmēts” teksts bez koliem
 * (`Mileage298,540 km`, `Number of Owners6`) un nobraukuma vēsture trīs rindiņās
 * (notikums / km / datums).
 */
import { detectSpecialUseLabels } from "@/lib/vin-sources/translate-lv";
import type { VinSourceIncidentRow, VinSourceMileageRow } from "@/lib/vin-sources/types";
import { formatRegistryDateLv } from "@/lib/vin-registry-client-text";

const COUNTRY_BY_CODE: Record<string, string> = {
  se: "Zviedrija",
  sweden: "Zviedrija",
  sverige: "Zviedrija",
  dk: "Dānija",
  denmark: "Dānija",
  danmark: "Dānija",
  no: "Norvēģija",
  norway: "Norvēģija",
  norge: "Norvēģija",
  fi: "Somija",
  finland: "Somija",
  suomi: "Somija",
  de: "Vācija",
  germany: "Vācija",
  deutschland: "Vācija",
  nl: "Nīderlande",
  ee: "Igaunija",
  estonia: "Igaunija",
  lt: "Lietuva",
  lithuania: "Lietuva",
  pl: "Polija",
  poland: "Polija",
  lv: "Latvija",
  latvia: "Latvija",
};

export type CarinfoPageExtract = {
  text: string;
  tables: { headers: string[]; rows: string[][] }[];
  pairs: { label: string; value: string }[];
};

export type CarinfoParsed = {
  found: boolean;
  mileage: VinSourceMileageRow[];
  incidents: VinSourceIncidentRow[];
  ownersSummary: string;
  statusRecords: string;
  notes: string[];
};

const MILEAGE_EVENT =
  /^(subsequent inspection|periodic inspection|registration(?: inspection)?|inspection|odometer reading|reported odometer|kontrollbesiktning|besiktning)$/i;

const YES_NO: Record<string, string> = {
  yes: "jā",
  no: "nē",
  ja: "jā",
  nej: "nē",
};

function detectCountry(cells: string[]): string {
  for (const cell of cells) {
    const key = cell.trim().toLowerCase();
    if (COUNTRY_BY_CODE[key]) return COUNTRY_BY_CODE[key]!;
    for (const [code, label] of Object.entries(COUNTRY_BY_CODE)) {
      if (key.includes(code) && code.length > 2) return label;
    }
  }
  return "";
}

function inferPageCountry(text: string): string {
  if (/transportstyrelsen|en\s*\/\s*se\b|car\.info sweden|from sweden|sverige/i.test(text)) {
    return "Zviedrija";
  }
  if (/en\s*\/\s*dk\b|car\.info denmark|danmark/i.test(text)) return "Dānija";
  if (/en\s*\/\s*no\b|car\.info norway|norge/i.test(text)) return "Norvēģija";
  if (/en\s*\/\s*de\b|car\.info germany|deutschland/i.test(text)) return "Vācija";
  return detectCountry([text]);
}

function normalizeDate(cell: string): string {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(cell);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dot = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(cell);
  if (dot) return `${dot[3]}-${dot[2]!.padStart(2, "0")}-${dot[1]!.padStart(2, "0")}`;
  const monthYear = /^(\d{4})-(\d{2})$/.exec(cell.trim());
  if (monthYear) return `${monthYear[1]}-${monthYear[2]}-01`;
  return "";
}

function parseKm(cell: string): string {
  const stripped = cell
    .replace(/\u00a0/g, " ")
    .replace(/\d{4}-\d{2}(?:-\d{2})?/g, " ")
    .replace(/\d{1,2}[./]\d{1,2}[./]\d{4}/g, " ");
  const m = /(\d{1,3}(?:[\s.,]\d{3})+|\d{3,7})\s*(?:km|mil)\b/i.exec(stripped);
  if (!m) return "";
  const digits = m[1]!.replace(/[^\d]/g, "");
  if (digits.length < 3 || digits.length > 7) return "";
  return String(Number(digits));
}

function looksLikeCurrentMileageLabel(line: string): boolean {
  return /mileage|odometer|miltal|km.?stand|nobraukum|läbisõit/i.test(line);
}

function mileageFromCells(cells: string[], origin: string): VinSourceMileageRow | null {
  const joined = cells.join(" ");
  const date = cells.map(normalizeDate).find(Boolean) ?? "";
  const km = cells.map(parseKm).find(Boolean) ?? "";
  if (!km) return null;
  if (!date && !looksLikeCurrentMileageLabel(joined)) return null;
  return {
    date,
    odometer: km,
    country: detectCountry(cells),
    origin: date ? origin || "car.info" : "car.info (aktuālais)",
  };
}

function mileageFromLine(line: string): VinSourceMileageRow | null {
  const date = normalizeDate(line);
  const km = parseKm(line);
  if (!km) return null;
  if (!date && !looksLikeCurrentMileageLabel(line)) return null;
  return {
    date,
    odometer: km,
    country: detectCountry([line]),
    origin: date ? "car.info" : "car.info (aktuālais)",
  };
}

function pairsFromText(text: string): { label: string; value: string }[] {
  const pairs: { label: string; value: string }[] = [];
  for (const line of text.split(/\n+/)) {
    const m = /^(.{2,60}?)\s*[:–-]\s*(.+)$/.exec(line.trim());
    if (!m) continue;
    const label = m[1]!.trim();
    const value = m[2]!.trim();
    if (label && value && value.length < 220) pairs.push({ label, value });
  }
  return pairs;
}

function gluedSimple(text: string, label: string, valueRe: RegExp): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*[:–-]?\\s*(${valueRe.source})`, "i");
  const m = re.exec(text);
  return m?.[1]?.trim() ?? "";
}

function formatKmLv(km: string): string {
  const n = Number(km);
  if (!Number.isFinite(n)) return km;
  return n.toLocaleString("lv-LV");
}

function yesNoLv(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (YES_NO[key]) return YES_NO[key]!;
  if (/^log in|^become a professional|^restricted|^-$/i.test(raw.trim())) return "";
  return raw.trim();
}

function colourLv(raw: string): string {
  const key = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    black: "melna",
    white: "balta",
    grey: "pelēka",
    gray: "pelēka",
    silver: "sudraba",
    blue: "zila",
    red: "sarkana",
    brown: "brūna",
    green: "zaļa",
    orange: "oranža",
    yellow: "dzeltena",
    beige: "bēša",
  };
  return map[key] ?? raw.trim().toLowerCase();
}

function finishLv(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (key === "metallic") return "metālika";
  if (key === "solid") return "vienkrāsaina";
  if (key === "pearl") return "pērļu";
  if (key === "matt" || key === "matte") return "matēta";
  return raw.trim().toLowerCase();
}

function engineLv(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\bDiesel\b/gi, "dīzelis")
    .replace(/\bPetrol\b/gi, "benzīns")
    .replace(/\bGasoline\b/gi, "benzīns")
    .replace(/\bElectric\b/gi, "elektrisks")
    .replace(/\bHybrid\b/gi, "hibrīds")
    .replace(/\((\d+)\s*hp\)/gi, "$1 ZS")
    .replace(/\bhp\b/gi, "ZS")
    .trim();
}

function transmissionLv(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  if (/automatic/i.test(s) && /dual-?clutch|s\s*tronic|dsg/i.test(s)) {
    const gears = /(\d+)\s*-?\s*speed/i.exec(s)?.[1];
    return gears ? `automātiskā, ${gears} pakāpju, dubultsajūgs` : "automātiskā, dubultsajūgs";
  }
  if (/automatic/i.test(s)) return "automātiskā";
  if (/manual/i.test(s)) return "mehāniskā";
  return s;
}

function originFromEvent(event: string): string {
  const t = event.trim();
  if (!t) return "car.info";
  if (/subsequent inspection/i.test(t)) return "car.info, atkārtota apskate";
  if (/inspection/i.test(t)) return "car.info, apskate";
  return "car.info";
}

function sliceSection(text: string, start: RegExp, end: RegExp): string {
  const m = start.exec(text);
  if (!m || m.index == null) return "";
  const rest = text.slice(m.index);
  end.lastIndex = 0;
  const stop = end.exec(rest.slice(m[0].length));
  if (!stop || stop.index == null) return rest;
  return rest.slice(0, m[0].length + stop.index);
}

function parseMileageHistoryBlocks(text: string, country: string): VinSourceMileageRow[] {
  const rows: VinSourceMileageRow[] = [];
  const glued = new RegExp(
    `(subsequent inspection|periodic inspection|registration(?: inspection)?|inspection)\\s*(\\d[\\d\\s.,]{2,})\\s*km\\s*(\\d{4}-\\d{2}-\\d{2})`,
    "gi",
  );
  for (const m of text.matchAll(glued)) {
    const km = parseKm(`${m[2]} km`);
    const date = normalizeDate(m[3] ?? "");
    if (!km || !date) continue;
    rows.push({
      date,
      odometer: km,
      country,
      origin: originFromEvent(m[1] ?? ""),
    });
  }

  const lines = text.split(/\n/).map((l) => l.replace(/\u00a0/g, " ").trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    const kmHere = parseKm(lines[i]!);
    const dateHere = normalizeDate(lines[i]!);
    const prev = lines[i - 1] ?? "";
    const next = lines[i + 1] ?? "";
    if (kmHere && normalizeDate(next) && MILEAGE_EVENT.test(prev)) {
      rows.push({
        date: normalizeDate(next),
        odometer: kmHere,
        country,
        origin: originFromEvent(prev),
      });
      continue;
    }
    if (dateHere && parseKm(next) && MILEAGE_EVENT.test(prev)) {
      rows.push({
        date: dateHere,
        odometer: parseKm(next),
        country,
        origin: originFromEvent(prev),
      });
    }
  }
  return rows;
}

function parseOwnerChangeEvents(text: string): string[] {
  const lines: string[] = [];
  const rawLines = text.split(/\n/).map((l) => l.trim());
  for (let i = 0; i < rawLines.length; i += 1) {
    if (!/^(change of owner|ägarebyte)$/i.test(rawLines[i]!)) continue;
    const date = normalizeDate(rawLines[i - 1] ?? "") || normalizeDate(rawLines[i - 2] ?? "");
    const who = (rawLines[i + 1] ?? "").replace(/\s+/g, " ").trim();
    if (!who || isJunkOwnerName(who)) continue;
    const line = date
      ? `${formatRegistryDateLv(date)} īpašnieka maiņa: ${who}`
      : `Īpašnieka maiņa: ${who}`;
    if (!lines.some((l) => l.includes(who))) lines.push(line);
  }
  return lines;
}

function isJunkOwnerName(who: string): boolean {
  return /company information|log in|in traffic|inspections was last updated|transportstyrelsen|next update/i.test(
    who,
  );
}

function parseExportEvents(text: string): { date: string; country: string; line: string }[] {
  const out: { date: string; country: string; line: string }[] = [];
  const glued = /(?:vehicle exported(?: from ([A-Za-zÅÄÖåäö]+))?|previously been exported)[^\n]{0,40}/gi;
  for (const m of text.matchAll(glued)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 48), m.index ?? 0);
    const date = normalizeDate(before);
    const from = m[1] || (/sweden|sverige/i.test(m[0] + text.slice(m.index ?? 0, (m.index ?? 0) + 40)) ? "Sweden" : "");
    const country = detectCountry([from]) || inferPageCountry(text);
    const line = date
      ? `${formatRegistryDateLv(date)} eksportēts${country ? ` no ${country}` : ""}`
      : `Eksportēts${country ? ` no ${country}` : ""}`;
    if (!out.some((x) => x.line === line)) out.push({ date, country, line });
  }

  const rawLines = text.split(/\n/).map((l) => l.trim());
  for (let i = 0; i < rawLines.length; i += 1) {
    if (!/^vehicle exported$/i.test(rawLines[i]!)) continue;
    const date = normalizeDate(rawLines[i - 1] ?? "");
    const fromLine = rawLines[i + 1] ?? "";
    const from = /from\s+([A-Za-zÅÄÖåäö]+)/i.exec(fromLine)?.[1] ?? "";
    const country = detectCountry([from]) || inferPageCountry(text);
    const line = date
      ? `${formatRegistryDateLv(date)} eksportēts${country ? ` no ${country}` : ""}`
      : `Eksportēts${country ? ` no ${country}` : ""}`;
    if (!out.some((x) => x.line === line)) out.push({ date, country, line });
  }
  return out;
}

function parseClassifiedZeroKm(text: string): { date: string; price: string } | null {
  const m =
    /(\d{4}-\d{2}-\d{2})[\s\S]{0,180}?(\d{1,3}(?:[.,\s]\d{3})*)\s*EUR\s*\/\s*0\s*km/i.exec(text) ||
    /(\d{1,3}(?:[.,\s]\d{3})*)\s*EUR\s*\/\s*0\s*km/i.exec(text);
  if (!m) return null;
  const date = normalizeDate(m[1] ?? "") || normalizeDate(text.slice(Math.max(0, (m.index ?? 0) - 80), m.index));
  const price = (m[2] ?? m[1] ?? "").replace(/\s+/g, " ").trim();
  if (!/eur/i.test(m[0]) && !m[2]) return { date, price };
  const euro = /\d/.test(price) && /EUR/i.test(m[0]) ? `${price.replace(/[^\d]/g, "")} EUR` : price;
  return { date, price: euro.includes("EUR") ? euro : `${price} EUR` };
}

function buildRedFlags(opts: {
  text: string;
  owners: number | null;
  mileage: VinSourceMileageRow[];
  exports: { date: string; country: string; line: string }[];
  classified: { date: string; price: string } | null;
  stolen: string;
}): string[] {
  const notes: string[] = [];
  if (opts.exports.length > 0 || /previously been exported/i.test(opts.text)) {
    const first = opts.exports[0];
    const when = first?.date ? ` (${formatRegistryDateLv(first.date)})` : "";
    const from = first?.country ? ` no ${first.country}` : "";
    notes.push(`Eksportēts${from}${when}.`);
  }
  if (opts.classified) {
    const peak = [...opts.mileage].map((r) => Number(r.odometer)).filter((n) => Number.isFinite(n)).sort((a, b) => b - a)[0];
    const peakTxt = peak ? `${formatKmLv(String(peak))} km` : "";
    const when = opts.classified.date ? ` ${formatRegistryDateLv(opts.classified.date)}` : "";
    notes.push(
      `Sludinājumā${when} norādīts 0 km (${opts.classified.price})${peakTxt ? `; reģistrā ${peakTxt}` : ""}.`,
    );
  }
  if (opts.owners != null && opts.owners >= 5) {
    notes.push(`${opts.owners} īpašnieki.`);
  }
  if (/^yes|ja|stulen|stolen$/i.test(opts.stolen.trim())) {
    notes.push("Reģistrā atzīmēts kā zagts.");
  }
  return notes;
}

function dedupeMileage(rows: VinSourceMileageRow[]): VinSourceMileageRow[] {
  const seen = new Set<string>();
  const out: VinSourceMileageRow[] = [];
  for (const row of rows) {
    const key = `${row.date}|${row.odometer}|${row.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}

function odometerNotes(mileage: VinSourceMileageRow[]): string[] {
  const notes: string[] = [];
  const dated = mileage.filter((r) => r.date);
  const asc = [...dated].sort((a, b) => a.date.localeCompare(b.date));
  let peak = -1;
  for (const row of asc) {
    const km = Number(row.odometer);
    if (peak > 0 && km < peak - 1000) {
      notes.push(
        `Odometra pretruna: ${peak.toLocaleString("lv-LV")} km, pēc tam ${km.toLocaleString("lv-LV")} km (${formatRegistryDateLv(row.date)}).`,
      );
    }
    if (km > peak) peak = km;
  }
  const countries = [...new Set(mileage.map((m) => m.country).filter(Boolean))];
  if (countries.length > 1) notes.push(`Dati no vairākām valstīm: ${countries.join(", ")}`);
  return notes;
}

function fillCountry(rows: VinSourceMileageRow[], country: string): VinSourceMileageRow[] {
  if (!country) return rows;
  return rows.map((r) => (r.country ? r : { ...r, country }));
}

export function parseCarinfoExtract(loaded: CarinfoPageExtract): CarinfoParsed {
  const text = loaded.text.replace(/\u00a0/g, " ");
  const pageCountry = inferPageCountry(text);
  const pairs = [...loaded.pairs, ...pairsFromText(text)];
  const mileage: VinSourceMileageRow[] = [];
  for (const table of loaded.tables) {
    const origin = table.headers.filter(Boolean).join(" ") || "car.info";
    for (const cells of table.rows) {
      const row = mileageFromCells(cells, origin);
      if (row) mileage.push(row);
    }
  }
  for (const line of text.split(/\n+/)) {
    const row = mileageFromLine(line.trim());
    if (row) mileage.push(row);
  }
  const historySlice = sliceSection(text, /mileage history|reported odometer readings/i, /vehicle history|active classifieds|collapse history/i);
  mileage.push(...parseMileageHistoryBlocks(historySlice || text, pageCountry));

  const uniqueMileage = fillCountry(dedupeMileage(mileage), pageCountry);

  const ownersCountRaw =
    gluedSimple(text, "Number of Owners", /\d{1,2}/) ||
    pairs.find((p) => /number of owners|ägare|īpašniek/i.test(p.label))?.value ||
    "";
  const ownersCount = /(\d{1,2})/.exec(ownersCountRaw)?.[1] ?? "";
  const ownerEvents = parseOwnerChangeEvents(text);
  const ownerLines = [
    ownersCount ? `${ownersCount} īpašnieki` : "",
    ...ownerEvents,
  ].filter(Boolean);

  const inTraffic = gluedSimple(text, "In Traffic", /Yes|No|Ja|Nej/i);
  const domestic = gluedSimple(text, "Domestic", /Yes|No|Ja|Nej/i);
  const colour = gluedSimple(text, "Colour", /[A-Za-zÅÄÖåäö]+/) || gluedSimple(text, "Color", /[A-Za-z]+/);
  const colourFinish = gluedSimple(text, "Finish", /Metallic|Solid|Pearl|Matt/i);
  const stolen = gluedSimple(text, "Reported stolen", /Yes|No|Ja|Nej|-|Log in/i);
  const engine = gluedSimple(text, "Engine", /(?:Diesel|Petrol|Gasoline|Electric|Hybrid)[^\n]{0,48}/i);
  const engineCode = gluedSimple(text, "Engine Code", /[A-Z0-9]{3,8}/);
  const transmission = gluedSimple(text, "Transmission", /Automatic[^\n]{0,48}|Manual[^\n]{0,24}/i);
  const drivetrain = gluedSimple(text, "Drivetrain", /AWD|FWD|RWD|4WD|Quattro/i);
  const exports = parseExportEvents(text);
  const classified = parseClassifiedZeroKm(text);

  const specialUse = detectSpecialUseLabels(text);
  const inTrafficLv = yesNoLv(inTraffic);
  const domesticLv = yesNoLv(domestic);
  const stolenLv = stolen && stolen !== "-" ? yesNoLv(stolen) : "";
  const colourLine = colour
    ? `Krāsa: ${colourLv(colour)}${colourFinish ? `, ${finishLv(colourFinish)}` : ""}`
    : "";
  const engineLine = engine
    ? `Dzinējs: ${engineLv(engine)}${engineCode ? `, kods ${engineCode}` : ""}`
    : "";
  const statusLines = [
    inTrafficLv ? `Satiksmē: ${inTrafficLv}` : "",
    domesticLv ? `Iekšzemes${pageCountry ? ` (${pageCountry})` : ""}: ${domesticLv}` : "",
    colourLine,
    stolenLv ? `Zagts: ${stolenLv}` : "",
    engineLine,
    transmission ? `Ātrumkārba: ${transmissionLv(transmission)}` : "",
    drivetrain ? `Piedziņa: ${drivetrain}` : "",
    specialUse.length > 0 ? `Īpašais statuss: ${specialUse.join(", ")}` : "",
  ].filter(Boolean);

  const notes = [
    ...buildRedFlags({
      text,
      owners: ownersCount ? Number(ownersCount) : null,
      mileage: uniqueMileage,
      exports,
      classified,
      stolen,
    }),
    ...specialUse.map((label) => `Īpašais statuss: ${label}.`),
    ...odometerNotes(uniqueMileage),
  ];

  const found =
    uniqueMileage.length > 0 ||
    ownerLines.length > 0 ||
    statusLines.length > 0 ||
    notes.length > 0;

  return {
    found,
    mileage: uniqueMileage,
    incidents: [],
    ownersSummary: uniqueLines(ownerLines).join("\n"),
    statusRecords: uniqueLines(statusLines).join("\n"),
    notes: uniqueLines(notes),
  };
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line.trim());
  }
  return out;
}

export function looksLikeCarinfoDump(raw: string): boolean {
  const t = raw.replace(/\u00a0/g, " ");
  if (t.length < 80) return false;
  if (/car\.info/i.test(t) && /vehicle info|mileage history/i.test(t)) return true;
  if (/mileage history/i.test(t) && /in traffic/i.test(t) && /number of owners/i.test(t)) return true;
  return false;
}

/** Operatora iekopētais car.info lapas teksts (Cmd+A / Cmd+C). */
export function parseCarinfoPastedText(raw: string): CarinfoParsed {
  const text = raw.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
  if (!text) {
    return { found: false, mileage: [], incidents: [], ownersSummary: "", statusRecords: "", notes: [] };
  }
  return parseCarinfoExtract({ text, tables: [], pairs: [] });
}
