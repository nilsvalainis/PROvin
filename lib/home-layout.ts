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

/**
 * Salīdzinājuma tabulas pirmās kolonnas (IEZĪME) rindiņu teksts — tas pats izmērs un svars kā šūnām zem „STANDARTA ATSKAITE”.
 */
export const comparisonTableFeatureCellClass =
  "text-[13px] font-medium leading-snug text-[#1d1d1f] sm:text-[14px] sm:leading-snug";

/**
 * Maigs vertikālais „vilnis” — gaišāks augšā, nedaudz tumšāks lejā (IRISS).
 */
export const homeSoftBandGradientClass =
  "bg-gradient-to-b from-[#f9fafc] via-[#f3f5f8] to-[#e8ecf0]";

/**
 * 3 soļu sadaļa: pakāpeniski tumšāks vidū, sapludinājums ar gaišāku fonu augšā un apakšā (ne cieta kaste).
 */
export const homeHowItWorksBandClass =
  "bg-[linear-gradient(to_bottom,#ffffff_0%,#f7f9fc_12%,#eef2f7_38%,#e2e8f0_50%,#eef2f7_62%,#f7f9fc_88%,#ffffff_100%)]";
