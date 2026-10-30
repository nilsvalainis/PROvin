/**
 * j70: importa dati -> piedāvājuma auto lauki (tīra loģika). Visi lauki pēc tam rediģējami.
 */

import type { IrissAuctionDetailExtras } from "@/lib/iriss-auction-detail";
import type { OfferSeedFields } from "@/lib/iriss-offer-seed";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";
import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";
import { emptyIrissPdVehicle, IRISS_PD_MAX_PHOTOS, type IrissPdPhoto, type IrissPdSource, type IrissPdVehicle } from "@/lib/iriss-piedavajumi-types";

const s = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

export function irissPdVehicleFromSeed(f: OfferSeedFields): IrissPdVehicle {
  return {
    ...emptyIrissPdVehicle(),
    title: s(f.brandModel),
    vin: s(f.vin).toUpperCase(),
    year: s(f.year),
    firstRegistration: s(f.firstRegistration),
    mileageKm: s(f.odometerReading) || s(f.mileage),
    fuel: s(f.fuel),
    transmission: s(f.transmission),
    powerKw: s(f.powerKw),
    engine: s(f.engineDisplacement),
    color: s(f.color),
    body: s(f.bodyTypeOffer),
    location: s(f.location),
  };
}

export function irissPdVehicleFromHit(hit: IrissOrderRoomHit, extras: IrissAuctionDetailExtras | null): IrissPdVehicle {
  return {
    ...emptyIrissPdVehicle(),
    title: s(hit.title),
    vin: s(hit.vin).toUpperCase(),
    year: s(hit.year),
    firstRegistration: s(hit.firstRegistration),
    mileageKm: hit.mileageKm != null && hit.mileageKm > 0 ? String(Math.round(hit.mileageKm)) : "",
    fuel: s(hit.fuel),
    transmission: s(hit.transmission),
    powerKw: s(hit.powerKw),
    engine: s(extras?.engineDisplacement),
    color: s(hit.color),
    body: s(hit.bodyType),
    location: s(hit.location),
  };
}

// Nils 30.10: izsoles lapā ir arī citu auto bildes («līdzīgie», kājene) un tā pati bilde vairākos izmēros.
const AUTO1_FILE = /\/(?:(max|sr-x2|sr|[a-z0-9-]+)-)?([A-Z]{2}\d{5})_([0-9a-f]{32})\.(?:jpe?g|png|webp)$/i;
const AUTO1_VARIANT_RANK: Record<string, number> = { max: 3, "sr-x2": 2, "": 1 };
const OPENLANE_CAR = /\/carimgs\/(\d+)\//i;
const NOT_A_CAR_PHOTO = /\.(svg|gif)(\?|$)|(^|[/_.-])(logo|icon|sprite|flag|badge|banner|footer|placeholder|avatar|payment)([/_.-]|$)/i;

type PhotoCandidate = { url: string; key: string; rank: number };

function photoCandidate(url: string, mainAuto1: string, mainOpenlane: string): PhotoCandidate | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  if (NOT_A_CAR_PHOTO.test(path)) return null;
  if (host.endsWith("auto1.com")) {
    const m = path.match(AUTO1_FILE);
    if (!m) return { url, key: `${host}${path}`.toLowerCase(), rank: 0 };
    const [, variant = "", stock, hash] = m;
    if (mainAuto1 && stock!.toUpperCase() !== mainAuto1) return null; // cita auto bilde («līdzīgie auto»)
    return { url, key: `auto1:${stock!.toUpperCase()}:${hash!.toLowerCase()}`, rank: AUTO1_VARIANT_RANK[variant.toLowerCase()] ?? 0 };
  }
  if (host.endsWith("openlane.eu")) {
    if (/\/thumbnail\//i.test(path)) return null; // kājenes «citi auto» sīktēli
    const m = path.match(OPENLANE_CAR);
    if (m && mainOpenlane && m[1] !== mainOpenlane) return null;
    return { url, key: `${host}${path}`.toLowerCase(), rank: 1 };
  }
  return { url, key: `${host}${path}`.toLowerCase(), rank: 1 };
}

/** Galvenā auto atslēga: pirmās bildes Auto1 krājuma kods / Openlane auto id. */
function mainPhotoIds(urls: readonly string[]): { auto1: string; openlane: string } {
  let auto1 = "";
  let openlane = "";
  for (const raw of urls) {
    try {
      const u = new URL(raw.trim());
      if (!auto1 && u.hostname.toLowerCase().endsWith("auto1.com")) auto1 = u.pathname.match(AUTO1_FILE)?.[2]?.toUpperCase() ?? "";
      if (!openlane && u.hostname.toLowerCase().endsWith("openlane.eu")) openlane = u.pathname.match(OPENLANE_CAR)?.[1] ?? "";
    } catch {
      /* nederīga adrese */
    }
    if (auto1 && openlane) break;
  }
  return { auto1, openlane };
}

/**
 * Izsoles bildes (līdz 60): tikai šī auto bildes, bez logo / kājenes, bez dublikātiem.
 * Ja viena bilde ir vairākos izmēros, paliek lielākā, vietā, kur tā parādījās pirmo reizi.
 */
export function irissPdPhotosFromUrls(urls: readonly string[]): IrissPdPhoto[] {
  const clean = urls.map((u) => u.trim()).filter((t) => /^https:\/\//i.test(t) && t.length <= 2000);
  const main = mainPhotoIds(clean);
  const order: string[] = [];
  const best = new Map<string, PhotoCandidate>();
  for (const url of clean) {
    const c = photoCandidate(url, main.auto1, main.openlane);
    if (!c) continue;
    const prev = best.get(c.key);
    if (!prev) {
      order.push(c.key);
      best.set(c.key, c);
    } else if (c.rank > prev.rank) best.set(c.key, c);
  }
  return order.slice(0, IRISS_PD_MAX_PHOTOS).map((k) => ({ kind: "url", url: best.get(k)!.url }));
}

export function irissPdFilledCount(v: IrissPdVehicle): number {
  return Object.values(v).filter((x) => x.trim()).length;
}

/** Izsoles cena -> iekšējā iepirkuma cena (klients to neredz). */
export function irissPdPurchaseFromHit(hit: Pick<IrissOrderRoomHit, "priceBuyNow" | "priceCurrent" | "price">): string {
  const n = hit.priceBuyNow ?? hit.priceCurrent ?? hit.price;
  return n != null && Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
}

export type IrissPdImport = {
  source: IrissPdSource;
  sourceRef: string;
  sourceUrl: string;
  sourceKey: string;
  vehicle: IrissPdVehicle;
  photos: IrissPdPhoto[];
  price: string;
  purchasePrice: string;
  auto1: IrissPdAuto1Blocks | null;
  fieldCount: number;
  /** Vēstures teksts «Izveidots no Auto1 saites · 22 lauki». */
  historyText: string;
  /** Brīdinājums UI (piem. bildes nav, stub). */
  note: string;
};

/**
 * Pieprasījumu (vai tukšu melnrakstu) aizpilda ar importu: auto, foto, avots, Auto1 bloki.
 * Klients, termiņš un statuss paliek; cena tikai, ja vēl nav ievadīta.
 */
export function applyIrissPdImportData<T extends {
  source: IrissPdSource;
  sourceRef: string;
  sourceUrl: string;
  sourceKey: string;
  importedFieldCount: number;
  vehicle: IrissPdVehicle;
  photos: IrissPdPhoto[];
  price: string;
  purchasePrice: string;
  auto1: IrissPdAuto1Blocks | null;
  auto1ImportedAt: string;
}>(rec: T, imp: IrissPdImport, at: string): T {
  return {
    ...rec,
    source: imp.source,
    sourceRef: imp.sourceRef,
    sourceUrl: imp.sourceUrl,
    sourceKey: imp.sourceKey,
    importedFieldCount: imp.fieldCount,
    vehicle: imp.vehicle,
    photos: imp.photos,
    price: rec.price.trim() ? rec.price : imp.price,
    purchasePrice: imp.purchasePrice || rec.purchasePrice,
    auto1: imp.auto1,
    auto1ImportedAt: imp.auto1 ? at : "",
  };
}

/** "2012-03-30" -> "30.03.2012"; citādi bez izmaiņām. */
function lvDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : v.trim();
}

export type IrissPdAutoparksFacts = {
  year?: string;
  firstRegDate?: string;
  mileageKm?: number | null;
  fuel?: string;
  gearbox?: string;
  powerKw?: number | null;
  displacementCm3?: number | null;
  color?: string;
};

/**
 * Nils 28.10: «daļa datu nav ielasījušies automātiski». Piedāvājums no Autoparka ņēma tikai vecā ieraksta laukus;
 * tukšos aizpilda no Autoparka Pamatdatiem / CSDD. Gads vienmēr 4 cipari, datums DD.MM.GGGG.
 */
export function irissPdFillFromAutoparks(v: IrissPdVehicle, f: IrissPdAutoparksFacts): IrissPdVehicle {
  const num = (n: number | null | undefined) => (n != null && Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "");
  const firstReg = lvDate(v.firstRegistration || f.firstRegDate || "");
  const yearRaw = (v.year || f.year || "").trim();
  const year = /^\d{4}$/.test(yearRaw) ? yearRaw : (/(\d{4})/.exec(yearRaw)?.[1] ?? /(\d{4})$/.exec(firstReg)?.[1] ?? "");
  return {
    ...v,
    year,
    firstRegistration: firstReg,
    mileageKm: v.mileageKm || num(f.mileageKm),
    fuel: v.fuel || (f.fuel ?? "").trim(),
    transmission: v.transmission || (f.gearbox ?? "").trim(),
    powerKw: v.powerKw || num(f.powerKw),
    engine: v.engine || num(f.displacementCm3),
    color: v.color || (f.color ?? "").trim(),
  };
}

/** Tikai tukšie lauki no `src` (esošos, ar roku labotos, nepārraksta). */
export function irissPdFillEmpty(cur: IrissPdVehicle, src: IrissPdVehicle): IrissPdVehicle {
  const out = { ...cur };
  for (const k of Object.keys(cur) as Array<keyof IrissPdVehicle>) if (!cur[k].trim() && src[k].trim()) out[k] = src[k];
  return out;
}
