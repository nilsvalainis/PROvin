import type { Tp5MobileServiceId } from "@/lib/test-pricing-5-mobile";
import { TP5_MOBILE_SERVICE_ORDER } from "@/lib/test-pricing-5-mobile";

/** Hero checkout tab cap — keep switcher to 3–4 plans; extras live on `/pakalpojumi`. */
export const HERO_CHECKOUT_TAB_MAX = 4;

export const HERO_CHECKOUT_TAB_IDS: readonly Tp5MobileServiceId[] = TP5_MOBILE_SERVICE_ORDER;

const HERO_PLAN_ALIAS: Record<string, Tp5MobileServiceId> = {
  mini: "mini",
  audits: "audits",
  audit: "audits",
  dealer: "dealer",
  dilera: "dealer",
  "dealer-data": "dealer",
  koreausa: "koreaUsa",
  "korea-usa": "koreaUsa",
  korea: "koreaUsa",
  usa: "koreaUsa",
  "usa-korea": "koreaUsa",
  asv: "koreaUsa",
};

/** Parse `?plan=` / `?tab=` into a hero tier id. */
export function parseHeroPlanParam(raw: string | null | undefined): Tp5MobileServiceId | null {
  if (raw == null) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  const id = HERO_PLAN_ALIAS[key];
  if (!id || !HERO_CHECKOUT_TAB_IDS.includes(id)) return null;
  return id;
}

/** next-intl `Link`-safe path → home hero with tier preselected. */
export function homeHeroCheckoutHref(planId: Tp5MobileServiceId): string {
  return `/?plan=${planId}#home-hero`;
}

export function pakalpojumiHref(): string {
  return "/pakalpojumi";
}
