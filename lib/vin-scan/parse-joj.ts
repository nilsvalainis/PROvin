/**
 * JoJ Copart/IAAI `/search-vin/{vin}` JSON → VIN SCAN lots.
 * Forma no JoJ/Car Stat dokumentācijas (data + lots[]). Bez tīkla.
 */

import type { VinScanAuction, VinScanMileage, VinScanParse, VinScanVehicle } from "@/lib/vin-scan/types";

export const JOJ_NOT_CONFIGURED = "nav konfigurēts";

const PHOTO_MAX = 20;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function named(v: unknown): string {
  const rec = asRecord(v);
  return str(rec.name);
}

function venueFromDomain(domain: unknown): "Copart" | "IAAI" | "" {
  const rec = asRecord(domain);
  const name = str(rec.name).toLowerCase();
  const id = rec.id;
  if (name.includes("copart") || id === 3) return "Copart";
  if (name.includes("iaai") || name.includes("iaa") || id === 1) return "IAAI";
  return "";
}

function saleDate(raw: unknown): string {
  const s = str(raw);
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return iso?.[1] ?? s.slice(0, 32);
}

function formatUsd(n: unknown): string {
  const v = typeof n === "number" ? n : Number(str(n).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(v) || v <= 0) return "";
  return `${Math.round(v).toLocaleString("lv-LV")} USD`;
}

function kmLv(km: unknown, mi: unknown): string {
  const k = typeof km === "number" ? km : Number(str(km).replace(/[^\d.]/g, ""));
  if (Number.isFinite(k) && k > 0) return `${Math.round(k).toLocaleString("lv-LV")} km`;
  const m = typeof mi === "number" ? mi : Number(str(mi).replace(/[^\d.]/g, ""));
  if (Number.isFinite(m) && m > 0) return `${Math.round(m * 1.60934).toLocaleString("lv-LV")} km`;
  return "";
}

function damageLabel(damage: unknown): string {
  const rec = asRecord(damage);
  const main = named(rec.main);
  const second = named(rec.second);
  return [main, second].filter(Boolean).join(" / ");
}

function photoList(images: unknown): string[] {
  const rec = asRecord(images);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown) => {
    for (const item of asArray(raw)) {
      const url = str(item);
      if (!url.startsWith("https://") || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      if (out.length >= PHOTO_MAX) return;
    }
  };
  push(rec.downloaded);
  if (out.length < PHOTO_MAX) push(rec.big);
  if (out.length < PHOTO_MAX) push(rec.normal);
  return out.slice(0, PHOTO_MAX);
}

function lotOpenUrl(venue: string, lot: string, vin: string): string {
  if (venue === "Copart" && lot) return `https://www.copart.com/lot/${encodeURIComponent(lot)}`;
  if (venue === "IAAI" && lot) return `https://www.iaai.com/Search?Keyword=${encodeURIComponent(lot)}`;
  return `https://www.copart.com/lotSearchResults/?free=true&query=${encodeURIComponent(vin)}`;
}

export function jojSearchVinUrl(vin: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/search-vin/${encodeURIComponent(vin.trim().toUpperCase())}`;
}

export function parseJojSearchVin(input: {
  status: number;
  json: unknown;
  vin: string;
}): VinScanParse {
  const vin = input.vin.trim().toUpperCase();
  if (input.status === 404) {
    return { status: "none", summary: "Nav izsoles ieraksta" };
  }
  if (input.status === 423) {
    return { status: "unknown", summary: "Copart/IAAI ieraksts ir ierobežots" };
  }
  if (input.status === 401 || input.status === 403) {
    return { status: "unknown", summary: "JoJ API atslēga nederīga vai nav pieejas" };
  }
  if (input.status === 429) {
    return { status: "unknown", summary: "JoJ API limits (1 req/s)" };
  }
  if (input.status >= 400) {
    return { status: "unknown", summary: `JoJ API HTTP ${input.status}` };
  }

  const root = asRecord(input.json);
  const data = asRecord(root.data && typeof root.data === "object" ? root.data : root);
  const lots = asArray(data.lots);
  const vehicle: VinScanVehicle | undefined = (() => {
    const year = str(data.year);
    const make = named(data.manufacturer) || str(data.make);
    const model = named(data.model) || str(data.model);
    if (!year && !make && !model) return undefined;
    return { make, model, year };
  })();

  const auctions: VinScanAuction[] = [];
  const mileage: Omit<VinScanMileage, "source">[] = [];
  const photos: string[] = [];
  const seenPhoto = new Set<string>();
  let openUrl = "";

  for (const raw of lots) {
    const lot = asRecord(raw);
    const venue = venueFromDomain(lot.domain);
    const lotNo = str(lot.lot);
    const date = saleDate(lot.sale_date);
    const odo = asRecord(lot.odometer);
    const odometer = kmLv(odo.km, odo.mi);
    const damage = damageLabel(lot.damage);
    const price = formatUsd(lot.final_bid) || formatUsd(lot.bid);
    const lotPhotos = photoList(lot.images);
    for (const url of lotPhotos) {
      if (seenPhoto.has(url) || photos.length >= PHOTO_MAX) continue;
      seenPhoto.add(url);
      photos.push(url);
    }
    const title = [venue || "Izsole", lotNo ? `lots ${lotNo}` : "", damage, odometer].filter(Boolean).join(" · ");
    auctions.push({
      title: title.slice(0, 180) || "Izsoles ieraksts",
      date: date || undefined,
      price: price || undefined,
      venue: venue || undefined,
      photoUrl: lotPhotos[0],
      photoCount: lotPhotos.length || undefined,
    });
    if (odometer && date) mileage.push({ date, odometer });
    if (!openUrl) openUrl = lotOpenUrl(venue, lotNo, vin);
  }

  if (!auctions.length) {
    return {
      status: "none",
      summary: "Nav izsoles ieraksta",
      vehicle,
    };
  }

  const first = auctions[0];
  const venue = first?.venue || "";
  const year = first?.date?.slice(0, 4) || vehicle?.year || "";
  const bits = [venue, year, photos.length ? `${photos.length} foto` : auctions.length > 1 ? `${auctions.length} lots` : ""].filter(
    Boolean,
  );
  return {
    status: "found",
    summary: bits.join(", ") || "Ir izsoles ieraksts",
    vehicle,
    auctions: auctions.slice(0, 12),
    mileage: mileage.slice(0, 12),
    media: {
      photoUrl: photos[0],
      photoCount: photos.length,
      photoUrls: photos,
    },
    flags: { photoCount: photos.length },
    openUrl: openUrl || undefined,
  };
}
