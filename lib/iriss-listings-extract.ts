/**
 * VIN / krāsa / virsbūve no izsoļu avota objektiem. Tukšs, ja lauka nav vai VIN nav derīgs.
 * Auto1 saraksta API parasti VIN nedod; Openlane ChassisNumber meklēšanā bieži null;
 * Autobid VIN parādās additionalInformation vai aprīkojumā, ja avots to iedod.
 */

import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

const VIN_KEY_RE = /^(vin|vinnumber|vin_number|chassisnumber|chassis_number|fahrgestellnummer|vehicleidentificationnumber|vehicle_identification_number|fin)$/i;
const VIN_NAME_RE = /\b(vin|fahrgestell|chassis|fin)\b/i;
const COLOR_KEY_RE = /^(color|colour|colorname|colourname|exteriorcolor|exteriorcolour|bodycolor|bodycolour|paint|paintcolor|carcolor)$/i;
const COLOR_NAME_RE = /^(color|colour|farbe|krāsa|krasa|lakier|couleur)$/i;
const BODY_KEY_RE = /^(bodytype|bodystyle|body|category|cartype|vehicletype)$/i;
const BODY_NAME_RE = /^(body|body type|bodytype|karosserie|virsbūve|nadwozie)$/i;
const DOOR_KEY_RE = /^(doorcount|doors|numberofdoors|nrofdoors|door_count)$/i;
const DOOR_NAME_RE = /^(doors?|türen|durvis)$/i;

function labeledValue(v: unknown): string {
  const direct = asText(v);
  if (direct && direct !== "0") return direct;
  if (!isRec(v)) return "";
  for (const k of ["Name", "name", "Text", "text", "Label", "label", "Value", "value", "Description", "description"]) {
    const s = asText(v[k]);
    if (s && s !== "0") return s;
  }
  return "";
}

function lookLikeVin(raw: string): string {
  const n = normalizeVin(raw);
  return isValidVin(n) ? n : "";
}

function walkVin(value: unknown, depth: number, seen: Set<unknown>): string {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string" || typeof value === "number") return lookLikeVin(asText(value));
  if (typeof value !== "object") return "";
  if (seen.has(value)) return "";
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 40) return "";
    for (const x of value) {
      const vin = walkVin(x, depth + 1, seen);
      if (vin) return vin;
    }
    return "";
  }
  const rec = value as Rec;
  for (const [k, v] of Object.entries(rec)) {
    if (VIN_KEY_RE.test(k)) {
      const vin = lookLikeVin(labeledValue(v) || asText(v));
      if (vin) return vin;
    }
  }
  for (const [k, v] of Object.entries(rec)) {
    if (VIN_NAME_RE.test(k) && !VIN_KEY_RE.test(k)) {
      const vin = lookLikeVin(labeledValue(v) || asText(v));
      if (vin) return vin;
    }
    if (isRec(v) && VIN_NAME_RE.test(asText(v.name) || asText(v.id))) {
      const vin = lookLikeVin(asText(v.value) || asText(v.rawValue) || labeledValue(v));
      if (vin) return vin;
    }
  }
  if (depth >= 3) return "";
  for (const v of Object.values(rec)) {
    if (!v || typeof v !== "object") continue;
    const vin = walkVin(v, depth + 1, seen);
    if (vin) return vin;
  }
  return "";
}

/** Pirmais derīgais VIN (11-17, bez I/O/Q) no avota objekta. */
export function pickListingVin(source: unknown): string {
  return walkVin(source, 0, new Set());
}

function pickByKey(source: unknown, keyRe: RegExp, nameRe: RegExp, depth = 0, seen: Set<unknown> = new Set()): string {
  if (depth > 3 || source == null || typeof source !== "object") return "";
  if (seen.has(source)) return "";
  seen.add(source);
  if (Array.isArray(source)) return "";
  const rec = source as Rec;
  for (const [k, v] of Object.entries(rec)) {
    if (keyRe.test(k)) {
      const s = labeledValue(v);
      if (s) return s;
    }
  }
  for (const v of Object.values(rec)) {
    if (!isRec(v)) continue;
    const name = asText(v.name) || asText(v.id);
    if (nameRe.test(name)) {
      const s = asText(v.value) || asText(v.rawValue) || labeledValue(v);
      if (s) return s;
    }
  }
  if (depth >= 2) return "";
  for (const v of Object.values(rec)) {
    if (!isRec(v)) continue;
    const s = pickByKey(v, keyRe, nameRe, depth + 1, seen);
    if (s) return s;
  }
  return "";
}

export function pickListingColor(source: unknown): string {
  return pickByKey(source, COLOR_KEY_RE, COLOR_NAME_RE);
}

export function pickListingBodyType(source: unknown): string {
  return pickByKey(source, BODY_KEY_RE, BODY_NAME_RE);
}

export function pickListingDoorCount(source: unknown): string {
  const raw = pickByKey(source, DOOR_KEY_RE, DOOR_NAME_RE);
  const n = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (Number.isFinite(n) && n >= 2 && n <= 6) return String(n);
  return "";
}
