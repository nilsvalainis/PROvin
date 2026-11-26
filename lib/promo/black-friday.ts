/**
 * Black Friday 2026 - viena konfigurācija (laiks, cenas, slēdzis).
 *
 * Akcija ir aktīva tikai tad, ja:
 *   1) Vercel env `PROMO_BF_ENABLED` ir ieslēgts ("1" / "true" / "yes" / "on"), UN
 *   2) pašreizējais laiks ir intervālā [sākums; beigas] pēc Rīgas laika (beigas 01.12.2026 23:59).
 *
 * Atlaide tikai dīlera datiem (Nila lēmums 26.11.2026). PROVIN AUDITS un MINI nemainās.
 * Akcijas cena 17,49 € (-30 % no 24,99 €) - Nils apstiprināja 26.11.2026.
 *
 * Fails ir tīrs (bez `process.env` lasīšanas modulī), lai to var lietot gan serverī, gan klientā.
 */

import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export const BLACK_FRIDAY_PROMO_ID = "bf2026" as const;

/**
 * Rīgas vietējais laiks (Europe/Riga). Beigas ieskaitot visu minūti 23:59.
 * Sākums apzināti jau pagājis (Nila lēmums 26.11): akcija ieslēdzas uzreiz, kad ieslēdz
 * `PROMO_BF_ENABLED` (pēc dizaina pabeigšanas). Galvenais ieslēgšanas mehānisms ir slēdzis.
 */
export const BLACK_FRIDAY_START_RIGA = "2026-11-26T00:00:00";
export const BLACK_FRIDAY_END_RIGA = "2026-12-01T23:59:59";

export type BlackFridayPriceConfig = {
  /** Parastā (pārsvītrotā) cena centos. */
  regularCents: number;
  /** Akcijas cena centos. */
  promoCents: number;
  /** ES Omnibus: zemākā cena pēdējās 30 dienās pirms akcijas (pārbaudīts Stripe 26.11.2026). */
  lowest30dCents: number;
  /** Atlaides teksts, piem. «-30 %». */
  discountLabel: string;
};

/** Tikai šie plāni saņem akcijas cenu. Citi plāni (premium, plus, business, B2B) nemainās. */
export const BLACK_FRIDAY_PRICES: Partial<Record<TestPricingPlanId, BlackFridayPriceConfig>> = {
  dealer: { regularCents: 2499, promoCents: 1749, lowest30dCents: 2499, discountLabel: "-30 %" },
};

const RIGA_TZ = "Europe/Riga";

function rigaOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RIGA_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "YYYY-MM-DDTHH:mm:ss" Rīgas laikā -> UTC milisekundes (ņem vērā ziemas/vasaras laiku). */
export function rigaLocalToUtcMs(local: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error(`Nederīgs Rīgas laiks: ${local}`);
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  let utc = guess - rigaOffsetMs(guess);
  utc = guess - rigaOffsetMs(utc);
  return utc;
}

export const BLACK_FRIDAY_START_MS = rigaLocalToUtcMs(BLACK_FRIDAY_START_RIGA);
/** Ekskluzīvas beigas: pirmā sekunde pēc 23:59:59. */
export const BLACK_FRIDAY_END_EXCLUSIVE_MS = rigaLocalToUtcMs(BLACK_FRIDAY_END_RIGA) + 1000;

/** Vai env slēdzis ir ieslēgts. Noklusēti izslēgts. */
export function isBlackFridaySwitchOn(raw: string | null | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Vai laiks ir akcijas intervālā (neatkarīgi no slēdža). */
export function isWithinBlackFridayWindow(nowMs: number): boolean {
  return nowMs >= BLACK_FRIDAY_START_MS && nowMs < BLACK_FRIDAY_END_EXCLUSIVE_MS;
}

export function isBlackFridayActive(args: { nowMs: number; enabled: boolean }): boolean {
  return args.enabled && isWithinBlackFridayWindow(args.nowMs);
}

export type BlackFridayPlanPrice = BlackFridayPriceConfig & { promoId: typeof BLACK_FRIDAY_PROMO_ID };

/** Akcijas cena plānam, ja akcija tagad aktīva; citādi `null`. */
export function getBlackFridayPlanPrice(
  planId: string,
  args: { nowMs: number; enabled: boolean },
): BlackFridayPlanPrice | null {
  if (!isBlackFridayActive(args)) return null;
  const cfg = BLACK_FRIDAY_PRICES[planId as TestPricingPlanId];
  if (!cfg || cfg.promoCents <= 0 || cfg.promoCents >= cfg.regularCents) return null;
  return { ...cfg, promoId: BLACK_FRIDAY_PROMO_ID };
}

/* ------------------------------ Teksti / formāts ------------------------------ */

export type PromoLocale = "lv" | "en" | "de" | "ru";

export function promoLocale(locale?: string | null): PromoLocale {
  return locale === "en" || locale === "de" || locale === "ru" ? locale : "lv";
}

/** Tāds pats formāts kā publiskajās cenās: lv/de/ru «24,99 €», en «€24.99». */
export function formatPromoEur(cents: number, locale?: string | null): string {
  const n = (cents / 100).toFixed(2);
  return promoLocale(locale) === "en" ? `€${n}` : `${n.replace(".", ",")} €`;
}

/**
 * Tekstā (pogas, virsraksti) aizstāj parasto cenu ar akcijas cenu.
 * Saglabā atstarpi starp summu un € (parasta vai nedalāmā).
 */
export function swapPriceInText(text: string, fromCents: number, toCents: number): string {
  const from = (fromCents / 100).toFixed(2);
  const to = (toCents / 100).toFixed(2);
  const fromComma = from.replace(".", ",").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const toComma = to.replace(".", ",");
  let out = text.replace(new RegExp(`${fromComma}([ \\u00a0])€`, "g"), `${toComma}$1€`);
  out = out.replace(new RegExp(`€\\s?${from.replace(".", "\\.")}`, "g"), (m) => m.replace(from, to));
  return out;
}

const OMNIBUS_PREFIX: Record<PromoLocale, string> = {
  lv: "Zemākā cena pēdējās 30 dienās:",
  en: "Lowest price in the last 30 days:",
  de: "Niedrigster Preis der letzten 30 Tage:",
  ru: "Самая низкая цена за последние 30 дней:",
};

/** ES Omnibus rinda, piem. «Zemākā cena pēdējās 30 dienās: 24,99 €». */
export function omnibusLowestPriceLine(lowest30dCents: number, locale?: string | null): string {
  const loc = promoLocale(locale);
  /** Nedalāmā atstarpe cenā, lai «€» nepārlec jaunā rindā. */
  return `${OMNIBUS_PREFIX[loc]} ${formatPromoEur(lowest30dCents, loc).replace(" ", "\u00a0")}`;
}

const BANNER_TEXT: Record<PromoLocale, (promo: string, regular: string, off: string) => string> = {
  lv: (p, r, d) => `Black Friday ${d}: dīlera dati ${p} (parasti ${r}) līdz 01.12.`,
  en: (p, r, d) => `Black Friday ${d}: dealer data ${p} (usually ${r}) until 1 Dec.`,
  de: (p, r, d) => `Black Friday ${d}: Händlerdaten ${p} (statt ${r}) bis 01.12.`,
  ru: (p, r, d) => `Black Friday ${d}: данные дилера ${p} (обычно ${r}) до 01.12.`,
};

/** Pagaidu joslas teksts (gala dizains vēlāk). */
export function blackFridayBannerText(price: BlackFridayPriceConfig, locale?: string | null): string {
  const loc = promoLocale(locale);
  return BANNER_TEXT[loc](formatPromoEur(price.promoCents, loc), formatPromoEur(price.regularCents, loc), price.discountLabel);
}
