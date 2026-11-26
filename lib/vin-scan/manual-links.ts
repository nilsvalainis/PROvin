/**
 * «Atvērt pārlūkā» saites avotiem, ko serveris vairs automātiski neprasa (`VIN_SCAN_LINK_ONLY_IDS`, 26.11 audits).
 * Tie nav rindas avotu sarakstā un neskaitās «N/M OK · pārlūks». Tīra loģika (klients + serveris).
 */
import {
  VIN_SCAN_CATALOG,
  VIN_SCAN_LINK_ONLY_IDS,
  vinScanSourceLinkOnly,
  type VinScanSourceId,
} from "@/lib/vin-scan/catalog";
import { emptyVinScanPlates, type VinScanPlates } from "@/lib/vin-scan/plates";
import { oemBrandForVin } from "@/lib/vin-scan/parse-extra";
import { oemRecallLinkBrandForVin, type OemRecallLinkBrand } from "@/lib/vin-scan/oem-recall-links";
import { isUsWmiVin } from "@/lib/vin-scan/vin-decode";

export type VinScanManualLink = { id: VinScanSourceId; label: string; href: string };

const RECALL_BRAND: Partial<Record<VinScanSourceId, string>> = {
  recall_vw: "vw",
  recall_bmw: "bmw",
  recall_mercedes: "mercedes",
  recall_volvo: "volvo",
  recall_toyota: "toyota",
};

const RECALL_LINK_BRAND: Partial<Record<VinScanSourceId, OemRecallLinkBrand>> = {
  recall_kia: "kia",
  recall_skoda: "skoda",
  recall_audi: "audi",
  recall_seat: "seat",
  recall_stellantis: "stellantis",
  recall_ford: "ford",
};

/** Kanādas CPIC / IBC: jēga tikai Ziemeļamerikas (ASV/CA/MX) VIN. */
const NORTH_AMERICA_LINK_IDS = new Set<VinScanSourceId>(["ca_cpic", "ca_ibc"]);

/** Ražotāja atsaukumu saite tikai tai markai, ko rāda WMI (viena, nevis piecas rindas). */
export function vinScanManualLinks(vin: string, plates: VinScanPlates = emptyVinScanPlates()): VinScanManualLink[] {
  const clean = vin.trim().toUpperCase();
  if (clean.length < 11) return [];
  const brand = oemBrandForVin(clean);
  const linkBrand = oemRecallLinkBrandForVin(clean);
  const northAmerica = isUsWmiVin(clean);
  const out: VinScanManualLink[] = [];
  for (const id of VIN_SCAN_LINK_ONLY_IDS) {
    const recallBrand = RECALL_BRAND[id];
    if (recallBrand && recallBrand !== brand) continue;
    const extraBrand = RECALL_LINK_BRAND[id];
    if (extraBrand && extraBrand !== linkBrand) continue;
    if (NORTH_AMERICA_LINK_IDS.has(id) && !northAmerica) continue;
    const item = VIN_SCAN_CATALOG.find((row) => row.id === id);
    if (!item) continue;
    const href = item.openUrl(clean, plates).trim();
    if (!href) continue;
    out.push({ id, label: item.label, href });
  }
  return out;
}

/** Saglabātā momentuzņēmuma rinda no saites avota paliek redzama tikai ar reāliem datiem (piem. pārlūka imports). */
export function vinScanLinkOnlyRowVisible(id: string, status: string): boolean {
  if (!vinScanSourceLinkOnly(id)) return true;
  return status === "found";
}
