/**
 * Nils 30.10: «manuāla ielāde pēc kritērijiem» - panelī redzams, ko tieši meklēs mobile.de / AutoScout24,
 * pirms tiek tērēta nauda. Teksts no tā paša vaicājuma, ko saņem Apify.
 */

import type { MarketplaceQuery } from "@/lib/marketplace/types";

const nf = new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 0 });
const n = (v: number) => nf.format(v).replace(/ /g, " ");

function range(from: number | null, to: number | null, unit: string): string {
  const u = unit ? ` ${unit}` : "";
  if (from != null && to != null) return from === to ? `${n(from)}${u}` : `${n(from)}-${n(to)}${u}`;
  if (from != null) return `no ${n(from)}${u}`;
  if (to != null) return `līdz ${n(to)}${u}`;
  return "";
}

function yearRange(from: number | null, to: number | null): string {
  if (from != null && to != null) return from === to ? String(from) : `${from}-${to}`;
  if (from != null) return `no ${from}`;
  if (to != null) return `līdz ${to}`;
  return "";
}

const FUEL_LV: Record<string, string> = { diesel: "Dīzelis", petrol: "Benzīns", gasoline: "Benzīns", hybrid: "Hibrīds", electric: "Elektro", gas: "Gāze", lpg: "Gāze" };
const GEAR_LV: Record<string, string> = { automatic: "Automātiskā", manual: "Mehāniskā" };
const BODY_LV: Record<string, string> = {
  wagon: "Universālis",
  estate: "Universālis",
  sedan: "Sedans",
  limousine: "Sedans",
  hatchback: "Hečbeks",
  suv: "Apvidus (SUV)",
  coupe: "Kupeja",
  cabrio: "Kabriolets",
  convertible: "Kabriolets",
  van: "Furgons",
  minivan: "Minivens",
  pickup: "Pikaps",
};
const DRIVE_LV: Record<string, string> = { awd: "Pilnpiedziņa", "4x4": "Pilnpiedziņa", fwd: "Priekšpiedziņa", rwd: "Aizmugurpiedziņa" };

export function marketplaceQuerySummaryLv(q: MarketplaceQuery): string[] {
  const out: string[] = [];
  const car = [q.make, q.model].map((x) => x.trim()).filter(Boolean).join(" ");
  if (car) out.push(car);
  const years = yearRange(q.yearFrom, q.yearTo);
  if (years) out.push(years);
  const km = range(q.mileageFrom, q.mileageTo, "km");
  if (km) out.push(km);
  const price = range(q.priceFrom, q.priceTo, "€");
  if (price) out.push(price);
  const lv = (raw: string, map: Record<string, string>) =>
    raw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => map[x.toLowerCase()] ?? x)
      .join(" / ");
  if (q.fuel.trim()) out.push(lv(q.fuel, FUEL_LV));
  if (q.gearbox.trim()) out.push(GEAR_LV[q.gearbox.trim().toLowerCase()] ?? q.gearbox.trim());
  const kw = range(q.powerFromKw, q.powerToKw, "kW");
  if (kw) out.push(kw);
  const cc = range(q.displacementFromCc, q.displacementToCc, "cm3");
  if (cc) out.push(cc);
  if (q.body.trim()) out.push(lv(q.body, BODY_LV));
  if (q.drive.trim()) out.push(DRIVE_LV[q.drive.trim().toLowerCase()] ?? q.drive.trim());
  if (q.vehicleCategory === "van") out.push("Furgons");
  if (q.countries.length) out.push(q.countries.join(", "));
  return out;
}
