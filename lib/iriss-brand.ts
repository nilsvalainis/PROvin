import "server-only";

/**
 * Tikai **SIA IRISS / Dzintarzeme Auto** piedāvājuma PDF un drukas HTML (`iriss-pasutijums-pdf*`).
 *
 * **Nav** PROVIN publiskās vietnes, kājenes, JSON-LD vai Stripe saskares daļa — `Smilšu 19` un pārējās
 * IRISS rindiņas nedrīkst importēt no mārketinga lapām, layout vai `getCompanyLegal()` plūsmām.
 * PROVIN juridiskā adrese: `lib/company.ts` → `NEXT_PUBLIC_COMPANY_LEGAL_ADDRESS` (noklusējums Jana iela 3…).
 */
export const IRISS_BRAND_ORANGE_HEX = "#F26522";

/** IRISS PDF kājenes rekvizīti — tikai servera PDF/HTML ģenerēšanai. */
export const IRISS_COMPANY_LINES = [
  "SIA IRISS",
  "Reģ. nr.: LV59202001191",
  "Juridiskā adrese: Smilšu 19, Tukums, Tukuma novads, LV-3101",
  "Faktiskā adrese: Hermaņi 1, Smārdes pagasts, Tukuma novads, LV3129",
  "Banka: AS SEB banka, SWIFT: UNLALV2X, IBAN: LV75UNLA0050005241769",
  "Kontakti: info@dzintarzemeauto.lv, www.dzintarzemeauto.lv",
  "Tālrunis: +371 204 205 39, +371 77 33 440",
] as const;
