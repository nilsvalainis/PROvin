/**
 * car.info — kopīgs parseris Playwright DOM izvilkumam un operatora iekopētajam lapas tekstam.
 * Bez server-only, lai admin pārlūks varētu aizpildīt tabulas pēc RAW ielīmēšanas.
 */
import { detectSpecialUseLabels } from "@/lib/vin-sources/translate-lv";
import type { VinSourceMileageRow } from "@/lib/vin-sources/types";

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
  ownersSummary: string;
  statusRecords: string;
  notes: string[];
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

function mileageFromCells(cells: string[], origin: string): VinSourceMileageRow | null {
  const date = cells.map(normalizeDate).find(Boolean) ?? "";
  const km = cells.map(parseKm).find(Boolean) ?? "";
  if (!date || !km) return null;
  return {
    date,
    odometer: km,
    country: detectCountry(cells),
    origin: origin || "car.info",
  };
}

function mileageFromLine(line: string): VinSourceMileageRow | null {
  const date = normalizeDate(line);
  const km = parseKm(line);
  if (!date || !km) return null;
  return {
    date,
    odometer: km,
    country: detectCountry([line]),
    origin: "car.info",
  };
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
  const asc = [...mileage].sort((a, b) => a.date.localeCompare(b.date));
  let peak = -1;
  for (const row of asc) {
    const km = Number(row.odometer);
    if (peak > 0 && km < peak - 1000) {
      notes.push(`⚠ Odometra pretruna: ${peak.toLocaleString("lv-LV")} km → ${km.toLocaleString("lv-LV")} km (${row.date})`);
    }
    if (km > peak) peak = km;
  }
  const countries = [...new Set(mileage.map((m) => m.country).filter(Boolean))];
  if (countries.length > 1) notes.push(`Dati no vairākām valstīm: ${countries.join(", ")}`);
  return notes;
}

export function parseCarinfoExtract(loaded: CarinfoPageExtract): CarinfoParsed {
  const mileage: VinSourceMileageRow[] = [];
  for (const table of loaded.tables) {
    const origin = table.headers.filter(Boolean).join(" ") || "car.info";
    for (const cells of table.rows) {
      const row = mileageFromCells(cells, origin);
      if (row) mileage.push(row);
    }
  }
  for (const line of loaded.text.split(/\n+/)) {
    const row = mileageFromLine(line.trim());
    if (row) mileage.push(row);
  }

  const uniqueMileage = dedupeMileage(mileage);

  const ownerLines = loaded.pairs
    .filter((p) => /owner|ägare|besitzer|registration|registered|first reg|īpašniek/i.test(p.label))
    .slice(0, 20)
    .map((p) => `${p.label}: ${p.value}`);

  const specialUse = detectSpecialUseLabels(loaded.text);
  const statusLines = loaded.pairs
    .filter((p) => /status|usage|use|taxi|leasing|inspection|izmantošan/i.test(p.label))
    .slice(0, 20)
    .map((p) => `${p.label}: ${p.value}`);
  if (specialUse.length > 0) statusLines.push(`Īpašie statusi: ${specialUse.join(", ")}`);

  const notes = [...specialUse.map((label) => `⚠ Īpašs izmantošanas statuss: ${label}`), ...odometerNotes(uniqueMileage)];
  const found = uniqueMileage.length > 0 || ownerLines.length > 0 || statusLines.length > 0;

  return {
    found,
    mileage: uniqueMileage,
    ownersSummary: ownerLines.join("\n"),
    statusRecords: statusLines.join("\n"),
    notes,
  };
}

/** Operatora iekopētais car.info lapas teksts (Cmd+A / Cmd+C). */
export function parseCarinfoPastedText(raw: string): CarinfoParsed {
  const text = raw.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
  if (!text) {
    return { found: false, mileage: [], ownersSummary: "", statusRecords: "", notes: [] };
  }
  return parseCarinfoExtract({ text, tables: [], pairs: [] });
}
