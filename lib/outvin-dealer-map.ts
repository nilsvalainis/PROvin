/**
 * Outvin API JSON → dīlera atskaites lauki (elastīga struktūra).
 */
import {
  emptyOutvinVehicleInfo,
  OUTVIN_NO_RECORDS_LV,
  type OutvinDealerReport,
  type OutvinEquipmentLine,
  type OutvinVehicleInfo,
} from "@/lib/outvin-dealer-types";
import { extractEventsFromPayload } from "@/lib/outvin-history-map";

const VEHICLE_ALIASES: Record<keyof OutvinVehicleInfo, string[]> = {
  vinCode: ["vincode", "vin", "vin_code", "vehicleidentificationnumber"],
  series: ["series", "serie", "modelseries"],
  typeCode: ["typecode", "type", "type_code", "bodytype"],
  steeringSide: ["steeringside", "steering", "steering_side", "wheel"],
  interior: ["interior", "upholstery", "interiortrim"],
  model: ["model", "modelname", "modell"],
  generation: ["generation", "gen", "platform", "chassis"],
  engineCode: ["enginecode", "engine", "engine_code", "motorcode"],
  color: ["color", "colour", "paint", "exteriorcolor"],
  transmission: ["transmission", "gearbox", "trans"],
};

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function strVal(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function unwrapDataRoot(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const o = payload as Record<string, unknown>;
  const data = o.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const vehicle = d.vehicle;
    if (vehicle && typeof vehicle === "object") return vehicle as Record<string, unknown>;
    const spec = d.specification;
    if (spec && typeof spec === "object") return spec as Record<string, unknown>;
    return d;
  }
  const vehicle = o.vehicle;
  if (vehicle && typeof vehicle === "object") return vehicle as Record<string, unknown>;
  return o;
}

function flattenKeyValues(obj: Record<string, unknown>, depth = 0): Map<string, string> {
  const out = new Map<string, string>();
  if (depth > 4) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const nk = normKey(k);
    if (typeof v === "string" || typeof v === "number") {
      const s = strVal(v);
      if (s && !out.has(nk)) out.set(nk, s);
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      if (!out.has(nk)) out.set(nk, v.map(strVal).filter(Boolean).join(", "));
    } else if (typeof v === "object" && !Array.isArray(v)) {
      const nested = flattenKeyValues(v as Record<string, unknown>, depth + 1);
      for (const [nk2, val] of nested) {
        if (!out.has(nk2)) out.set(nk2, val);
      }
    }
  }
  return out;
}

export function mapOutvinVehicleJsonToInfo(payload: unknown, fallbackVin = ""): OutvinVehicleInfo {
  const root = unwrapDataRoot(payload);
  const flat = flattenKeyValues(root);
  const info = emptyOutvinVehicleInfo();

  for (const [field, aliases] of Object.entries(VEHICLE_ALIASES) as [keyof OutvinVehicleInfo, string[]][]) {
    for (const alias of aliases) {
      const hit = flat.get(alias);
      if (hit) {
        info[field] = hit.slice(0, 500);
        break;
      }
    }
  }

  if (!info.vinCode.trim() && fallbackVin) info.vinCode = fallbackVin;
  return info;
}

function parseEquipmentItem(item: unknown): OutvinEquipmentLine | null {
  if (typeof item === "string") {
    const t = item.trim();
    if (!t) return null;
    const m = t.match(/^([A-Z0-9]{2,12})\s*[-–—]\s*(.+)$/i);
    if (m) return { code: m[1]!.trim(), description: m[2]!.trim().slice(0, 400) };
    return { code: "", description: t.slice(0, 400) };
  }
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const code = strVal(o.code ?? o.optionCode ?? o.saCode ?? o.id ?? o.key);
  const description = strVal(
    o.description ?? o.name ?? o.label ?? o.title ?? o.text ?? o.value,
  );
  if (!code && !description) return null;
  return { code: code.slice(0, 32), description: description.slice(0, 400) };
}

function findEquipmentArray(obj: unknown, depth = 0): unknown[] {
  if (depth > 5 || obj == null) return [];
  if (Array.isArray(obj)) {
    if (obj.length > 0 && (typeof obj[0] === "string" || parseEquipmentItem(obj[0]))) return obj;
    return [];
  }
  if (typeof obj !== "object") return [];
  const o = obj as Record<string, unknown>;
  for (const key of ["equipment", "equipmentList", "options", "optionList", "saCodes", "standardEquipment", "features"]) {
    const v = o[key];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  for (const v of Object.values(o)) {
    const found = findEquipmentArray(v, depth + 1);
    if (found.length > 0) return found;
  }
  return [];
}

export function mapOutvinEquipmentFromPayload(payload: unknown): OutvinEquipmentLine[] {
  const root = unwrapDataRoot(payload);
  const raw = findEquipmentArray(root);
  const lines: OutvinEquipmentLine[] = [];
  for (const item of raw) {
    const line = parseEquipmentItem(item);
    if (line) lines.push(line);
  }
  return lines;
}

function formatEventLocation(loc: unknown): string {
  if (!loc || typeof loc === "boolean") return "";
  if (typeof loc !== "object") return "";
  const o = loc as Record<string, unknown>;
  const parts = [o.city, o.state, o.countryName, o.label].map(strVal).filter(Boolean);
  return parts.join(", ");
}

function eventsToAccidentText(payload: unknown): string {
  const events = extractEventsFromPayload(payload);
  const lines: string[] = [];
  for (const ev of events) {
    const type = typeof ev.type === "string" ? ev.type : "";
    if (!/accident|damage|collision|crash|repair|claim/i.test(type)) continue;
    const date = typeof ev.date === "string" ? ev.date : "";
    const loc = formatEventLocation(ev.location);
    const detail = type || "Event";
    lines.push([date, loc, detail].filter(Boolean).join(" — "));
  }
  return lines.join("\n");
}

function deepFindString(obj: unknown, keyPatterns: RegExp[], depth = 0): string {
  if (depth > 6 || obj == null) return "";
  if (typeof obj === "string") return obj.trim();
  if (typeof obj !== "object") return "";
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const s = deepFindString(item, keyPatterns, depth + 1);
      if (s) return s;
    }
    return "";
  }
  const o = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (keyPatterns.some((re) => re.test(k))) {
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "boolean" && v === false) return OUTVIN_NO_RECORDS_LV;
      if (Array.isArray(v) && v.length === 0) return OUTVIN_NO_RECORDS_LV;
      if (v && typeof v === "object" && "records" in v) {
        const rec = (v as { records?: unknown }).records;
        if (Array.isArray(rec) && rec.length === 0) return OUTVIN_NO_RECORDS_LV;
      }
    }
  }
  for (const v of Object.values(o)) {
    const s = deepFindString(v, keyPatterns, depth + 1);
    if (s) return s;
  }
  return "";
}

function normalizeCheckText(raw: string, eventFallback: string): string {
  const t = raw.trim();
  if (t) return t.slice(0, 8000);
  if (eventFallback.trim()) return eventFallback.trim().slice(0, 8000);
  return OUTVIN_NO_RECORDS_LV;
}

export function buildOutvinDealerReport(args: {
  vehiclePayload: unknown;
  historyPayloads: unknown[];
  vin: string;
}): OutvinDealerReport {
  const vehicleInfo = mapOutvinVehicleJsonToInfo(args.vehiclePayload, args.vin);
  let equipment = mapOutvinEquipmentFromPayload(args.vehiclePayload);
  for (const hp of args.historyPayloads) {
    if (equipment.length === 0) equipment = mapOutvinEquipmentFromPayload(hp);
  }

  let accidentCheck = "";
  let stolenCheck = "";
  for (const hp of args.historyPayloads) {
    if (!accidentCheck) {
      accidentCheck =
        deepFindString(hp, [/accident/i, /damage/i, /collision/i]) ||
        eventsToAccidentText(hp);
    }
    if (!stolenCheck) {
      stolenCheck = deepFindString(hp, [/stolen/i, /theft/i, /wanted/i]);
    }
  }

  return {
    vehicleInfo,
    accidentCheck: normalizeCheckText(accidentCheck, eventsToAccidentText(args.historyPayloads[1] ?? args.historyPayloads[0] ?? null)),
    stolenCheck: normalizeCheckText(stolenCheck, ""),
    equipment,
  };
}
