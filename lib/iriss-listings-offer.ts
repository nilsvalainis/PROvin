import { classifyListingDamage } from "@/lib/iriss-listings-damage";

export type ListingOfferVehicle = {
  title: string;
  year: string;
  mileageKm: number | null;
  fuel: string;
  transmission: string;
  powerKw: string;
  location: string;
  countryCode: string;
  vin?: string;
  stockNumber?: string;
  platform: string;
  detailUrl: string;
  externalId: string;
};

const GEAR_LV: Record<string, string> = {
  Automatic: "automātiskā ātrumkārba",
  Automatik: "automātiskā ātrumkārba",
  Automāts: "automātiskā ātrumkārba",
  Manual: "manuālā ātrumkārba",
  Manuell: "manuālā ātrumkārba",
  Manuālā: "manuālā ātrumkārba",
};

function kmf(n: number | null): string {
  return n == null ? "nav norādīts" : `${Math.round(n).toLocaleString("lv-LV")} km`;
}

export function listingOfferText(v: ListingOfferVehicle): string {
  const kw = Number.parseFloat(v.powerKw);
  const hp = Number.isFinite(kw) ? ` (${Math.round(kw * 1.36)} ZS)` : "";
  const gear = GEAR_LV[v.transmission] ?? (v.transmission ? v.transmission.toLowerCase() : "nav norādīta");
  const lines = [
    `${v.title}${v.year ? `, ${v.year}. gads` : ""}`,
    "",
    `Nobraukums: ${kmf(v.mileageKm)}`,
    v.fuel || v.powerKw ? `Motors: ${[v.fuel.toLowerCase(), v.powerKw ? `${v.powerKw} kW${hp}` : ""].filter(Boolean).join(", ")}` : "",
    `Ātrumkārba: ${gear}`,
    v.location ? `Atrašanās: ${v.location}` : "",
    "",
    "Auto atrodas Eiropā, piegāde uz Latviju. Gala cenu, vēsturi un tehniskā stāvokļa pārskatu sagatavosim pēc pieprasījuma.",
    "",
    "Dzintarzeme Auto",
  ];
  return lines.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");
}

export function listingOfferLeaks(text: string, v: ListingOfferVehicle): string[] {
  const out: string[] = [];
  if (/€|\beur\b|\d[\s\u00a0]?\d{3}[\s\u00a0]?(?:eur|€)/i.test(text)) out.push("cena");
  if (/https?:\/\/|www\./i.test(text)) out.push("saite");
  if (/autobid|openlane|openline|auto1/i.test(text)) out.push("platforma");
  const ids = [v.vin, v.stockNumber, v.externalId].filter((x): x is string => Boolean(x && x.length >= 5));
  if (ids.some((id) => text.toUpperCase().includes(id.toUpperCase()))) out.push("ID");
  if (classifyListingDamage(text).status === "hit") out.push("bojājumi");
  return out;
}

export function listingOfferSlug(title: string, year: string): string {
  return `${title}-${year}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
