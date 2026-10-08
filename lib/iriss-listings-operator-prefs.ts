import { DEFAULT_LISTING_COSTS, type ListingCostParts, type ListingTaxKind } from "@/lib/iriss-listings-cost";

export const IRISS_LIST_PREFS_KEY = "provin-iriss-list-v4";

export type ListingTaxOverride = { kind: ListingTaxKind; rate?: number | null };

export type IrissListPrefs = {
  budget: number | null;
  costs: ListingCostParts;
  fav: string[];
  hidden: string[];
  notes: Record<string, string>;
  taxOv: Record<string, ListingTaxOverride>;
  costOv: Record<string, Partial<ListingCostParts>>;
  damageLv: Record<string, string>;
};

export function defaultIrissListPrefs(): IrissListPrefs {
  return { budget: null, costs: { ...DEFAULT_LISTING_COSTS }, fav: [], hidden: [], notes: {}, taxOv: {}, costOv: {}, damageLv: {} };
}

export function parseIrissListPrefs(raw: string | null): IrissListPrefs {
  const base = defaultIrissListPrefs();
  if (!raw) return base;
  try {
    const o = JSON.parse(raw) as Partial<IrissListPrefs>;
    const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    return {
      budget: typeof o.budget === "number" && o.budget > 0 ? o.budget : null,
      costs: {
        fee: n(o.costs?.fee, base.costs.fee),
        transport: n(o.costs?.transport, base.costs.transport),
        commission: n(o.costs?.commission, base.costs.commission),
        unplanned: n(o.costs?.unplanned, base.costs.unplanned),
      },
      fav: Array.isArray(o.fav) ? o.fav.filter((x): x is string => typeof x === "string") : [],
      hidden: Array.isArray(o.hidden) ? o.hidden.filter((x): x is string => typeof x === "string") : [],
      notes: o.notes && typeof o.notes === "object" ? Object.fromEntries(Object.entries(o.notes).filter((e): e is [string, string] => typeof e[1] === "string")) : {},
      taxOv: o.taxOv && typeof o.taxOv === "object" ? (o.taxOv as IrissListPrefs["taxOv"]) : {},
      costOv: o.costOv && typeof o.costOv === "object" ? (o.costOv as IrissListPrefs["costOv"]) : {},
      damageLv: o.damageLv && typeof o.damageLv === "object" ? Object.fromEntries(Object.entries(o.damageLv).filter((e): e is [string, string] => typeof e[1] === "string")) : {},
    };
  } catch {
    return base;
  }
}

export function listingCostsFor(prefs: IrissListPrefs, vehicleId: string): ListingCostParts {
  const o = prefs.costOv[vehicleId] ?? {};
  return {
    fee: o.fee ?? prefs.costs.fee,
    transport: o.transport ?? prefs.costs.transport,
    commission: o.commission ?? prefs.costs.commission,
    unplanned: o.unplanned ?? prefs.costs.unplanned,
  };
}
