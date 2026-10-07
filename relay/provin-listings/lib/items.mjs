/** Vienots auto ieraksts, ko Vercel puse (`lib/iriss-listings-relay.ts`) pārveido par IrissFetchedVehicle. */

export function str(v) {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

export function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Cena > 0, citādi null. */
export function price(v) {
  const n = num(v);
  return n !== null && n > 0 ? Math.round(n) : null;
}

/** ISO vai ASP.NET `/Date(1696000000000)/`. */
export function isoDate(v) {
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v).toISOString();
  const s = str(v);
  if (!s) return "";
  const aspNet = s.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
  if (aspNet) return new Date(Number(aspNet[1])).toISOString();
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

export function yearOf(v) {
  const s = str(v);
  const m = s.match(/((?:19|20)\d{2})/);
  return m ? m[1] : "";
}

export function makeItem(platform, fields) {
  return {
    platform,
    externalId: str(fields.externalId),
    detailUrl: str(fields.detailUrl),
    title: str(fields.title),
    manufacturer: str(fields.manufacturer),
    year: str(fields.year),
    firstRegistration: str(fields.firstRegistration),
    mileageKm: fields.mileageKm ?? null,
    fuel: str(fields.fuel),
    transmission: str(fields.transmission),
    powerKw: str(fields.powerKw),
    location: str(fields.location),
    countryCode: str(fields.countryCode),
    imageUrl: str(fields.imageUrl),
    currency: str(fields.currency) || "EUR",
    priceStart: fields.priceStart ?? null,
    priceMinimal: fields.priceMinimal ?? null,
    priceCurrent: fields.priceCurrent ?? null,
    priceBuyNow: fields.priceBuyNow ?? null,
    vatNote: str(fields.vatNote),
    auctionId: str(fields.auctionId),
    auctionStartAt: str(fields.auctionStartAt),
    auctionEndAt: str(fields.auctionEndAt),
    auctionStage: str(fields.auctionStage),
  };
}
