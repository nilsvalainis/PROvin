import { vinCheckHref } from "@/lib/paths";

/**
 * Existing on-page phrases that already name VIN checking.
 * Longest match first at the same index so "VIN checks" wins over "VIN check".
 * Do not invent copy - only wrap these strings where they already appear.
 */
export const VIN_CHECK_LINK_PHRASES: Record<string, readonly string[]> = {
  lv: ["VIN koda pārbaudi", "VIN koda pārbaude", "VIN pārbaude"],
  en: ["VIN checks", "VIN check"],
  de: ["VIN-Checks", "VIN-Check", "VIN-Prüfung"],
  ru: ["проверки VIN", "проверку VIN", "проверить VIN", "проверка VIN", "Проверка VIN"],
};

export type VinCheckPhraseParts = {
  before: string;
  phrase: string;
  after: string;
};

export function vinCheckPageHref(): string {
  return vinCheckHref();
}

function phrasesFor(locale: string): readonly string[] {
  return VIN_CHECK_LINK_PHRASES[locale] ?? VIN_CHECK_LINK_PHRASES.lv;
}

/** First existing VIN-check phrase in `text`, preferring the longest match at that index. */
export function firstVinCheckPhrase(text: string, locale: string): { index: number; phrase: string } | null {
  let best: { index: number; phrase: string } | null = null;
  for (const phrase of phrasesFor(locale)) {
    const index = text.indexOf(phrase);
    if (index < 0) continue;
    if (
      !best ||
      index < best.index ||
      (index === best.index && phrase.length > best.phrase.length)
    ) {
      best = { index, phrase };
    }
  }
  return best;
}

export function wrapFirstVinCheckPhrase(text: string, locale: string): VinCheckPhraseParts | null {
  const hit = firstVinCheckPhrase(text, locale);
  if (!hit) return null;
  return {
    before: text.slice(0, hit.index),
    phrase: hit.phrase,
    after: text.slice(hit.index + hit.phrase.length),
  };
}
