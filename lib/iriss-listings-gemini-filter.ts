import type { IrissListingAggregateItem, IrissListingSourcePlatform } from "@/lib/iriss-listings-types";

const PLATFORM_LABEL: Record<IrissListingSourcePlatform, string> = {
  mobile: "Mobile.de (Vācija)",
  autobid: "Autobid.de (Vācijas izsoles)",
  openline: "OpenLane (Eiropas izsoles)",
  auto1: "AUTO1.com (wholesale EU)",
  other: "Cits avots",
};

export function irissListingPlatformLabel(platform: IrissListingSourcePlatform): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

/** Salīdzinājuma sludinājumi no IRISS agregāta — pēc markas/modeļa/gada pavediena. */
export function pickIrissListingComps(
  items: IrissListingAggregateItem[],
  searchHints: string,
  max = 28,
): IrissListingAggregateItem[] {
  const ok = items.filter((i) => i.status === "ok");
  const hint = searchHints.trim().toLowerCase();
  const tokens = hint
    .split(/[\s,./|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !/^\d{4}$/.test(t));

  if (tokens.length === 0) {
    return ok.slice(0, max);
  }

  const scored = ok
    .map((item) => {
      const hay = `${item.title} ${item.orderBrandModel} ${item.year}`.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (hay.includes(t)) score += 1;
      }
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.item.aggregatedAt.localeCompare(a.item.aggregatedAt));

  if (scored.length >= 3) {
    return scored.slice(0, max).map((s) => s.item);
  }
  return ok.slice(0, max);
}

export function formatIrissListingsForGemini(items: IrissListingAggregateItem[]): string {
  if (items.length === 0) {
    return "### Eiropas izsoļu / wholesale portāli (IRISS)\nNav pieejamu salīdzinājuma ierakstu (sinhronizācija izslēgta vai tukša).";
  }
  const lines: string[] = [
    "### Eiropas izsoļu un wholesale portāli (IRISS — Mobile.de, Autobid, OpenLane, AUTO1)",
    `Salīdzinājuma ieraksti (${items.length}):`,
  ];
  for (const item of items) {
    const priceParts: string[] = [];
    if (item.pricePrimary?.value) {
      priceParts.push(`${item.pricePrimary.value} ${item.pricePrimary.currency}`.trim());
    }
    if (item.priceSecondary?.value) {
      priceParts.push(`sek. ${item.priceSecondary.value} ${item.priceSecondary.currency}`.trim());
    }
    const price = priceParts.length > 0 ? priceParts.join(", ") : "cena nav";
    lines.push(
      `- [${irissListingPlatformLabel(item.sourcePlatform)}] ${item.title.trim() || item.orderBrandModel.trim() || "—"} | gads: ${item.year.trim() || "—"} | ${price} | ${item.sourceUrl.trim()}`,
    );
  }
  return lines.join("\n");
}
