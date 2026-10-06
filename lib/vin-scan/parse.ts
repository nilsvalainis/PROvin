/**
 * Tīras atbilžu parsēšanas funkcijas ātrajai VIN pārbaudei. Bez tīkla.
 */
import { vinFactoryRegion } from "@/lib/outvin-source-catalog";
import type { VinScanParse, VinScanStatus } from "@/lib/vin-scan/types";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

function kmLv(n: number): string {
  return `${Math.round(n).toLocaleString("lv-LV")} km`;
}

const ESYN_CONCLUSION_LV: Record<string, string> = {
  GOD: "izturēta",
  OOM: "nav izturēta",
  BET: "nosacīti",
};

export function parseTjekbilProbe(status: number, text: string): VinScanParse {
  if (status === 404) return { status: "none", summary: "VIN nav Dānijas reģistrā" };
  if (status !== 200) return { status: "unknown", summary: `tjekbil.dk atbildēja ar HTTP ${status}` };
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { status: "unknown", summary: "tjekbil.dk atbilde nav JSON" };
  }
  const basic = asRecord(asRecord(data).basic);
  const vehicle = [str(basic.maerkeTypeNavn), str(basic.modelTypeNavn)].filter(Boolean).join(" ");
  const plate = str(basic.regNr);
  const regStatus = str(basic.status);
  if (!vehicle && !plate && !str(basic.stelNr)) {
    return { status: "none", summary: "tjekbil.dk neatgrieza auto" };
  }
  const bits = [vehicle, plate, regStatus].filter(Boolean);
  return { status: "found", summary: bits.join(", ") || "Ir Dānijas reģistrā" };
}

export type EsynVehicle = { make: string; model: string; plate: string; chassis: string };

export function parseEsynChassis(
  status: number,
  text: string,
  vin: string,
): { vehicle: EsynVehicle } | VinScanParse {
  if (status === 404) return { status: "none", summary: "Nav Dānijas apskašu reģistrā" };
  if (status !== 200) return { status: "unknown", summary: `esyn.dk atbildēja ar HTTP ${status}` };
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { status: "unknown", summary: "esyn.dk atbilde nav JSON" };
  }
  if (asRecord(data).error) return { status: "none", summary: "Nav Dānijas apskašu reģistrā" };
  const rows = Array.isArray(data) ? data : [data];
  const wanted = vin.trim().toUpperCase();
  const match =
    rows
      .map((row) => asRecord(row))
      .find((row) => str(row.chassisNumber).toUpperCase() === wanted) ?? asRecord(rows[0]);
  const chassis = str(match.chassisNumber).toUpperCase();
  const make = str(match.make);
  const model = str(match.model);
  if (!chassis && !make && !model) return { status: "none", summary: "Nav Dānijas apskašu reģistrā" };
  return { vehicle: { make, model, plate: str(match.registrationNumber), chassis } };
}

export function parseEsynInspections(text: string): VinScanParse & { count: number } {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { status: "unknown", summary: "Apskates saraksts nav JSON", count: 0 };
  }
  const inspections = asRecord(data).inspection;
  const rows = Array.isArray(inspections) ? inspections.map((row) => asRecord(row)) : [];
  if (rows.length === 0) return { status: "none", summary: "Auto ir reģistrā, apskašu nav", count: 0 };
  const lines = rows.slice(0, 8).map((row) => {
    const date = str(row.date).slice(0, 10);
    const code = str(row.conclusion).toUpperCase();
    const verdict = ESYN_CONCLUSION_LV[code] ?? code;
    const exact = typeof row.exactOdometer === "number" ? row.exactOdometer : null;
    const coarse = typeof row.odometer === "number" ? row.odometer : null;
    const km = exact != null && exact > 0 ? exact : coarse != null && coarse > 0 ? coarse * 1000 : null;
    return [date, verdict, km != null ? kmLv(km) : ""].filter(Boolean).join(", ");
  });
  const latest = lines[0] ?? "";
  return {
    status: "found",
    summary: `${rows.length} apskates${latest ? `, pēdējā ${latest}` : ""}`,
    detail: lines.join("\n"),
    count: rows.length,
  };
}

export function esynVehicleSummary(vehicle: EsynVehicle, inspections: VinScanParse): VinScanParse {
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const head = [name, vehicle.plate].filter(Boolean).join(", ");
  return {
    status: inspections.status === "unknown" ? "found" : inspections.status,
    summary: [head, inspections.summary].filter(Boolean).join(". "),
    detail: inspections.detail,
  };
}

export function parseDsbSearchHtml(html: string): { vehicle: string; country: string; servicesPath: string | null } {
  const vehicle = html.match(/id="header-car-name"[^>]*>\s*([^<]+?)\s*</i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const country = html.match(/Result for\s*<strong>([^<]+)<\/strong>/i)?.[1]?.trim() ?? "";
  const raw = html.match(/\/Search\/LoadServices\?[^"'<\s]+/i)?.[0] ?? "";
  const servicesPath = raw ? raw.replace(/&amp;/g, "&") : null;
  return { vehicle, country, servicesPath };
}

export function parseDsbEntryCount(html: string): number | null {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&#xA;|&#10;/g, " ");
  const m = /(\d+)\s+entr(?:y|ies) we found/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function dsbScanFromParts(search: { vehicle: string; country: string }, count: number | null): VinScanParse {
  if (!search.vehicle) return { status: "none", summary: "VIN nav Digital Servicebook" };
  const where = [search.vehicle, search.country].filter(Boolean).join(", ");
  if (count == null) {
    return { status: "unknown", summary: `${where}. Servisa ierakstu skaitu neizdevās nolasīt` };
  }
  if (count > 0) {
    return { status: "found", summary: `${count} servisa ieraksti (${where}). Pilns pārskats ir maksas` };
  }
  return { status: "none", summary: `Auto atpazīts (${where}), servisa ierakstu nav` };
}

export function parseCarpassCsrf(html: string): string | null {
  const m = /name="_csrf"\s+content="([^"]+)"/i.exec(html) ?? /content="([^"]+)"\s+name="_csrf"/i.exec(html);
  return m?.[1]?.trim() || null;
}

export function parseCarpassRecalls(status: number, text: string): VinScanParse {
  if (status === 403 || status === 429) return { status: "unknown", summary: `Car-Pass atbildēja ar HTTP ${status}` };
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { status: "unknown", summary: status === 200 ? "Car-Pass atbilde nav JSON" : `Car-Pass atbildēja ar HTTP ${status}` };
  }
  const rec = asRecord(data);
  const result = str(rec.result);
  const success = rec.success === true;
  const recalls = Array.isArray(rec.recalls) ? rec.recalls.length : Array.isArray(rec.data) ? rec.data.length : null;
  if (!success && /unknown|onbekend|inconnu|unbekannt|sconosciut/i.test(result)) {
    return { status: "none", summary: "Nav Beļģijas Car-Pass reģistrā" };
  }
  if (recalls != null && recalls > 0) {
    return { status: "found", summary: `${recalls} atsaukumi`, detail: result };
  }
  if (success) {
    return { status: "none", summary: result ? `Atsaukumu nav. ${result}` : "Atsaukumu nav", detail: result };
  }
  if (result) return { status: "none", summary: result };
  return { status: "unknown", summary: "Car-Pass neatgrieza rezultātu" };
}

export function parseNhtsaDecode(status: number, text: string): VinScanParse {
  if (status !== 200) return { status: "unknown", summary: `NHTSA atbildēja ar HTTP ${status}` };
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { status: "unknown", summary: "NHTSA atbilde nav JSON" };
  }
  const row = asRecord((Array.isArray(asRecord(data).Results) ? (asRecord(data).Results as unknown[])[0] : null) ?? null);
  const make = str(row.Make);
  const model = str(row.Model);
  const year = str(row.ModelYear);
  const error = str(row.ErrorCode);
  const errorText = str(row.ErrorText);
  const name = [year, make, model].filter(Boolean).join(" ");
  if (!make) return { status: "none", summary: "NHTSA neatkodēja ražotāju", detail: errorText };
  const clean = error === "0" || error.startsWith("0");
  return {
    status: "found",
    summary: clean ? name : `Daļējs dekodējums: ${name}`,
    detail: errorText,
  };
}

export function oneautoScanCopy(configured: boolean): VinScanParse {
  if (!configured) return { status: "skipped", summary: "Nav ONEAUTO_API_KEY" };
  return {
    status: "manual",
    summary: "Atslēga ir. Skenēšana tikai pārbauda atslēgu. Datus pērk Auto-Records solī",
  };
}

export function outvinScanCopy(vin: string, configured: boolean): VinScanParse {
  const region = vinFactoryRegion(vin);
  const carfax =
    region === "europe"
      ? "ASV Carfax (Type 2): Eiropas VIN, parasti nav"
      : "ASV Carfax (Type 2): esamība nav zināma bez pirkuma";
  const service = "Servisa vēsture (Type 1): esamība nav zināma bez pirkuma";
  const head = configured ? "Atslēga ir. Skenēšana tikai pārbauda atslēgu." : "Nav OUTVIN_EMAIL / OUTVIN_PASSWORD.";
  const status: VinScanStatus = configured ? "manual" : "skipped";
  return { status, summary: `${head} ${service}. ${carfax}.` };
}

export function parseNummerpladeProbe(status: number, text: string, mappedFound: boolean, mappedMessage: string): VinScanParse {
  if (status === 429) return { status: "unknown", summary: "nummerplade.net dienas limits (100 opslag)" };
  if (status === 401 || status === 403) return { status: "unknown", summary: "nummerplade.net API atslēga nav derīga" };
  if (status === 404) return { status: "none", summary: "nummerplade.net šo VIN neatpazina" };
  if (status !== 200) return { status: "unknown", summary: `nummerplade.net atbildēja ar HTTP ${status}` };
  if (!text.trim()) return { status: "unknown", summary: "nummerplade.net tukša atbilde" };
  if (!mappedFound) return { status: "none", summary: mappedMessage || "nummerplade.net neatpazina šo VIN" };
  return { status: "found", summary: mappedMessage || "Ir nummerplade.net" };
}
