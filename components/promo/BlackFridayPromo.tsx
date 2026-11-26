"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  blackFridayBannerText,
  formatPromoEur,
  getBlackFridayPlanPrice,
  omnibusLowestPriceLine,
  swapPriceInText,
  type BlackFridayPlanPrice,
} from "@/lib/promo/black-friday";
import styles from "./black-friday-promo.module.css";

/**
 * Publiskās vietnes akcijas konteksts. Tikai `app/[locale]/layout.tsx` (nav adminā, nav B2B demo).
 *
 * Lapa ir statiska, tāpēc servera HTML vienmēr ir bez akcijas; pēc ielādes pārlūks pārbauda
 * laiku un ik minūti pārrēķina (akcija pati ieslēdzas un izslēdzas). Cena maksājumā - tikai serverī.
 */
type Ctx = { enabled: boolean; nowMs: number | null };

const BlackFridayContext = createContext<Ctx>({ enabled: false, nowMs: null });

export function BlackFridayProvider({
  enabled,
  initialNowMs = null,
  children,
}: {
  enabled: boolean;
  /** Tikai testiem (servera renderā laiks netiek fiksēts - lapa ir statiska). */
  initialNowMs?: number | null;
  children: ReactNode;
}) {
  const [nowMs, setNowMs] = useState<number | null>(initialNowMs);
  useEffect(() => {
    if (!enabled) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return <BlackFridayContext.Provider value={{ enabled, nowMs }}>{children}</BlackFridayContext.Provider>;
}

/** Akcijas cena plānam (`dealer`), ja tā tagad ir aktīva; citādi `null`. */
export function useBlackFridayPlanPrice(planId: string): BlackFridayPlanPrice | null {
  const { enabled, nowMs } = useContext(BlackFridayContext);
  if (nowMs == null) return null;
  return getBlackFridayPlanPrice(planId, { nowMs, enabled });
}

/** Teksts ar akcijas cenu (pogas), ja akcija aktīva. */
export function usePromoText(planId: string, text: string): string {
  const promo = useBlackFridayPlanPrice(planId);
  return promo ? swapPriceInText(text, promo.regularCents, promo.promoCents) : text;
}

/** Pārsvītrotā vecā cena + jaunā cena. Bez akcijas - parastā cena nemainīta. */
export function PromoPrice({ planId, regularLabel }: { planId: string; regularLabel: string }) {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice(planId);
  if (!promo) return <>{regularLabel}</>;
  return (
    <span className={styles.price} data-promo={promo.promoId}>
      <s className={styles.old}>{formatPromoEur(promo.regularCents, locale)}</s>{" "}
      <span className={styles.new}>{formatPromoEur(promo.promoCents, locale)}</span>{" "}
      <span className={styles.off}>{promo.discountLabel}</span>
    </span>
  );
}

/** ES Omnibus: «Zemākā cena pēdējās 30 dienās: 24,99 €» (tikai akcijas laikā). */
export function PromoOmnibusLine({ planId, className }: { planId: string; className?: string }) {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice(planId);
  if (!promo) return null;
  return (
    <span className={`${styles.omnibus}${className ? ` ${className}` : ""}`} data-omnibus>
      {omnibusLowestPriceLine(promo.lowest30dCents, locale)}
    </span>
  );
}

/**
 * Vieta akcijas joslai. Gala dizainu ieliek kā `children`; bez tā - vienkārša pagaidu josla.
 * Rāda tikai akcijas laikā.
 */
export function BlackFridayBannerSlot({ children }: { children?: ReactNode }) {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo) return null;
  if (children) return <>{children}</>;
  return (
    <div className={styles.banner} role="region" aria-label="Black Friday" data-promo-banner={promo.promoId}>
      <Link href="/?plan=dealer#home-hero" className={styles.bannerLink}>
        {blackFridayBannerText(promo, locale)}
      </Link>
    </div>
  );
}
