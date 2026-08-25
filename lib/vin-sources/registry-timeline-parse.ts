/**
 * Publisko reģistru (tjekbil / Nummerplade.net) ielīmējamais TSV šablons.
 * Aizpilda nobraukuma tabulu un reģistra hronoloģiju, ko PDF rāda vēstures kopsavilkumā.
 */
import { formatAutoRecordsDateForOutput, normalizeAutoRecordsOdometer } from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import type { VinRegistryMileageRow, VinRegistryTimelineRow } from "@/lib/admin-source-blocks";
import { emptyVinRegistryMileageRow, emptyVinRegistryTimelineRow } from "@/lib/admin-source-blocks";

export const VIN_REGISTRY_TIMELINE_PASTE_HEADER = "DATUMS\tKM\tVALSTS\tNOTIKUMS";

const SECTION_OWNERS = /^īpašnieki$/i;
const SECTION_STATUS = /^statusi$/i;
const SECTION_NOTES = /^piezīmes$/i;
const HEADER_RE = /^datums\b/i;

export type VinRegistryPasteParseResult = {
  found: boolean;
  mileage: VinRegistryMileageRow[];
  timeline: VinRegistryTimelineRow[];
  ownersSummary: string;
  statusRecords: string;
  notes: string;
};

function isDateCell(raw: string): boolean {
  const t = raw.trim();
  return (
    /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(t) ||
    /^\d{4}-\d{2}-\d{2}$/.test(t) ||
    /^\d{1,2}\.\d{4}$/.test(t)
  );
}

function splitRow(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes("|")) return line.split("|").map((c) => c.trim());
  return [];
}

function originFromEvent(event: string): string {
  const t = event.toLowerCase();
  if (/apskate|syn\b|toldsyn/.test(t)) return "Apskate";
  if (/sludināj/.test(t)) return "Sludinājums";
  if (/pirmā reģistrācija/.test(t)) return "Pirmā reģistrācija";
  if (/import/.test(t)) return "Imports";
  return "Reģistrs";
}

function looksLikeJson(raw: string): boolean {
  const t = raw.trim();
  return t.startsWith("{") || t.startsWith("[");
}

export function looksLikeVinRegistryTimelinePaste(raw: string): boolean {
  const t = raw.trim();
  if (!t || looksLikeJson(t)) return false;
  if (/datums\t+km\t+valsts\t+notikums/i.test(t)) return true;
  if (/^datums\s*\|\s*km\s*\|\s*valsts\s*\|\s*notikums/im.test(t)) return true;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  let dated = 0;
  for (const line of lines.slice(0, 12)) {
    const cols = splitRow(line);
    if (cols.length >= 3 && isDateCell(cols[0] ?? "")) dated += 1;
  }
  return dated >= 2;
}

export function parseVinRegistryTimelinePaste(raw: string): VinRegistryPasteParseResult {
  const empty: VinRegistryPasteParseResult = {
    found: false,
    mileage: [],
    timeline: [],
    ownersSummary: "",
    statusRecords: "",
    notes: "",
  };
  if (!looksLikeVinRegistryTimelinePaste(raw)) return empty;

  const mileage: VinRegistryMileageRow[] = [];
  const timeline: VinRegistryTimelineRow[] = [];
  const ownersLines: string[] = [];
  const statusLines: string[] = [];
  const noteLines: string[] = [];
  let section: "table" | "owners" | "status" | "notes" = "table";
  const seenMileage = new Set<string>();
  const seenTimeline = new Set<string>();

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/\u00a0/g, " ").trim();
    if (!line || line.startsWith("#")) continue;
    if (SECTION_OWNERS.test(line)) {
      section = "owners";
      continue;
    }
    if (SECTION_STATUS.test(line)) {
      section = "status";
      continue;
    }
    if (SECTION_NOTES.test(line)) {
      section = "notes";
      continue;
    }
    if (section === "owners") {
      ownersLines.push(line);
      continue;
    }
    if (section === "status") {
      statusLines.push(line);
      continue;
    }
    if (section === "notes") {
      noteLines.push(line);
      continue;
    }

    const cols = splitRow(line);
    if (cols.length < 3) continue;
    if (HEADER_RE.test(cols[0] ?? "")) continue;
    const dateRaw = cols[0] ?? "";
    if (!isDateCell(dateRaw)) continue;
    const date = formatAutoRecordsDateForOutput(dateRaw) || dateRaw;
    const c1 = cols[1] ?? "";
    const c2 = cols[2] ?? "";
    const rest = cols.slice(3).join(" ").trim();
    let odometer = "";
    let country = "";
    let event = "";
    if (/\d/.test(c1)) {
      odometer = normalizeAutoRecordsOdometer(c1) || c1.replace(/[^\d]/g, "");
      country = normalizeCountryNameLv(c2) || c2;
      event = rest;
    } else {
      country = normalizeCountryNameLv(c1) || c1;
      event = [c2, rest].filter(Boolean).join(" ");
    }
    event = event.replace(/\s+/g, " ").trim();

    if (odometer) {
      const mk = `${date}|${odometer}|${country}`;
      if (!seenMileage.has(mk)) {
        seenMileage.add(mk);
        mileage.push({
          date,
          odometer,
          country,
          origin: originFromEvent(event),
        });
      }
    }
    if (event || odometer) {
      const tk = `${date}|${odometer}|${event.toLowerCase()}`;
      if (!seenTimeline.has(tk)) {
        seenTimeline.add(tk);
        timeline.push({
          date,
          odometer,
          country,
          event: event || (odometer ? `Odometra ieraksts ${odometer} km` : ""),
        });
      }
    }
  }

  const found = mileage.length > 0 || timeline.length > 0;
  return {
    found,
    mileage: mileage.length > 0 ? mileage : [emptyVinRegistryMileageRow()],
    timeline: timeline.length > 0 ? timeline : [emptyVinRegistryTimelineRow()],
    ownersSummary: ownersLines.join("\n").trim(),
    statusRecords: statusLines.join("\n").trim(),
    notes: noteLines.join("\n").trim(),
  };
}
