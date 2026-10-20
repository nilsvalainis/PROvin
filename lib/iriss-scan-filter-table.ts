import type { IrissAuctionLogoKey } from "@/lib/iriss-auction-logos";
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import { parseListingSearchUrl } from "@/lib/iriss-listings-ecarstrade-search";
import { IRISS_SCAN_SOURCES, type IrissScanFilterPlatform, type IrissScanLinkKey } from "@/lib/iriss-scan-sources";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

export type IrissScanFilterTableAction = "open" | "create";

export type IrissScanFilterTableRow = {
  key: IrissScanLinkKey;
  platform: IrissScanFilterPlatform;
  logoKey: IrissAuctionLogoKey;
  label: string;
  description: string;
  status: string;
  action: IrissScanFilterTableAction;
  href: string | null;
  linkCount: number;
  filterCount: number;
  paidManual: boolean;
};

function isSearchFilterUrl(url: string): boolean {
  const f = parseListingSearchUrl(url);
  return Boolean(
    f.makeNames.length ||
      f.modelName ||
      f.yearFrom != null ||
      f.yearTo != null ||
      f.powerFromKw != null ||
      f.powerToKw != null ||
      f.priceFrom != null ||
      f.priceTo != null ||
      f.mileageFrom != null ||
      f.mileageTo != null ||
      f.fuels.length ||
      f.gearboxes.length ||
      f.bodies.length,
  );
}

function shortFilterDescription(url: string, fallbackBrand: string): string {
  const f = parseListingSearchUrl(url);
  const brand = f.makeNames[0] || fallbackBrand.trim();
  const model = (f.modelName ?? "").trim();
  const name = [brand, model].filter(Boolean).join(" ");
  const kwFrom = f.powerFromKw;
  const kwTo = f.powerToKw;
  if (name && kwFrom != null && kwTo != null && kwFrom === kwTo) return `${name} ${kwFrom} kW`;
  if (name && kwFrom != null && kwTo != null) return `${name} ${kwFrom}-${kwTo} kW`;
  if (name && kwFrom != null) return `${name} ${kwFrom} kW`;
  if (name) return name;
  if (kwFrom != null && kwTo != null) return `${kwFrom}-${kwTo} kW`;
  return "";
}

function emptyDescription(platform: IrissScanFilterPlatform): string {
  if (platform === "mobilede") return "Manuāli, maksas";
  if (platform === "autoscout24") return "Nav filtra";
  return "Nav filtra";
}

function statusLabel(linkCount: number, filterCount: number): string {
  if (linkCount <= 0) return "-";
  if (filterCount >= linkCount) return `OK ${filterCount}/${linkCount}`;
  if (filterCount > 0) return `Daļēji ${filterCount}/${linkCount}`;
  return `${linkCount} saites`;
}

export function irissScanBudgetFromFilters(rec: Pick<IrissScanRecord, IrissScanLinkKey>): number | null {
  let max: number | null = null;
  for (const s of IRISS_SCAN_SOURCES) {
    for (const url of filledIrissListingLinks(rec[s.key])) {
      const to = parseListingSearchUrl(url).priceTo;
      if (to != null && to > 0 && (max == null || to > max)) max = to;
    }
  }
  return max;
}

export function irissScanFilterTableRows(
  rec: Pick<IrissScanRecord, IrissScanLinkKey | "brandModel">,
): IrissScanFilterTableRow[] {
  const brand = rec.brandModel.trim();
  return IRISS_SCAN_SOURCES.map((s) => {
    const links = filledIrissListingLinks(rec[s.key]);
    const filters = links.filter(isSearchFilterUrl);
    const href = links[0] ?? null;
    const paidManual = s.filterPlatform === "mobilede" || s.filterPlatform === "autoscout24";
    let description = emptyDescription(s.filterPlatform);
    if (links.length > 0) {
      const fromUrl = filters.map((u) => shortFilterDescription(u, brand)).find(Boolean);
      if (links.length > 1 && brand) description = `${links.length} saites · ${brand}`;
      else if (fromUrl) description = fromUrl;
      else if (brand) description = brand;
      else if (paidManual) description = "Manuāli, maksas";
      else description = `${links.length} ${links.length === 1 ? "saite" : "saites"}`;
    }
    return {
      key: s.key,
      platform: s.filterPlatform,
      logoKey: s.logoKey,
      label: s.label,
      description,
      status: statusLabel(links.length, filters.length),
      action: href ? "open" : "create",
      href,
      linkCount: links.length,
      filterCount: filters.length,
      paidManual,
    };
  });
}
