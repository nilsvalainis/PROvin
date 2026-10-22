/**
 * /STOCK mapes info.txt un mapes nosaukuma parsēšana Autoparka lauku aizpildei.
 * Tikai aizpilda tukšus laukus - jau ievadītais (piem. IRISS aģenta šodien ievadītais) netiek pārrakstīts.
 */

import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { vinTail } from "@/lib/iriss-autoparks-dropbox-path";

export type AutoparksFillable = Partial<Pick<AutoparksCar, "vin" | "make" | "model" | "year" | "color" | "mileageKm">>;

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/;

/** "Volvo XC60 2013 sudrabs – 439274 – A1" -> marka, modelis, gads, krāsa. Neparauga nosaukumiem - tukšs. */
export function parseStockFolderName(name: string): AutoparksFillable {
  const parts = name.split(/\s+[–—-]\s+/).map((p) => p.trim());
  if (parts.length < 2) return {};
  const head = parts[0]!.split(/\s+/);
  const yearIdx = head.findIndex((w) => /^(19|20)\d{2}$/.test(w));
  if (yearIdx < 1) return {};
  const out: AutoparksFillable = {
    make: head[0]!,
    model: head.slice(1, yearIdx).join(" "),
    year: head[yearIdx]!,
  };
  const color = head.slice(yearIdx + 1).join(" ");
  if (color) out.color = color;
  const vin = parts.slice(1).join(" ").toUpperCase().match(VIN_RE)?.[1];
  if (vin) out.vin = vin;
  return out;
}

function num(raw: string): number | null {
  const n = Number(raw.replace(/[\s,.'](?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** info.txt (brīvs teksts no izsoles). Lasa VIN, izlaiduma gadu, nobraukumu, krāsu. */
export function parseStockInfoTxt(text: string): AutoparksFillable {
  const out: AutoparksFillable = {};
  const line = (re: RegExp) => text.match(re)?.[1]?.trim() ?? "";
  const vin = line(/^\s*VIN\s*[:\-]\s*([A-Z0-9]{11,17})/im).toUpperCase();
  if (vin) out.vin = vin;
  const year = line(/\b(?:Build year|Baujahr|Izlaiduma gads|Gads)\s*[:\-]\s*((?:19|20)\d{2})/i);
  if (year) out.year = year;
  const km = line(/\b(?:Odometer|Mileage|Kilometerstand|Nobraukums)\s*[:\-]\s*([\d\s.,']+)\s*km/i);
  if (km) {
    const n = num(km);
    if (n != null && n >= 0 && n < 3_000_000) out.mileageKm = Math.round(n);
  }
  const colour = line(/\b(?:Colour|Color|Farbe|Krāsa)\s*[:\-]\s*([^|(\n]+)/i);
  if (colour) out.color = colour;
  return out;
}

/**
 * Apvieno: mapes nosaukums (latviski, uzticamāks) pirms info.txt. VIN no info.txt der tikai,
 * ja tas sakrīt ar auto VIN pēdējiem 6 (vai auto VIN vēl nav).
 */
export function fillAutoparksFromStock(
  car: Pick<AutoparksCar, "vin" | "make" | "model" | "year" | "color" | "mileageKm">,
  folderName: string,
  infoTxt: string | null,
): AutoparksFillable {
  const fromFolder = parseStockFolderName(folderName);
  const fromInfo = infoTxt ? parseStockInfoTxt(infoTxt) : {};
  const patch: AutoparksFillable = {};
  const pick = <K extends keyof AutoparksFillable>(k: K) => fromFolder[k] ?? fromInfo[k];
  const vinCandidate = fromInfo.vin && fromInfo.vin.length === 17 ? fromInfo.vin : fromFolder.vin;
  if (!car.vin.trim() && vinCandidate) patch.vin = vinCandidate;
  else if (car.vin.trim() && vinCandidate && vinTail(car.vin) !== vinTail(vinCandidate)) return {};
  for (const k of ["make", "model", "year", "color"] as const) {
    const v = pick(k);
    if (!car[k].trim() && typeof v === "string" && v.trim()) patch[k] = v.trim();
  }
  if (car.mileageKm == null && fromInfo.mileageKm != null) patch.mileageKm = fromInfo.mileageKm;
  return patch;
}
