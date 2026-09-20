import { capitalizeRegistryEvent } from "@/lib/vin-sources/translate-lv";
import type { VinSourceFetchResult, VinSourceIncidentRow, VinSourceMileageRow } from "@/lib/vin-sources/types";

function mergeMileage(a: VinSourceMileageRow[], b: VinSourceMileageRow[]): VinSourceMileageRow[] {
  const out: VinSourceMileageRow[] = [];
  const keyOf = (r: VinSourceMileageRow) => `${r.date}|${r.odometer}`;
  const seen = new Set<string>();
  for (const row of [...a, ...b]) {
    if (!row.date && !row.odometer) continue;
    const key = keyOf(row);
    if (seen.has(key)) {
      const existing = out.find((x) => keyOf(x) === key);
      if (existing && row.origin && !existing.origin?.includes(row.origin)) {
        existing.origin = [existing.origin, row.origin].filter(Boolean).join("; ");
      }
      continue;
    }
    seen.add(key);
    out.push({ ...row });
  }
  return out.sort((x, y) => y.date.localeCompare(x.date));
}

function mergeIncidents(a: VinSourceIncidentRow[], b: VinSourceIncidentRow[]): VinSourceIncidentRow[] {
  const seen = new Set<string>();
  const out: VinSourceIncidentRow[] = [];
  for (const row of [...a, ...b]) {
    const key = `${row.date}|${row.amount}|${row.note ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function mergeTimeline(
  a: VinSourceFetchResult["timeline"],
  b: VinSourceFetchResult["timeline"],
): VinSourceFetchResult["timeline"] {
  const seen = new Set<string>();
  const out: VinSourceFetchResult["timeline"] = [];
  for (const row of [...a, ...b]) {
    const event = capitalizeRegistryEvent(row.event);
    const key = `${row.date}|${event}|${row.odometer ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...row, event });
  }
  return out.sort((x, y) => y.date.localeCompare(x.date));
}

function firstMeaningfulLine(text: string): string {
  return text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
}

/** Īpašnieku lauks: viena skaita rinda; atšķirīgs nummerplade skaits paliek otrajā rindā. */
function mergeOwnersSummary(primary: string, extra: string): string {
  const a = firstMeaningfulLine(primary);
  const b = firstMeaningfulLine(extra);
  if (!b) return a;
  if (!a) return b;
  if (a === b || a.includes(b) || b.includes(a)) return a;
  return `${a}\n${b}`;
}

const FACT_KEY_ORDER = [
  "izmantošanas veids",
  "degviela",
  "jauda / piedziņa",
  "euronorma",
  "dpf",
  "ātrumkārba",
  "līzings",
  "reģistrācijas statuss",
  "sekundārais statuss",
  "stāvoklis pēc importa",
  "pēdējā apskate",
  "nākamā apskate (dk)",
  "pašreizējā octa",
  "īpašie statusi",
];

function parseFactLine(line: string): { key: string; raw: string } | null {
  const raw = line.trim();
  if (!raw) return null;
  const m = raw.match(/^([^:]{2,48}):\s*(.+)$/);
  if (m) return { key: m[1]!.trim().toLocaleLowerCase("lv"), raw };
  return { key: raw.toLocaleLowerCase("lv"), raw };
}

/** Faktu karte: tjekbil pārraksta kopīgās atslēgas, nummerplade pievieno trūkstošās. */
function mergeFactCards(primary: string, extra: string): string {
  const byKey = new Map<string, string>();
  for (const line of [...extra.split(/\r?\n/), ...primary.split(/\r?\n/)]) {
    const parsed = parseFactLine(line);
    if (!parsed) continue;
    byKey.set(parsed.key, parsed.raw);
  }
  const used = new Set<string>();
  const ordered: string[] = [];
  for (const key of FACT_KEY_ORDER) {
    const raw = byKey.get(key);
    if (!raw) continue;
    ordered.push(raw);
    used.add(key);
  }
  for (const [key, raw] of byKey) {
    if (used.has(key)) continue;
    ordered.push(raw);
  }
  return ordered.join("\n");
}

function uniqueNotes(primary: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const note of [...extra, ...primary]) {
    const t = note.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** tjekbil (DMR + synsrapport) + opcionāls nummerplade.net — viens admin bloks. */
export function mergeDanishVinResults(
  tjekbil: VinSourceFetchResult,
  nummerplade: VinSourceFetchResult | null,
): VinSourceFetchResult {
  if (!nummerplade || !nummerplade.found) {
    return {
      ...tjekbil,
      notes: uniqueNotes(tjekbil.notes, []),
      raw: JSON.stringify(
        {
          sources: ["tjekbil.dk (DMR + Færdselsstyrelsen synsrapport)", "nummerplade.net - nav datu"],
          tjekbil: safeJson(tjekbil.raw),
          nummerplade: nummerplade ? { message: nummerplade.message, raw: safeJson(nummerplade.raw) } : null,
        },
        null,
        2,
      ),
    };
  }

  const sources = ["tjekbil.dk (DMR + Færdselsstyrelsen synsrapport)", "nummerplade.net"];
  return {
    ...tjekbil,
    found: tjekbil.found || nummerplade.found,
    message: [tjekbil.message, nummerplade.message].filter(Boolean).join(" · "),
    mileage: mergeMileage(tjekbil.mileage, nummerplade.mileage),
    incidents: mergeIncidents(tjekbil.incidents, nummerplade.incidents),
    timeline: mergeTimeline(tjekbil.timeline, nummerplade.timeline),
    ownersSummary: mergeOwnersSummary(tjekbil.ownersSummary, nummerplade.ownersSummary),
    statusRecords: mergeFactCards(tjekbil.statusRecords, nummerplade.statusRecords),
    notes: uniqueNotes(tjekbil.notes, nummerplade.notes),
    raw: JSON.stringify(
      {
        sources,
        tjekbil: safeJson(tjekbil.raw),
        nummerplade: safeJson(nummerplade.raw),
      },
      null,
      2,
    ),
  };
}

function safeJson(raw: string): unknown {
  const t = raw.trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return raw.slice(0, 8000);
  }
}
