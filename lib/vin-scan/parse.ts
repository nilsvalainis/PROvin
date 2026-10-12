/**
 * Tīras atbilžu parsēšanas funkcijas ātrajai VIN pārbaudei. Bez tīkla.
 */
import type { CsddTechDataResult } from "@/lib/csdd-tech-data";
import type { VinScanParse, VinScanVehicle } from "@/lib/vin-scan/types";
import type { VinSourceFetchResult } from "@/lib/vin-sources/types";

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
  const make = str(basic.maerkeTypeNavn);
  const model = str(basic.modelTypeNavn);
  const vehicle = [make, model].filter(Boolean).join(" ");
  const plate = str(basic.regNr);
  const regStatus = str(basic.status);
  const firstReg = str(basic.foersteRegistreringDato);
  const year = firstReg.match(/(\d{4})/)?.[1] ?? "";
  if (!vehicle && !plate && !str(basic.stelNr)) {
    return { status: "none", summary: "tjekbil.dk neatgrieza auto" };
  }
  const bits = [vehicle, year, plate, regStatus].filter(Boolean);
  return {
    status: "found",
    summary: bits.join(", ") || "Ir Dānijas reģistrā",
    vehicle: make || model || year ? { make, model, year } : undefined,
  };
}

export type EsynVehicle = { make: string; model: string; plate: string; chassis: string };

export type EsynChassisHit = { ok: true; vehicle: EsynVehicle };
export type EsynChassisMiss = VinScanParse & { ok: false };

export function parseEsynChassis(
  status: number,
  text: string,
  vin: string,
): EsynChassisHit | EsynChassisMiss {
  if (status === 404) return { ok: false, status: "none", summary: "Nav Dānijas apskašu reģistrā" };
  if (status !== 200) return { ok: false, status: "unknown", summary: `esyn.dk atbildēja ar HTTP ${status}` };
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, status: "unknown", summary: "esyn.dk atbilde nav JSON" };
  }
  if (asRecord(data).error) return { ok: false, status: "none", summary: "Nav Dānijas apskašu reģistrā" };
  const rows = Array.isArray(data) ? data : [data];
  const wanted = vin.trim().toUpperCase();
  const match =
    rows
      .map((row) => asRecord(row))
      .find((row) => str(row.chassisNumber).toUpperCase() === wanted) ?? asRecord(rows[0]);
  const chassis = str(match.chassisNumber).toUpperCase();
  const make = str(match.make);
  const model = str(match.model);
  if (!chassis && !make && !model) return { ok: false, status: "none", summary: "Nav Dānijas apskašu reģistrā" };
  return { ok: true, vehicle: { make, model, plate: str(match.registrationNumber), chassis } };
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
  const mileage = rows
    .map((row) => {
      const date = str(row.date).slice(0, 10);
      const exact = typeof row.exactOdometer === "number" ? row.exactOdometer : null;
      const coarse = typeof row.odometer === "number" ? row.odometer : null;
      const km = exact != null && exact > 0 ? exact : coarse != null && coarse > 0 ? coarse * 1000 : null;
      if (!date || km == null) return null;
      return { date, odometer: kmLv(km) };
    })
    .filter((row): row is { date: string; odometer: string } => Boolean(row));
  return {
    status: "found",
    summary: `${rows.length} apskates${latest ? `, pēdējā ${latest}` : ""}`,
    detail: lines.join("\n"),
    mileage,
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
    vehicle: vehicle.make || vehicle.model ? { make: vehicle.make, model: vehicle.model, year: "" } : undefined,
    mileage: inspections.mileage,
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

export function parseNummerpladeProbe(
  status: number,
  text: string,
  mappedFound: boolean,
  mappedMessage: string,
): VinScanParse {
  if (status === 429) return { status: "unknown", summary: "nummerplade.net dienas limits (100 opslag)" };
  if (status === 401 || status === 403) return { status: "unknown", summary: "nummerplade.net API atslēga nav derīga" };
  if (status === 404) return { status: "none", summary: "nummerplade.net šo VIN neatpazina" };
  if (status !== 200) return { status: "unknown", summary: `nummerplade.net atbildēja ar HTTP ${status}` };
  if (!text.trim()) return { status: "unknown", summary: "nummerplade.net tukša atbilde" };
  if (!mappedFound) return { status: "none", summary: mappedMessage || "nummerplade.net neatpazina šo VIN" };
  return { status: "found", summary: mappedMessage || "Ir nummerplade.net" };
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
    vehicle: { make, model, year },
  };
}

function vehicleFromName(make: string, model: string, year: string): VinScanVehicle | undefined {
  if (!make && !model && !year) return undefined;
  return { make, model, year };
}

export function parseCsddTechScan(result: CsddTechDataResult): VinScanParse {
  if (result.found) {
    const d = result.data;
    const name = [d.year, d.make, d.model].filter(Boolean).join(" ");
    const extras = [
      d.registrationNumber,
      d.inspectionValidUntilIso ? `TA līdz ${d.inspectionValidUntilIso}` : "",
    ].filter(Boolean);
    return {
      status: "found",
      summary: extras.length ? `${name || "Ir CSDD reģistrā"}, ${extras.join(", ")}` : name || "Ir CSDD reģistrā",
      vehicle: vehicleFromName(d.make, d.model, d.year),
    };
  }
  const msg = result.message.trim() || "CSDD datus neizdevās nolasīt";
  if (/relejs nav konfigurēts/i.test(msg)) return { status: "skipped", summary: msg };
  if (/netika atrasts|nav transportlīdzekļa datu|tukša/i.test(msg)) return { status: "none", summary: msg };
  return { status: "unknown", summary: msg };
}

export type CsddPlateLookupView = {
  ok: boolean;
  vin: string;
  make: string;
  model: string;
  year: string;
  status: string;
};

export function formatCsddPlateLookup(result: CsddTechDataResult): CsddPlateLookupView {
  if (!result.found) {
    return { ok: false, vin: "", make: "", model: "", year: "", status: result.message };
  }
  const d = result.data;
  const status = d.inspectionValidUntilIso
    ? `TA līdz ${d.inspectionValidUntilIso}`
    : d.registrationNumber || "Reģistrā";
  return { ok: true, vin: d.vin, make: d.make, model: d.model, year: d.year, status };
}

export function parseVinSourceScan(result: VinSourceFetchResult): VinScanParse {
  const mileage = result.mileage
    .map((row) => ({ date: row.date, odometer: row.odometer }))
    .filter((row) => row.date || row.odometer);
  const detail = [result.ownersSummary, result.statusRecords, ...result.notes].filter(Boolean).join("\n");
  if (result.found) {
    return {
      status: "found",
      summary: result.message,
      detail,
      mileage,
    };
  }
  const msg = result.message.trim() || "Avotu neizdevās nolasīt";
  if (
    /nav CAPSOLVER|VIN_SOURCES_BROWSER|tikai lokālajā vidē|relejs nav konfigurēts|nav MNT_RELAY|browser off/i.test(msg)
  ) {
    return { status: "skipped", summary: msg };
  }
  if (/nav .*reģistrā|neatrāda|netika atrasts|gadījumi nav atrasti|publiski strukturēti dati netika/i.test(msg)) {
    return { status: "none", summary: msg };
  }
  return { status: "unknown", summary: msg, detail };
}

export type PlcAuctionFacts = {
  title: string;
  location: string;
  saleDate: string;
  winningBid: string;
  mileage: string;
};

export function parsePlcAuctionFacts(text: string): { none: true } | PlcAuctionFacts | null {
  const flat = text.replace(/\u00a0/g, " ");
  if (/sorry,\s*could not find what you were looking for/i.test(flat)) return { none: true };
  const title =
    /([A-Za-z][A-Za-z0-9 ./-]*?,\s*\d{4}\s*\(\s*LOT\s*[№N#:]+\s*[^)]+\))/i
      .exec(flat)?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  if (!title) return null;
  const location = /Location:\s*([^\n]+)/i.exec(flat)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const saleDate =
    /Sale date:\s*([^\n]+)/i.exec(flat)?.[1]?.replace(/\s+/g, " ").trim() ||
    /Updated:\s*(\d{4}-\d{2}-\d{2})/i.exec(flat)?.[1]?.trim() ||
    "";
  const winningBid =
    /Winning bid:\s*([^\n]+)/i.exec(flat)?.[1]?.replace(/\s+/g, " ").trim() ||
    /Final bid:\s*([^\n]+)/i.exec(flat)?.[1]?.replace(/\s+/g, " ").trim() ||
    /Sold for:\s*([^\n]+)/i.exec(flat)?.[1]?.replace(/\s+/g, " ").trim() ||
    /Buy Now price[^0-9]{0,20}([0-9 \u00a0]+USD)/i.exec(flat)?.[1]?.replace(/\s+/g, " ").trim() ||
    "";
  const mileage = /Mileage:\s*([\d\s]+)\s*km/i.exec(flat)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  return { title, location, saleDate, winningBid, mileage };
}

export function vehicleFromPlcTitle(title: string): VinScanVehicle | undefined {
  const head = /^(.+?),\s*(\d{4})/.exec(title.trim());
  if (!head) return undefined;
  const parts = head[1].trim().split(/\s+/);
  return { make: parts[0] ?? "", model: parts.slice(1).join(" "), year: head[2] ?? "" };
}

export function classifyPlcAuction(text: string): VinScanParse | null {
  const parsed = parsePlcAuctionFacts(text);
  if (!parsed) return null;
  if ("none" in parsed) return { status: "none", summary: "Nav ierakstu" };
  const bits = [parsed.title, parsed.location, parsed.saleDate, parsed.winningBid].filter(Boolean);
  const km = parsed.mileage ? `${parsed.mileage} km` : "";
  return {
    status: "found",
    summary: bits.join(" · "),
    detail: [parsed.location && `Vieta: ${parsed.location}`, parsed.saleDate && `Datums: ${parsed.saleDate}`, parsed.winningBid && `Likme: ${parsed.winningBid}`, km && `Nobraukums: ${km}`]
      .filter(Boolean)
      .join("\n"),
    vehicle: vehicleFromPlcTitle(parsed.title),
    mileage: parsed.mileage && parsed.saleDate ? [{ date: parsed.saleDate, odometer: `${parsed.mileage} km` }] : undefined,
  };
}

export function classifyCheckcarVinText(text: string, vin: string): VinScanParse | null {
  const upperVin = vin.trim().toUpperCase();
  const hasVin = Boolean(upperVin) && text.toUpperCase().includes(upperVin);
  const photoCount = /(\d+)\s*(photos?|images?|pictures?|foto)/i.exec(text);
  const n = photoCount ? Number(photoCount[1]) : NaN;
  if (Number.isFinite(n) && n > 0) return { status: "found", summary: `${n} foto` };
  if (/no photos?( available)?|0 photos?|photos? not (available|found)|no images?|couldn.t find|didn.t find|vehicle not found|not found|no report|report not found|no records/i.test(text)) {
    return { status: "none", summary: "Atskaitē nav foto" };
  }
  if (hasVin && /photo|image|gallery|auction|mileage|odometer|lot|vehicle history|\breport\b/i.test(text)) {
    return { status: "found", summary: "Ir vēstures atskaite" };
  }
  return null;
}
