/**
 * auto-records.com "VEHICLE INFORMATION" sadaļas parsēšana → OutvinVehicleInfo lauki.
 */
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";

type VehicleInfoKey = keyof OutvinVehicleInfo;

const PLACEHOLDER_RE = /^(\-+|—|–|–\s*|no\s+data)$/i;

const LABELS: Array<{ key: VehicleInfoKey; re: RegExp }> = [
  { key: "vinCode", re: /^VIN\s*Code\s*:?\s*(.*)$/i },
  { key: "model", re: /^Model\s*:?\s*(.*)$/i },
  { key: "series", re: /^Series\s*:?\s*(.*)$/i },
  { key: "generation", re: /^Generation\s*:?\s*(.*)$/i },
  { key: "typeCode", re: /^Type\s*code\s*:?\s*(.*)$/i },
  { key: "engineCode", re: /^Engine\s*code\s*:?\s*(.*)$/i },
  { key: "steeringSide", re: /^Steering\s*side\s*:?\s*(.*)$/i },
  { key: "color", re: /^Color\s*:?\s*(.*)$/i },
  { key: "interior", re: /^Interior\s*:?\s*(.*)$/i },
  { key: "transmission", re: /^Transmission\s*:?\s*(.*)$/i },
];

function normalizeValue(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t || PLACEHOLDER_RE.test(t)) return "";
  return t;
}

export function parseOutvinVehicleInfoFromAutoRecordsText(
  rawText: string,
): Partial<OutvinVehicleInfo> {
  const text = sanitizePdfTextForParsing(rawText);
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  const out: Partial<OutvinVehicleInfo> = {};
  let section = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^vehicle\s+information/i.test(line)) {
      section = true;
      continue;
    }
    if (!section) continue;
    if (/^odometer\s+check/i.test(line)) break;

    for (const { key, re } of LABELS) {
      const m = line.match(re);
      if (!m) continue;
      const inline = normalizeValue(m[1] ?? "");
      if (inline) {
        out[key] = inline;
        break;
      }
      const next = lines[i + 1]?.trim() ?? "";
      if (next && !LABELS.some((l) => l.re.test(next)) && !/^odometer/i.test(next)) {
        const v = normalizeValue(next);
        if (v) out[key] = v;
      }
      break;
    }
  }

  return out;
}
