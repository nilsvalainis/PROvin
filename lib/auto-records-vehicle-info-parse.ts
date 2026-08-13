/**
 * auto-records.com "VEHICLE INFORMATION" sadaļas parsēšana → OutvinVehicleInfo lauki.
 *
 * Krāsa / interjērs atskaitē ir ar rūpnīcas kodu iekavās („Mystic-blau metallic (L0A07)”) —
 * kods iet atsevišķā lauka („Krāsas kods”), apzīmējums paliek pilnā formā.
 */
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";

type VehicleInfoKey = keyof OutvinVehicleInfo;

const PLACEHOLDER_RE = /^(\-+|—|–|–\s*|no\s+data)$/i;

const LABELS: Array<{ key: VehicleInfoKey; re: RegExp }> = [
  { key: "vinCode", re: /^VIN\s*Code\s*:?\s*(.*)$/i },
  { key: "model", re: /^Model\s*:?\s*(.*)$/i },
  { key: "modelSeries", re: /^Generation\s*:?\s*(.*)$/i },
  { key: "vehicleType", re: /^Type\s*code\s*:?\s*(.*)$/i },
  { key: "engineCode", re: /^Engine\s*code\s*:?\s*(.*)$/i },
  { key: "steeringSide", re: /^Steering\s*side\s*:?\s*(.*)$/i },
  { key: "color", re: /^Colou?r\s*:?\s*(.*)$/i },
  { key: "interior", re: /^Interior\s*:?\s*(.*)$/i },
  { key: "transmission", re: /^Transmission\s*:?\s*(.*)$/i },
];

/** „Series: 3” — modeļa saime; iet „Modeļa sērija” laukā tikai bez precīzākas paaudzes. */
const SERIES_RE = /^Series\s*:?\s*(.*)$/i;

/** Rūpnīcas kods iekavās: „Leather Montana/basic equip/schwarz (PN6SW)” → `PN6SW`. */
const TRAILING_CODE_RE = /\(([A-Z0-9][A-Z0-9\-/]{2,15})\)\s*$/;

function normalizeValue(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t || PLACEHOLDER_RE.test(t)) return "";
  return t;
}

function trailingCode(value: string): string {
  const m = value.match(TRAILING_CODE_RE);
  return m ? (m[1] ?? "") : "";
}

export function parseOutvinVehicleInfoFromAutoRecordsText(
  rawText: string,
): Partial<OutvinVehicleInfo> {
  const text = sanitizePdfTextForParsing(rawText);
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  const out: Partial<OutvinVehicleInfo> = {};
  let series = "";
  let section = false;

  const valueAfter = (index: number, inline: string): string => {
    const direct = normalizeValue(inline);
    if (direct) return direct;
    const next = lines[index + 1]?.trim() ?? "";
    if (!next || /^odometer/i.test(next)) return "";
    if (LABELS.some((l) => l.re.test(next)) || SERIES_RE.test(next)) return "";
    return normalizeValue(next);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^vehicle\s+information/i.test(line)) {
      section = true;
      continue;
    }
    if (!section) continue;
    if (/^odometer\s+check/i.test(line)) break;

    const seriesMatch = line.match(SERIES_RE);
    if (seriesMatch) {
      series = valueAfter(i, seriesMatch[1] ?? "");
      continue;
    }

    for (const { key, re } of LABELS) {
      const m = line.match(re);
      if (!m) continue;
      const value = valueAfter(i, m[1] ?? "");
      if (value) out[key] = value;
      break;
    }
  }

  if (series && !out.modelSeries) out.modelSeries = series;

  const colorCode = trailingCode(out.color ?? "");
  if (colorCode) out.colorCode = colorCode;
  const interiorCode = trailingCode(out.interior ?? "");
  if (interiorCode) out.interiorCode = interiorCode;
  if (out.vehicleType && !out.modelCode) out.modelCode = out.vehicleType;

  return out;
}
