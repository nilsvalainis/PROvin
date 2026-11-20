/**
 * Autobid saite -> piedāvājuma importa dati (Nils 20.11: PD no Autobid saites bija tukšs - Autobid bija «stub»).
 * Releja `/detail` Autobid neatbalsta, tāpēc dati nāk no tā, kas jau ir:
 *   1) IRISS Sludinājumi (tas pats auto pēc Autobid item id): nosaukums, lauki, foto, cena;
 *   2) releja `/lot-vins` (ielogota lotes lapa): VIN, nobraukums, 1. reģistrācija, lapas virsraksts;
 *   3) ja nekas nav nolasīts - nosaukums no saites (`/item/audi-q5-2-0-tdi-quattro-3635359`).
 * Tīra loģika bez tīkla, lai testi strādā bez mock.
 */

import { irissPdFilledCount, type IrissPdImport } from "@/lib/iriss-piedavajumi-import";
import type { IrissPdDetectedLink } from "@/lib/iriss-piedavajumi-sources";
import { emptyIrissPdVehicle, type IrissPdVehicle } from "@/lib/iriss-piedavajumi-types";
import type { LotVinRelayResult, LotVinRelayRow } from "@/lib/vin-memory-lot-vins";

/** Tā pati forma, ko pieņem releja `/lot-vins` (validLotUrl autobid). */
export function autobidLotPageUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !/(^|\.)autobid\.(de|eu)$/i.test(u.hostname)) return "";
    if (!/\/item\/[a-z0-9][a-z0-9-]*(?:\/details)?\/?$/i.test(u.pathname)) return "";
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}

/** Lapas `<title>` -> auto nosaukums (bez « | Autobid.de»); vispārīgi virsraksti -> "". */
export function autobidTitleFromPage(raw: string): string {
  const t = String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*[|–—-]\s*autobid(?:\.(?:de|eu))?.*$/i, "")
    .replace(/^autobid(?:\.(?:de|eu))?\s*[|–—-]\s*/i, "")
    .trim();
  if (!t || /^(autobid(\.(de|eu))?|login|anmelden|sign in|page not found|404.*|search results?|suchergebnisse)$/i.test(t)) return "";
  return t.slice(0, 160);
}

/** `/item/audi-q5-2-0-tdi-quattro-3635359/details` -> «Audi Q5 2.0 TDI Quattro» (pēdējā iespēja). */
export function autobidTitleFromUrl(raw: string): string {
  let path = "";
  try {
    path = new URL(raw).pathname;
  } catch {
    return "";
  }
  const m = path.match(/\/item\/([a-z0-9-]+?)-\d{4,}(?:[/?]|$)/i);
  if (!m) return "";
  const slug = m[1]!.replace(/(^|-)(\d)-(\d)(?=-|$)/g, "$1$2.$3");
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => (/\d/.test(w) || w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
    .slice(0, 160);
}

function yearFrom(s: string): string {
  const m = s.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  return m ? m[1]! : "";
}

function lotNote(lot: LotVinRelayResult | null): string {
  if (!lot) return "";
  if (lot.status === "login_required") return "Autobid sesija relejā beigusies - vajag atkārtotu Autobid pieslēgšanos; pārējo aizpildi ar roku.";
  if (lot.status === "daily_limit") return "Releja dienas limits Autobid lapām - pārējo aizpildi ar roku.";
  if (lot.status === "blocked_by_waf") return "Autobid bloķēja lapas nolasīšanu - aizpildi ar roku.";
  if (lot.status === "fetch_failed") return "Autobid lapa netika nolasīta - aizpildi ar roku.";
  return "";
}

/**
 * Apvieno Sludinājumu ierakstu (ja auto tur ir) ar `/lot-vins` rindu. Sludinājuma lauki ir bāze,
 * lotes lapa aizpilda tukšos (VIN, nobraukums, 1. reģ., nosaukums).
 */
export function irissPdAutobidImport(
  link: IrissPdDetectedLink,
  listing: IrissPdImport | null,
  lot: LotVinRelayResult | null,
): IrissPdImport {
  const vehicle: IrissPdVehicle = { ...emptyIrissPdVehicle(), ...(listing?.vehicle ?? {}) };
  const row: LotVinRelayRow | null =
    lot && lot.status === "ok" ? (lot.results.find((r) => r.status === "ok" || r.status === "no_vin") ?? null) : null;
  if (row) {
    if (!vehicle.vin.trim() && row.vin) vehicle.vin = row.vin;
    if (!vehicle.mileageKm.trim() && row.mileageKm != null && row.mileageKm > 0) vehicle.mileageKm = String(row.mileageKm);
    if (!vehicle.firstRegistration.trim() && row.firstRegistration) vehicle.firstRegistration = row.firstRegistration;
    if (!vehicle.title.trim()) vehicle.title = autobidTitleFromPage(row.title);
  }
  if (!vehicle.year.trim()) vehicle.year = yearFrom(vehicle.firstRegistration);
  if (!vehicle.title.trim()) vehicle.title = autobidTitleFromUrl(link.url);

  const fieldCount = irissPdFilledCount(vehicle);
  const photos = listing?.photos ?? [];
  const parts: string[] = [];
  const readNote = row ? "" : lotNote(lot);
  if (readNote) parts.push(readNote);
  if (!listing) parts.push("Auto nav IRISS Sludinājumos - foto un cenu pievieno ar roku.");
  else if (!photos.length) parts.push("Foto nav - pievieno ar roku.");
  return {
    source: "autobid",
    sourceRef: "",
    sourceUrl: link.url,
    sourceKey: link.key,
    vehicle,
    photos,
    price: "",
    purchasePrice: listing?.purchasePrice ?? "",
    auto1: null,
    fieldCount,
    historyText: `Izveidots no Autobid saites · ${fieldCount} lauki${photos.length ? `, ${photos.length} foto` : ""}`,
    note: parts.join(" "),
  };
}
