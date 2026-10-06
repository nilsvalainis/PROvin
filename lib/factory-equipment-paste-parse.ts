/**
 * Rūpnīcas komplektācijas ielīmējumi → OFICIĀLĀ DĪLERA DATI „Komplektācija” (kods + apraksts).
 * VW PR saraksts, LastVIN Mercedes, BMW OEMNAVIGATIONS (salīmēts kods) un S-kodi.
 */
import type { CopilotAction, CopilotDealerVehicleInfoAction } from "@/lib/admin-copilot-types";
import {
  outvinEquipmentLineHasData,
  type OutvinEquipmentLine,
} from "@/lib/outvin-dealer-types";

export const FACTORY_EQUIPMENT_MAX_ROWS = 400;
const DESC_MAX = 400;

const NOISE_LINE_RE =
  /^(funkciju saraksts|informācija saņemta|vienkāršo ar mi|code\s*$|description\s*$|code\s+description|optional equipment|editions and packages|available upgrades|skip to content|share this vin|vehicle details|basic information|comfort and interior|driver assistance|wheels and drive|environment and safety|individual equipment|other equipment|multimedia)$/i;

const STOP_CODES = new Set([
  "VIN",
  "EUR",
  "PDF",
  "API",
  "FAQ",
  "NBT",
  "THE",
  "AND",
  "FOR",
  "CAR",
  "GET",
  "OFF",
  "ALL",
  "USB",
  "GPS",
  "WWW",
  "HTTP",
  "HTTPS",
]);

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " ").trim())
    .filter((l) => l.length > 0);
}

function looksLatvian(s: string): boolean {
  return /[āēīūčģķļņšžĀĒĪŪČĢĶĻŅŠŽ]/.test(s);
}

function isNoiseLine(line: string): boolean {
  if (NOISE_LINE_RE.test(line)) return true;
  if (/^https?:\/\//i.test(line)) return true;
  return false;
}

function isPrCode(line: string): boolean {
  if (!/^[0-9A-Z][0-9A-Z0-9]{2,3}$/.test(line)) return false;
  if (STOP_CODES.has(line)) return false;
  return true;
}

function pushLine(
  out: OutvinEquipmentLine[],
  seen: Set<string>,
  codeRaw: string,
  descriptionRaw: string,
): void {
  const code = codeRaw.trim().toUpperCase();
  const description = descriptionRaw.replace(/\s+/g, " ").trim().slice(0, DESC_MAX);
  if (!code || !description) return;
  const key = code || description.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ code, description });
}

function pickDescription(candidates: string[]): string {
  const cleaned = candidates.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
  const lv = [...cleaned].reverse().find(looksLatvian);
  return (lv || cleaned[cleaned.length - 1] || cleaned[0] || "").slice(0, DESC_MAX);
}

function looksTranslatedScript(s: string): boolean {
  return looksLatvian(s) || /[\u0400-\u04FF]/.test(s);
}

/** CarVertical „Funkciju saraksts”: kods + oriģinālā (parasti EN) rinda, bez MI tulkojuma. */
function isCvFeatureCode(line: string): boolean {
  const t = line.trim().toUpperCase();
  if (!t || STOP_CODES.has(t)) return false;
  if (/^\d{1,2}$/.test(t)) return false;
  if (/^[A-Z]$/.test(t)) return true;
  return /^[0-9A-Z]{2,5}$/.test(t);
}

function pickOriginalDescription(candidates: string[]): string {
  const cleaned = candidates
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c && !isNoiseLine(c) && !isCvFeatureCode(c) && !/^[-–—]+$/.test(c));
  const original = cleaned.find((c) => !looksTranslatedScript(c));
  return (original ?? "").slice(0, DESC_MAX);
}

const CV_FUNCTION_STOP_RE =
  /^(odometra\s+r[āa]d[īi]j|boj[āa]jumu\s+ieraksti|transportl[īi]dzek[ļl]a\s+specifik|ieteicamais\s+apkopes|datu\s+avoti|nov[ēe]rt[ēe]jums|tirgus\s+v[ēe]rt|juridisk[āa]|fiks[ēe]ts\s+nov[ēe]rt)/i;

/**
 * CarVertical PDF sadaļa „Funkciju saraksts” / „Informācija saņemta no ražotāja”.
 * Tukšs, ja sadaļas nav. AI/MI latviešu tulkojumus izlaiž.
 */
export function parseCarverticalFunctionList(text: string): OutvinEquipmentLine[] {
  const lines = normalizeLines(text);
  const start = lines.findIndex((l) => /funkciju\s+saraksts/i.test(l));
  if (start < 0) return [];

  const slice: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (CV_FUNCTION_STOP_RE.test(line)) break;
    if (isNoiseLine(line) && !isCvFeatureCode(line)) continue;
    slice.push(line);
  }

  const out: OutvinEquipmentLine[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < slice.length; i++) {
    const line = slice[i]!;
    const sameLine = line.match(/^([0-9A-Z]{2,5}|[A-Z])\s+(.{3,})$/i);
    if (sameLine && isCvFeatureCode(sameLine[1]!) && !isCvFeatureCode(sameLine[2]!.trim())) {
      const desc = pickOriginalDescription([sameLine[2]!]);
      if (desc) pushLine(out, seen, sameLine[1]!, desc);
      continue;
    }
    if (!isCvFeatureCode(line)) continue;
    if (/^[A-Z]$/.test(line.trim()) && (slice[i + 1] ?? "").trim().length < 8) continue;
    const following: string[] = [];
    let j = i + 1;
    while (j < slice.length && following.length < 3) {
      const next = slice[j]!;
      if (isCvFeatureCode(next)) break;
      following.push(next);
      j += 1;
    }
    const desc = pickOriginalDescription(following);
    if (!desc) continue;
    pushLine(out, seen, line, desc);
  }
  return uniqueByCode(out);
}

/** VW: kods savā rindā, tad EN, tad LV. */
function parseVwPrList(lines: string[]): OutvinEquipmentLine[] {
  const out: OutvinEquipmentLine[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (isNoiseLine(line) || !isPrCode(line)) continue;
    const following: string[] = [];
    let j = i + 1;
    while (j < lines.length && following.length < 3) {
      const next = lines[j]!;
      if (isNoiseLine(next) || isPrCode(next)) break;
      following.push(next);
      j += 1;
    }
    if (following.length === 0) continue;
    pushLine(out, seen, line, pickDescription(following));
  }
  return out;
}

/** LastVIN / tabula: `000A	FABRIC` pēc „Code Description”. */
function parseTabCodeDescription(lines: string[]): OutvinEquipmentLine[] {
  const start = lines.findIndex((l) => /^code(\s+|\t+)description$/i.test(l));
  const slice = start >= 0 ? lines.slice(start + 1) : lines;
  const out: OutvinEquipmentLine[] = [];
  const seen = new Set<string>();
  const rowRe = /^([0-9A-Z][0-9A-Z]{0,4})\t+(.+)$/;
  const spacedRe = /^([0-9A-Z]{2,5})\s{2,}(.{4,})$/;
  for (const line of slice) {
    if (isNoiseLine(line)) continue;
    if (/^mercedes benz vin decoded/i.test(line)) break;
    const tab = line.match(rowRe);
    const spaced = tab ? null : line.match(spacedRe);
    const m = tab ?? spaced;
    if (!m) continue;
    const code = m[1]!;
    const description = m[2]!;
    if (STOP_CODES.has(code.toUpperCase())) continue;
    pushLine(out, seen, code, description);
  }
  return out;
}

/** BMW OEMNAVIGATIONS: `0205Automatic transmission`. */
function parseGluedFourChar(lines: string[]): OutvinEquipmentLine[] {
  const start = lines.findIndex((l) => /optional equipment/i.test(l));
  const slice = start >= 0 ? lines.slice(start + 1) : lines;
  const out: OutvinEquipmentLine[] = [];
  const seen = new Set<string>();
  const gluedRe = /^([0-9A-Z]{4})([A-Za-z].+)$/;
  for (const line of slice) {
    if (/^(share this vin|payment methods|vehicle details|editions and packages)/i.test(line)) {
      if (out.length > 8) break;
    }
    if (isNoiseLine(line)) continue;
    const m = line.match(gluedRe);
    if (!m) continue;
    pushLine(out, seen, m[1]!, m[2]!);
  }
  return out;
}

/** BMW: `S402	Panorama glass roof` / `SA105	105 Ah AGM battery`. */
function parseBmwSCodes(lines: string[]): OutvinEquipmentLine[] {
  const out: OutvinEquipmentLine[] = [];
  const seen = new Set<string>();
  const re = /^(S[0-9A-Z]{3,5})\s+(.+)$/;
  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    const m = line.match(re);
    if (!m) continue;
    pushLine(out, seen, m[1]!, m[2]!);
  }
  return out;
}

function uniqueByCode(rows: OutvinEquipmentLine[]): OutvinEquipmentLine[] {
  const seen = new Set<string>();
  const out: OutvinEquipmentLine[] = [];
  for (const row of rows) {
    const key = row.code.trim().toUpperCase() || row.description.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.slice(0, FACTORY_EQUIPMENT_MAX_ROWS);
}

/** Atgriež visgarāko atpazīto komplektācijas sarakstu. */
export function parseFactoryEquipmentPaste(text: string): OutvinEquipmentLine[] {
  const raw = text.trim();
  if (raw.length < 40) return [];
  const lines = normalizeLines(raw).filter((l) => !isNoiseLine(l) || /optional equipment|code\s+description|funkciju saraksts/i.test(l));
  const candidates = [
    parseVwPrList(lines),
    parseTabCodeDescription(lines),
    parseGluedFourChar(lines),
    parseBmwSCodes(lines),
  ];
  let best: OutvinEquipmentLine[] = [];
  for (const list of candidates) {
    if (list.length > best.length) best = list;
  }
  return uniqueByCode(best);
}

export function looksLikeFactoryEquipmentPaste(text: string): boolean {
  return parseFactoryEquipmentPaste(text).length >= 8;
}

export function factoryEquipmentPasteHasVehicleHeader(text: string): boolean {
  return /LastVIN|Mercedes-Benz VIN Decoder|BMW VIN Decoder|Vehicle Details|Vehicle information|Order Number|Upholstery Code|\bFIN\t|\bInterior\t/i.test(
    text,
  );
}

export function buildFactoryEquipmentCopilotAction(text: string): CopilotDealerVehicleInfoAction | null {
  const equipment = parseFactoryEquipmentPaste(text).filter(outvinEquipmentLineHasData);
  if (equipment.length < 5) return null;
  return {
    type: "set_dealer_vehicle_info",
    source: "auto_records",
    vehicleInfo: {},
    equipment,
    override: true,
    confidence: "high",
    note: `Komplektācija: ${equipment.length} pozīcijas no ielīmētā saraksta`,
  };
}

/** Ielīmētais PR/SA saraksts vienmēr aizpilda tabulu, arī ja modelis to izlaida. */
export function mergeFactoryEquipmentIntoCopilotActions(
  actions: CopilotAction[],
  message: string,
): CopilotAction[] {
  const parsed = parseFactoryEquipmentPaste(message).filter(outvinEquipmentLineHasData);
  if (parsed.length < 5) return actions;
  const idx = actions.findIndex((a) => a.type === "set_dealer_vehicle_info");
  if (idx >= 0) {
    const current = actions[idx]!;
    if (current.type !== "set_dealer_vehicle_info") return actions;
    const incoming = (current.equipment ?? []).filter(outvinEquipmentLineHasData);
    const equipment = parsed.length >= incoming.length ? parsed : incoming;
    const next = [...actions];
    next[idx] = { ...current, equipment, override: true };
    return next;
  }
  const created = buildFactoryEquipmentCopilotAction(message);
  return created ? [...actions, created] : actions;
}
