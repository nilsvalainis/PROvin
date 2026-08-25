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
    const key = `${row.date}|${row.event}|${row.odometer ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.sort((x, y) => y.date.localeCompare(x.date));
}

function joinText(primary: string, extra: string): string {
  const a = primary.trim();
  const b = extra.trim();
  if (!b) return a;
  if (!a) return b;
  if (a.includes(b)) return a;
  return `${b}\n${a}`;
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
    const skipNote =
      nummerplade == null
        ? "Nummerplade.net nav pieslēgts šajā vidē. tjekbil.dk jau satur DMR un Færdselsstyrelsen synsrapport."
        : nummerplade.found
          ? ""
          : "Nummerplade.net šoreiz nedeva papildu datus.";
    return {
      ...tjekbil,
      notes: uniqueNotes(tjekbil.notes, [skipNote]),
      raw: JSON.stringify(
        {
          sources: ["tjekbil.dk (DMR + Færdselsstyrelsen synsrapport)", "nummerplade.net — nav datu"],
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
    ownersSummary: joinText(tjekbil.ownersSummary, nummerplade.ownersSummary),
    statusRecords: joinText(tjekbil.statusRecords, nummerplade.statusRecords),
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
