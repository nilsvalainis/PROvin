/**
 * auto-records.com "VEHICLE INFORMATION" sadaļas parsēšana.
 *
 * Mērķis: aizpildīt OutvinVehicleInfo laukus (VIN kods, modelis u.c.) no PDF teksta arī tad,
 * ja ir lieki simboli ("|") vai vērtības ir pielīmētas pie atslēgas vārdiem.
 */
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";

type VehicleInfoKey = keyof OutvinVehicleInfo;

const PLACEHOLDER_RE = /^(\-+|—|–|–\s*|no\s+data)$/i;

function normalizeValue(raw: string): string {
  const t = sanitizePdfTextForParsing(raw)
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  if (PLACEHOLDER_RE.test(t)) return "";
  return t;
}

const LABELS: Array<{ key: VehicleInfoKey; inline: RegExp; header: RegExp }> = [
  { key: "vinCode", inline: /^VIN\s*Code\s*[:\-]?\s*(.*)$/i, header: /^VIN\s*Code\s*[:\-]?\s*$/i },
  { key: "model", inline: /^Model\s*[:\-]?\s*(.*)$/i, header: /^Model\s*[:\-]?\s*$/i },
  { key: "series", inline: /^Series\s*[:\-]?\s*(.*)$/i, header: /^Series\s*[:\-]?\s*$/i },
  { key: "generation", inline: /^Generation\s*[:\-]?\s*(.*)$/i, header: /^Generation\s*[:\-]?\s*$/i },
  { key: "typeCode", inline: /^Type\s*code\s*[:\-]?\s*(.*)$/i, header: /^Type\s*code\s*[:\-]?\s*$/i },
  { key: "engineCode", inline: /^Engine\s*code\s*[:\-]?\s*(.*)$/i, header: /^Engine\s*code\s*[:\-]?\s*$/i },
  { key: "steeringSide", inline: /^Steering\s*side\s*[:\-]?\s*(.*)$/i, header: /^Steering\s*side\s*[:\-]?\s*$/i },
  { key: "color", inline: /^Color\s*[:\-]?\s*(.*)$/i, header: /^Color\s*[:\-]?\s*$/i },
  { key: "interior", inline: /^Interior\s*[:\-]?\s*(.*)$/i, header: /^Interior\s*[:\-]?\s*$/i },
  {
    key: "transmission",
    inline: /^Transmission\s*[:\-]?\s*(.*)$/i,
    header: /^Transmission\s*[:\-]?\s*$/i,
  },
];

function labelMatch(line: string): { key: VehicleInfoKey; inlineValue?: string } | null {
  for (const l of LABELS) {
    const m = line.match(l.inline);
    if (m) return { key: l.key, inlineValue: m[1] ?? "" };
  }
  return null;
}

function headerMatch(line: string): VehicleInfoKey | null {
  for (const l of LABELS) {
    if (l.header.test(line)) return l.key;
  }
  return null;
}

export function parseOutvinVehicleInfoFromAutoRecordsText(
  rawText: string,
): Partial<OutvinVehicleInfo> {
  const text = sanitizePdfTextForParsing(rawText);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: Partial<OutvinVehicleInfo> = {};

  let activeKey: VehicleInfoKey | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!activeKey) return;
    const v = normalizeValue(buffer.join(" "));
    if (v) out[activeKey] = v;
    activeKey = null;
    buffer = [];
  };

  for (const line of lines) {
    const inline = labelMatch(line);
    if (inline) {
      flush();
      const v = normalizeValue(inline.inlineValue ?? "");
      if (v) {
        out[inline.key] = v;
        activeKey = null;
      } else if (headerMatch(line)) {
        // "Label:" without inline value — read next line(s)
        activeKey = inline.key;
        buffer = [];
      } else {
        // Probably "Label: " with empty value — keep capturing
        activeKey = inline.key;
        buffer = [];
      }
      continue;
    }

    if (activeKey) {
      // Stop capturing if we hit another header
      const hk = headerMatch(line);
      if (hk) {
        flush();
        activeKey = hk;
        buffer = [];
        continue;
      }
      buffer.push(line);
      // If we already have something and next lines likely belong to next block, flush on placeholder.
      if (buffer.length >= 3) {
        flush();
      }
    }
  }

  flush();
  return out;
}

