/**
 * Sludinājuma un pasūtījuma piesaistes vārti: auto pieder pasūtījumam tikai tad,
 * ja sakrīt marka UN modelis no pasūtījuma `brandModel` (piem. „Jeep, Mitsubishi Pajero”
 * = jebkurš Jeep vai Mitsubishi Pajero).
 *
 * Saglabātie `orderIds` un atbilstību ieraksti var saturēt nepareizus pārus no kopīgas
 * eCarsTrade nolasīšanas, kur ingest filtrs marku neņēma vērā. Tos filtrējam lasot,
 * vecos datus nemainot. Manuālā piesaiste (`orderOv`) šos vārtus apiet.
 */

import { ecarstradeHasAnyPrice } from "@/lib/iriss-listings-ecarstrade";
import { resolveMakeModelPairsFromBrand, type EcarstradeMark, type EcarstradeModel } from "@/lib/iriss-listings-ecarstrade-catalog";
import { makeMatchesHay } from "@/lib/iriss-listings-search-filter";
import { isIrissScanOrderId } from "@/lib/iriss-scan-listings";

export type ListingMakeModelVehicle = { manufacturer?: string; title?: string };

type GatePair = { make: EcarstradeMark; models: string[] };

function norm(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const pairCache = new Map<string, GatePair[]>();

function gatePairs(brandModel: string): GatePair[] {
  const key = brandModel.trim();
  const hit = pairCache.get(key);
  if (hit) return hit;
  const pairs = resolveMakeModelPairsFromBrand(key).map((p) => {
    const names = p.models.map((m: EcarstradeModel) => m.name).filter(Boolean);
    const typed = norm(p.modelText).split(" ")[0] ?? "";
    // Katalogs „GLC” piesaista „GL-Class”; pasūtījumā rakstītais vārds paliek kā otrs variants.
    const catalogWords = new Set(names.flatMap((n) => norm(n).split(" ")));
    const models = typed && !catalogWords.has(typed) ? [...names, typed] : names;
    return { make: p.make, models };
  });
  if (pairCache.size > 2_000) pairCache.clear();
  pairCache.set(key, pairs);
  return pairs;
}

/** „2 Series” / „2er” = 218d, 220i; „E-Class” = E 220 d, E220. Virsrakstos kataloga nosaukuma bieži nav. */
function seriesOrClassMatches(tokens: readonly string[], model: string): boolean {
  const series = /^(\d) series$/.exec(model);
  if (series) {
    const n = series[1]!;
    return tokens.some((t, i) => t === `${n}er` || new RegExp(`^${n}\\d{2}[a-z]{0,2}$`).test(t) || (t === n && tokens[i + 1] === "series"));
  }
  const cls = /^([a-z]{1,3}) class$/.exec(model);
  if (cls) {
    const c = cls[1]!;
    return tokens.some(
      (t, i) =>
        new RegExp(`^${c}\\d{2,3}[a-z]{0,2}$`).test(t) ||
        (t === c && (/^\d{2,3}[a-z]{0,2}$/.test(tokens[i + 1] ?? "") || /^(class|klasse|klase)$/.test(tokens[i + 1] ?? ""))),
    );
  }
  return false;
}

function modelMatches(hayNorm: string, tokens: readonly string[], model: string): boolean {
  const m = norm(model);
  if (!m) return false;
  if (seriesOrClassMatches(tokens, m)) return true;
  if (` ${hayNorm} `.includes(` ${m} `)) return true;
  const compact = m.replace(/ /g, "");
  if (tokens.includes(compact)) return true;
  // Skaitlisks modelis: „220” = 220d / 220i, ne 2200.
  return /\d$/.test(compact) && tokens.some((t) => t.startsWith(compact) && /^[a-z]{1,2}$/.test(t.slice(compact.length)));
}

/**
 * `true`, ja auto marka un modelis atbilst pasūtījuma `brandModel`.
 * Pasūtījums tikai ar marku („Jeep”) atbilst jebkuram šīs markas modelim.
 * Ja `brandModel` nav atpazīstamas markas vai auto nav virsraksta, nevaram spriest: `true`.
 */
export function listingMatchesOrderMakeModel(vehicle: ListingMakeModelVehicle, brandModel: string): boolean {
  const pairs = gatePairs(brandModel ?? "");
  if (pairs.length === 0) return true;
  const hay = `${vehicle.manufacturer ?? ""} ${vehicle.title ?? ""}`.trim();
  if (!hay) return true;
  const hayNorm = norm(hay);
  const tokens = hayNorm.split(" ");
  return pairs.some((p) => {
    if (!makeMatchesHay(hay, p.make.name)) return false;
    if (p.models.length === 0) return true;
    return p.models.some((model) => modelMatches(hayNorm, tokens, model));
  });
}

/**
 * Atstāj tikai tos klientu pasūtījumus, kuru marka un modelis atbilst auto.
 * Nezināmi id (dzēsti pasūtījumi) un SCAN (`scan:`) id paliek kā bija.
 */
export function gateListingOrderIds(
  vehicle: ListingMakeModelVehicle,
  orderIds: readonly string[],
  brandModelById: ReadonlyMap<string, string>,
): string[] {
  return orderIds.filter((id) => {
    if (isIrissScanOrderId(id)) return true;
    const brandModel = brandModelById.get(id);
    return brandModel == null || listingMatchesOrderMakeModel(vehicle, brandModel);
  });
}

/**
 * eCarsTrade auto bez cenas un bez solījuma neatbilst kritērijiem un sarakstā netiek rādīts.
 * Tikai pierādīts `no_bids` (pēc login, tukša solījuma poga). `signed_out` / `unknown` paliek redzami,
 * lai neslēptu auto tikai tāpēc, ka cena netika nolasīta.
 */
export function isEcarstradeNoPriceNoBid(v: {
  platform: string;
  priceState?: string;
  priceBuyNow?: number | null;
  priceCurrent?: number | null;
  priceEstimate?: number | null;
  priceStart?: number | null;
}): boolean {
  return v.platform === "ecarstrade" && v.priceState === "no_bids" && !ecarstradeHasAnyPrice(v);
}

type GateViewVehicle = ListingMakeModelVehicle & {
  id: string;
  platform: string;
  orderIds: string[];
  priceState?: string;
  priceBuyNow?: number | null;
  priceCurrent?: number | null;
  priceEstimate?: number | null;
  priceStart?: number | null;
};

/**
 * Lasīšanas skats sarakstam: saglabātās piesaistes caur marka/modelis vārtiem.
 * Auto, kuram neviena piesaiste neiztur un nav manuālas (`orderOv`) vai atbilstības ieraksta, netiek rādīts.
 * Glabātuvē nekas netiek pārrakstīts.
 */
export function gateListingVehiclesForView<T extends GateViewVehicle>(
  vehicles: readonly T[],
  orders: readonly { id: string; brandModel: string }[],
  opts: { orderOv?: Record<string, string[]>; matchOrderIds?: Record<string, string[]> } = {},
): T[] {
  const brandById = new Map(orders.map((o) => [o.id, o.brandModel]));
  const out: T[] = [];
  for (const v of vehicles) {
    if (isEcarstradeNoPriceNoBid(v)) continue;
    const kept = gateListingOrderIds(v, v.orderIds, brandById);
    if (kept.length === v.orderIds.length) {
      out.push(v);
      continue;
    }
    const manual = (opts.orderOv?.[v.id]?.length ?? 0) > 0;
    const matched = (opts.matchOrderIds?.[v.id]?.length ?? 0) > 0;
    if (kept.length === 0 && !manual && !matched) continue;
    out.push({ ...v, orderIds: kept });
  }
  return out;
}
