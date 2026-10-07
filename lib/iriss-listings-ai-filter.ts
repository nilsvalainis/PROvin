import type { IrissListingPlatform, IrissListingVehicle } from "@/lib/iriss-listings-types";

const PLATFORM_LABEL: Record<IrissListingPlatform, string> = {
  autobid: "Autobid.de (Vācijas izsoles)",
  openline: "OpenLane (Eiropas izsoles)",
  auto1: "AUTO1.com (wholesale EU)",
};

export function irissListingPlatformLabel(platform: IrissListingPlatform): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

function formatEur(n: number | null): string {
  if (n === null) return "";
  return `${Math.round(n).toLocaleString("lv-LV").replace(/\u00a0/g, " ")} EUR`;
}

/** Salīdzinājuma auto no IRISS izsoļu agregāta pēc markas / modeļa / gada pavediena. */
export function pickIrissListingComps(vehicles: IrissListingVehicle[], searchHints: string, max = 28): IrissListingVehicle[] {
  const live = vehicles.filter((v) => v.change !== "gone");
  const hint = searchHints.trim().toLowerCase();
  const tokens = hint
    .split(/[\s,./|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !/^\d{4}$/.test(t));

  if (tokens.length === 0) return live.slice(0, max);

  const scored = live
    .map((item) => {
      const hay = `${item.title} ${item.manufacturer} ${item.orderBrandModels.join(" ")} ${item.year}`.toLowerCase();
      let score = 0;
      for (const t of tokens) if (hay.includes(t)) score += 1;
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.item.lastSeenAt.localeCompare(a.item.lastSeenAt));

  if (scored.length >= 3) return scored.slice(0, max).map((s) => s.item);
  return live.slice(0, max);
}

export function formatIrissListingsForAi(vehicles: IrissListingVehicle[]): string {
  if (vehicles.length === 0) {
    return "### Eiropas izsoļu portāli (IRISS)\nNav pieejamu salīdzinājuma ierakstu (sinhronizācija izslēgta vai tukša).";
  }
  const lines: string[] = [
    "### Eiropas izsoļu portāli (IRISS: Autobid, OpenLane, AUTO1)",
    `Salīdzinājuma auto (${vehicles.length}). Izsoles cenas ir sākuma / minimālās, ne gala pārdošanas cenas:`,
  ];
  for (const v of vehicles) {
    const priceParts: string[] = [];
    if (v.priceStart !== null) priceParts.push(`sākuma ${formatEur(v.priceStart)}`);
    if (v.priceMinimal !== null) priceParts.push(`min. ${formatEur(v.priceMinimal)}`);
    if (v.priceCurrent !== null) priceParts.push(`pašreizējā ${formatEur(v.priceCurrent)}`);
    if (v.priceBuyNow !== null) priceParts.push(`pirkt tūlīt ${formatEur(v.priceBuyNow)}`);
    const price = priceParts.length > 0 ? priceParts.join(", ") : "cena nav";
    const km = v.mileageKm !== null ? `${Math.round(v.mileageKm).toLocaleString("lv-LV").replace(/\u00a0/g, " ")} km` : "km nav";
    lines.push(
      `- [${irissListingPlatformLabel(v.platform)}] ${v.title.trim() || v.orderBrandModels[0] || "-"} | gads: ${v.year.trim() || "-"} | ${km} | ${price} | ${v.detailUrl.trim()}`,
    );
  }
  return lines.join("\n");
}
