/** Vienots maks. platums lapas vidus slejai (tabula, kartītes, Why, IRISS). */
export const homeContentMaxClass = "mx-auto min-w-0 w-full max-w-[1200px]";

/**
 * Zem-Hero sadaļu virsraksts — maza trekna uppercase, provin zilā.
 * Nelietot Hero sadaļā.
 */
export const homeSectionEyebrowClass =
  "text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent sm:text-[13px]";

/** Salīdzinājuma tabulas galvenes bāze (izmērs, svars) — krāsu dod `Muted` vai `Accent`. */
export const comparisonTableHeaderBaseClass =
  "text-[10px] font-bold uppercase tracking-wide sm:text-[11px] sm:tracking-wider";

/**
 * Salīdzinājuma tabulas galvenes „IEZĪME” / „STANDARTA ATSKAITE” — pelēks.
 */
export const comparisonTableHeaderMutedClass = `${comparisonTableHeaderBaseClass} text-[#5c5d62]`;

/** PROVIN kolonna tabulas galvenē. */
export const comparisonTableHeaderAccentClass = `${comparisonTableHeaderBaseClass} text-provin-accent`;
